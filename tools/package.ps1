# Builds store uploads for Chrome and Firefox from the same source:
#
#   dist/chrome/                         unpacked  (chrome://extensions > Load unpacked)
#   dist/firefox/                        unpacked  (about:debugging > Load Temporary Add-on)
#   dist/nonretarded-units-<ver>-chrome.zip    Chrome Web Store upload
#   dist/nonretarded-units-<ver>-firefox.zip   addons.mozilla.org upload
#
# The repo's manifest.json is the Chrome one; the Firefox manifest is derived
# from it here so the two never drift apart. Zips are written with .NET so the
# paths inside use forward slashes (Compress-Archive in PowerShell 5.1 can write
# backslashes, which the stores reject).
#
#   powershell -ExecutionPolicy Bypass -File tools\package.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$root = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $root "dist"
$manifestText = [IO.File]::ReadAllText("$root\manifest.json")
$version = ($manifestText | ConvertFrom-Json).version

# ---------------------------------------------------------------- Firefox manifest
# (generated with Node: PowerShell 5.1's ConvertTo-Json output is hard to read)
function Get-FirefoxManifest {
  $json = (& node "$PSScriptRoot\firefox-manifest.js") -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "firefox-manifest.js failed" }
  $json + "`n"
}

# ---------------------------------------------------------------- build
function Build($target, $manifestJson) {
  $dir = Join-Path $dist $target
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  New-Item -ItemType Directory -Force $dir | Out-Null
  Copy-Item "$root\src", "$root\icons" -Destination $dir -Recurse
  [IO.File]::WriteAllText("$dir\manifest.json", $manifestJson, (New-Object Text.UTF8Encoding $false))

  $zipPath = Join-Path $dist "nonretarded-units-$version-$target.zip"
  if (Test-Path $zipPath) { Remove-Item $zipPath }
  $files = Get-ChildItem $dir -Recurse -File
  $zip = [IO.Compression.ZipFile]::Open($zipPath, "Create")
  try {
    foreach ($f in $files) {
      $rel = $f.FullName.Substring($dir.Length + 1).Replace("\", "/")
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $rel, "Optimal") | Out-Null
    }
  } finally { $zip.Dispose() }
  "Built $target  ->  $zipPath ($([math]::Round((Get-Item $zipPath).Length / 1KB)) KB, $($files.Count) files)"
}

New-Item -ItemType Directory -Force $dist | Out-Null
# remove the single zip produced by older versions of this script
Get-ChildItem $dist -Filter "nonretarded-units-*.zip" | Where-Object { $_.Name -notmatch "-(chrome|firefox)\.zip$" } | Remove-Item

Build "chrome" $manifestText
Build "firefox" (Get-FirefoxManifest)
