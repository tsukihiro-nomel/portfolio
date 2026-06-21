(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const narrowViewport = window.matchMedia('(max-width: 768px)');
  const isFrench = document.documentElement.lang === 'fr';

  function initVersionCheck() {
    if (typeof fetch !== 'function') return;

    const key = 'portfolio-version';
    const check = () => {
      fetch('/version.json', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (!payload || typeof payload.version !== 'string') return;
          const stored = window.localStorage.getItem(key);
          window.localStorage.setItem(key, payload.version);
          if (stored && stored !== payload.version) {
            window.location.reload();
          }
        })
        .catch(() => {});
    };

    try {
      check();
      window.setInterval(check, 5 * 60 * 1000);
    } catch (error) {
      // Storage can be unavailable in privacy modes; the site still works.
    }
  }

  function initBackground() {
    const starfield = document.getElementById('starfield');
    const particles = document.getElementById('interactive-particles');
    const spheres = Array.from(document.querySelectorAll('.gradient-sphere'));
    const lowMotionSurface = coarsePointer.matches || narrowViewport.matches;
    const animate = !reducedMotion.matches && !lowMotionSurface;
    const random = (min, max) => Math.random() * (max - min) + min;

    if (starfield) {
      const fragment = document.createDocumentFragment();
      const count = animate ? 72 : lowMotionSurface ? 0 : 24;
      for (let index = 0; index < count; index += 1) {
        const star = document.createElement('span');
        star.className = 'star';
        star.style.left = `${random(0, 100)}%`;
        star.style.setProperty('--star-size', random(0.6, 1.8).toFixed(2));
        star.style.setProperty('--star-duration', `${random(26, 52).toFixed(2)}s`);
        star.style.setProperty('--star-delay', `${random(-60, 0).toFixed(2)}s`);
        fragment.appendChild(star);
      }
      starfield.appendChild(fragment);
    }

    if (!animate || !spheres.length) return;

    let pointerX = 0.5;
    let pointerY = 0.5;
    let frameId = 0;
    let lastTrail = 0;

    const handlePointer = (event) => {
      pointerX = event.clientX / window.innerWidth;
      pointerY = event.clientY / window.innerHeight;

      if (!particles || performance.now() - lastTrail < 90) return;
      lastTrail = performance.now();
      const trail = document.createElement('span');
      trail.className = 'floating-particle pointer-trail';
      trail.style.left = `${pointerX * 100}%`;
      trail.style.top = `${pointerY * 100}%`;
      trail.style.setProperty('--particle-size', random(5, 8).toFixed(2));
      particles.appendChild(trail);
      trail.addEventListener('animationend', () => trail.remove(), { once: true });
    };

    const render = (time) => {
      const seconds = time * 0.001;
      spheres.forEach((sphere, index) => {
        const baseX = Number(sphere.dataset.baseX || 0);
        const baseY = Number(sphere.dataset.baseY || 0);
        const amplitudeX = Number(sphere.dataset.amplitudeX || 0);
        const amplitudeY = Number(sphere.dataset.amplitudeY || 0);
        const speed = Number(sphere.dataset.speed || 0.08);
        const scale = Number(sphere.dataset.scale || 1);
        const depth = Number(sphere.dataset.depth || 6);
        const phase = Number(sphere.dataset.phase || index);
        const x = baseX + Math.sin((seconds + phase) * speed * 6) * amplitudeX;
        const y = baseY + Math.cos((seconds + phase) * speed * 6) * amplitudeY;
        const parallaxX = (pointerX - 0.5) * (12 / depth);
        const parallaxY = (pointerY - 0.5) * (10 / depth);
        sphere.style.transform =
          `translate3d(${x + parallaxX}%, ${y + parallaxY}%, 0) scale(${scale})`;
      });
      frameId = window.requestAnimationFrame(render);
    };

    document.addEventListener('pointermove', handlePointer, { passive: true });
    frameId = window.requestAnimationFrame(render);
    window.addEventListener('pagehide', () => {
      document.removeEventListener('pointermove', handlePointer);
      window.cancelAnimationFrame(frameId);
    }, { once: true });
  }

  function initNavigation() {
    const header = document.getElementById('site-header');
    const nav = document.getElementById('site-navigation');
    const toggle = document.getElementById('openmenu');
    if (!header || !nav || !toggle) return;

    const mobile = window.matchMedia('(max-width: 1024px)');
    const labels = isFrench
      ? { open: 'Ouvrir le menu', close: 'Fermer le menu' }
      : { open: 'Open menu', close: 'Close menu' };
    const srText = toggle.querySelector('.sr-only');

    document.body.classList.add('js-nav-ready');

    let scrollFrame = 0;

    const updateCondensed = () => {
      scrollFrame = 0;
      header.classList.toggle('is-condensed', mobile.matches && window.scrollY > 72);
    };

    const requestCondensedUpdate = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(updateCondensed);
    };

    const setOpen = (open, focusToggle) => {
      header.classList.toggle('menu-open', open);
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? labels.close : labels.open);
      nav.setAttribute('aria-hidden', String(mobile.matches && !open));
      if (srText) srText.textContent = open ? labels.close : labels.open;
      if (!open) nav.scrollTop = 0;
      if (focusToggle) toggle.focus({ preventScroll: true });
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a') && mobile.matches) setOpen(false);
    });
    document.addEventListener('pointerdown', (event) => {
      if (mobile.matches && !header.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false, true);
      }
    });
    window.addEventListener('scroll', requestCondensedUpdate, { passive: true });
    window.addEventListener('pagehide', () => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    }, { once: true });

    const sync = () => {
      setOpen(false);
      updateCondensed();
    };
    if (typeof mobile.addEventListener === 'function') {
      mobile.addEventListener('change', sync);
    } else {
      mobile.addListener(sync);
    }
    sync();
  }

  function initVideos() {
    const containers = Array.from(document.querySelectorAll('[data-video-player]'));
    if (!containers.length) return;

    const copy = isFrench
      ? { text: 'La vidéo ne peut pas être chargée.', cta: 'Ouvrir la vidéo' }
      : { text: 'The video could not be loaded.', cta: 'Open video' };

    containers.forEach((container) => {
      const video = container.matches('video') ? container : container.querySelector('video');
      const source = video && video.querySelector('source[data-src]');
      if (!video || !source) return;

      let hydrated = false;
      let player = null;
      let pendingPlayback = false;
      const useNativePlayer = coarsePointer.matches || narrowViewport.matches;

      const ensurePlyr = () => {
        if (useNativePlayer || player || typeof window.Plyr !== 'function') return;
        try {
          player = new window.Plyr(video, {
            ratio: '16:9',
            settings: ['quality', 'speed']
          });
        } catch (error) {
          player = null;
        }
      };

      const playVideo = () => {
        const target = player && typeof player.play === 'function' ? player : video;
        try {
          const playback = target.play();
          if (playback && typeof playback.catch === 'function') {
            playback.catch(() => {});
          }
        } catch (error) {
          // Native players can reject while the source is still settling.
        }
      };

      const requestPlayback = () => {
        pendingPlayback = true;
        playVideo();
      };

      const hydrate = (options = {}) => {
        if (!hydrated) {
          hydrated = true;
          container.classList.add('is-hydrated', 'is-loading');
          source.src = source.dataset.src;
          video.load();
          ensurePlyr();
        }
        if (options.play) requestPlayback();
      };

      const fallback = document.createElement('div');
      fallback.className = 'video-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.innerHTML =
        `<p>${copy.text}</p><a href="${source.dataset.src}" target="_blank" rel="noopener">${copy.cta}</a>`;
      container.appendChild(fallback);

      video.addEventListener('error', () => {
        pendingPlayback = false;
        container.classList.remove('is-loading', 'is-playing');
        fallback.classList.add('visible');
        fallback.removeAttribute('aria-hidden');
      });
      video.addEventListener('canplay', () => {
        container.classList.remove('is-loading');
        fallback.classList.remove('visible');
        fallback.setAttribute('aria-hidden', 'true');
        if (pendingPlayback) playVideo();
      });
      video.addEventListener('play', () => container.classList.add('is-playing'));
      video.addEventListener('playing', () => {
        pendingPlayback = false;
        container.classList.add('is-playing');
        container.classList.remove('is-loading');
        fallback.classList.remove('visible');
      });
      video.addEventListener('pause', () => {
        pendingPlayback = false;
        container.classList.remove('is-playing');
      });
      video.addEventListener('ended', () => {
        pendingPlayback = false;
        container.classList.remove('is-playing');
      });

      container.addEventListener('pointerdown', () => hydrate({ play: true }), { capture: true, once: true });
      container.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (!hydrated) event.preventDefault();
        hydrate({ play: true });
      }, { capture: true });
    });
  }

  function initGallery() {
    const gallery = document.querySelector('[data-gallery-glide]');
    if (!gallery || typeof window.Glide !== 'function') return;

    new window.Glide(gallery, {
      type: 'carousel',
      focusAt: 'center',
      perView: 1,
      gap: 24,
      autoplay: reducedMotion.matches ? false : 5200,
      hoverpause: true,
      animationDuration: reducedMotion.matches ? 0 : 600,
      keyboard: true,
      breakpoints: {
        768: { gap: 18 },
        560: { gap: 12 }
      }
    }).mount();
  }

  function initReveal() {
    const elements = document.querySelectorAll('.reveal');
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });

    elements.forEach((element) => observer.observe(element));
  }

  function initEnhancements() {
    const lowMotionSurface = coarsePointer.matches || narrowViewport.matches;
    const progress = document.querySelector('.scroll-progress-bar');
    if (progress && !lowMotionSurface) {
      let progressFrame = 0;
      const updateProgress = () => {
        progressFrame = 0;
        const height = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.width = `${height > 0 ? (window.scrollY / height) * 100 : 0}%`;
      };
      const requestProgressUpdate = () => {
        if (progressFrame) return;
        progressFrame = window.requestAnimationFrame(updateProgress);
      };
      window.addEventListener('scroll', requestProgressUpdate, { passive: true });
      window.addEventListener('pagehide', () => {
        if (progressFrame) window.cancelAnimationFrame(progressFrame);
      }, { once: true });
      updateProgress();
    }

    if (lowMotionSurface || reducedMotion.matches) return;

    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    if (dot && ring) {
      let mouseX = 0;
      let mouseY = 0;
      let ringX = 0;
      let ringY = 0;
      document.body.classList.add('cursor-ready');
      document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }, { passive: true });
      const follow = () => {
        ringX += (mouseX - ringX) * 0.15;
        ringY += (mouseY - ringY) * 0.15;
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        window.requestAnimationFrame(follow);
      };
      follow();
    }

    document.querySelectorAll('.project-card').forEach((card) => {
      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      }, { passive: true });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initVersionCheck();
    initBackground();
    initNavigation();
    initVideos();
    initGallery();
    initReveal();
    initEnhancements();
  });
})();
