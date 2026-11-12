# Renders the Chrome Web Store small promo tile: store/promo-440x280.png
#   powershell -ExecutionPolicy Bypass -File tools\promo-tile.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force "$root\store" | Out-Null

$W = 440; $H = 280
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = "AntiAlias"
$g.InterpolationMode = "HighQualityBicubic"
$g.PixelOffsetMode = "HighQuality"
$g.TextRenderingHint = "AntiAliasGridFit"

function C($hex, $a = 255) {
  $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
  [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B)
}
function RoundRect($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2*$r, 2*$r, 180, 90)
  $p.AddArc($x + $w - 2*$r, $y, 2*$r, 2*$r, 270, 90)
  $p.AddArc($x + $w - 2*$r, $y + $h - 2*$r, 2*$r, 2*$r, 0, 90)
  $p.AddArc($x, $y + $h - 2*$r, 2*$r, 2*$r, 90, 90)
  $p.CloseFigure(); $p
}

# background: navy gradient matching the portrait
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $W, $H), (C "#18306b"), (C "#0a1533")
$g.FillRectangle($bg, 0, 0, $W, $H)

# portrait in an amber ring
$size = 150; $px = 28; $py = [int](($H - $size) / 2)
$g.FillEllipse((New-Object System.Drawing.SolidBrush (C "#ffc400")), $px - 4, $py - 4, $size + 8, $size + 8)
$clip = New-Object System.Drawing.Drawing2D.GraphicsPath
$clip.AddEllipse($px, $py, $size, $size)
$g.SetClip($clip)
$img = [System.Drawing.Image]::FromFile("$root\icons\icon256.png")
$g.DrawImage($img, $px, $py, $size, $size)
$g.ResetClip()
$img.Dispose()

# text
$x = 204
$white = New-Object System.Drawing.SolidBrush (C "#f0f3f6")
$muted = New-Object System.Drawing.SolidBrush (C "#aab6d3")
$g.DrawString("nonretarded-units", (New-Object System.Drawing.Font "Segoe UI", 15.5, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)), $white, $x - 2, 62)
$g.DrawString("Imperial in. Metric out.", (New-Object System.Drawing.Font "Segoe UI", 13, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)), $muted, $x, 86)

# example conversions:  5 ft -> [1.524 m]
$fontEx = New-Object System.Drawing.Font "Segoe UI Semibold", 17, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$fontStrike = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Strikeout), ([System.Drawing.GraphicsUnit]::Pixel)
$hl = New-Object System.Drawing.SolidBrush (C "#ffc400" 70)
$amber = New-Object System.Drawing.SolidBrush (C "#ffc400")
# non-ASCII via char codes: PowerShell 5.1 reads BOM-less scripts as ANSI
$deg = [string][char]0x00B0
$rows = @(@("5 ft", "1.524 m"), @("72${deg}F", "22 ${deg}C"), @("12 oz", "340 g"))
$y = 128
foreach ($r in $rows) {
  $g.DrawString($r[0], $fontStrike, $muted, $x, $y + 2)
  $g.DrawString([string][char]0x2192, $fontEx, $amber, $x + 52, $y)
  $tw = $g.MeasureString($r[1], $fontEx).Width
  $path = RoundRect ($x + 80) ($y + 1) ($tw + 4) 25 5
  $g.FillPath($hl, $path)
  $g.DrawString($r[1], $fontEx, $white, $x + 82, $y)
  $y += 34
}

$out = "$root\store\promo-440x280.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"Saved $out"
