param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [switch]$SkipMediaBudget
)

$ErrorActionPreference = 'Stop'
$failures = [System.Collections.Generic.List[string]]::new()
$pages = @('index.html', 'en/index.html', 'sketchfab.html', 'sketchfab-en.html')

function Add-Failure([string]$Message) {
  $failures.Add($Message)
}

function Resolve-LocalReference([string]$Page, [string]$Reference) {
  $clean = ($Reference -split '[?#]')[0]
  if (-not $clean -or $clean -eq '/') {
    return $null
  }

  if ($clean.StartsWith('/')) {
    return Join-Path $Root $clean.TrimStart('/')
  }

  $pageDirectory = Split-Path $Page
  if (-not $pageDirectory) {
    $pageDirectory = '.'
  }
  return Join-Path (Join-Path $Root $pageDirectory) $clean
}

foreach ($page in $pages) {
  $path = Join-Path $Root $page
  if (-not (Test-Path -LiteralPath $path)) {
    Add-Failure "$page is missing"
    continue
  }

  $content = Get-Content -Raw -LiteralPath $path
  $ids = [regex]::Matches($content, 'id="([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value }
  $duplicateIds = $ids | Group-Object | Where-Object Count -gt 1
  foreach ($duplicate in $duplicateIds) {
    Add-Failure "$page contains duplicate id '$($duplicate.Name)'"
  }

  $localReferences = [regex]::Matches(
    $content,
    '(?:src|href|poster|data-src)="([^"#][^"]*)"'
  ) | ForEach-Object {
    $_.Groups[1].Value
  } | Where-Object {
    $_ -notmatch '^(?:https?:|mailto:|tel:|data:|\$\{)'
  }

  foreach ($reference in $localReferences) {
    $resolved = Resolve-LocalReference $page $reference
    if ($resolved -and -not (Test-Path -LiteralPath $resolved)) {
      Add-Failure "$page references missing file '$reference'"
    }
  }

  $anchors = [regex]::Matches($content, 'href="#([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value }
  foreach ($anchor in $anchors) {
    if ($anchor -notin $ids -and $anchor -ne 'top') {
      Add-Failure "$page references missing anchor '#$anchor'"
    }
  }
}

$mainPages = @('index.html', 'en/index.html')
foreach ($page in $mainPages) {
  $content = Get-Content -Raw -LiteralPath (Join-Path $Root $page)

  if ($content -match '<script(?![^>]*(?:src=|type="application/ld\+json"))[^>]*>(?s).*?</script>') {
    Add-Failure "$page still contains inline application JavaScript"
  }
  if ($content -notmatch '<script src="/scripts/site\.js" defer></script>') {
    Add-Failure "$page does not load the shared site script"
  }
  if ($content -match 'plyr\.polyfilled\.js') {
    Add-Failure "$page loads the legacy Plyr polyfilled bundle"
  }
  if ($content -match '(?i)internship|stage(?:\s|<)|février 2026|February 2026|mars.+2026|Mar.+2026') {
    Add-Failure "$page contains obsolete internship copy"
  }
  if ($content -notmatch 'September 1, 2026|1er septembre 2026') {
    Add-Failure "$page does not contain the agreed September 2026 availability"
  }
  if ($content -match '6A3A4101\.png|residence-[^"]+\.png|(?:media/|/media/)(?:5|6|9|10)\.png') {
    Add-Failure "$page still references large PNG portfolio imagery"
  }
  if ($content -match '<source\s+src="[^"]+\.mp4"') {
    Add-Failure "$page contains an eagerly addressable project video"
  }
}

$css = Get-Content -Raw -LiteralPath (Join-Path $Root 'style.css')
if ($css -notmatch 'scroll-padding-top') {
  Add-Failure 'style.css is missing anchor scroll padding'
}
if ($css -notmatch '(?s)\.hero\s*\{[^}]*width:\s*100%') {
  Add-Failure 'style.css does not explicitly constrain the hero to the viewport'
}
if ($css -notmatch '\.nova-header\.is-condensed') {
  Add-Failure 'style.css is missing the mobile dynamic-island header state'
}
if ($css -notmatch '\.video-frame\.is-hydrated::after' -or $css -notmatch '\.video-frame\.is-playing::after') {
  Add-Failure 'style.css does not hide the custom video play overlay after activation'
}

$siteScript = Get-Content -Raw -LiteralPath (Join-Path $Root 'scripts/site.js')
if ($siteScript -notmatch 'is-condensed') {
  Add-Failure 'site.js does not toggle the dynamic-island header state'
}
if ($siteScript -notmatch 'is-hydrated' -or $siteScript -notmatch 'is-playing') {
  Add-Failure 'site.js does not maintain video hydration/playback classes'
}

if (-not $SkipMediaBudget) {
  $mediaBytes = (Get-ChildItem (Join-Path $Root 'media') -Recurse -File |
    Measure-Object Length -Sum).Sum
  if ($mediaBytes -gt 100MB) {
    Add-Failure ("media directory exceeds 100 MB ({0:N1} MB)" -f ($mediaBytes / 1MB))
  }
}

if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Host "Site audit passed for $($pages.Count) pages."
