# Erzeugt die App-Icons (ruhiger Ring mit Punkt auf dunklem Grund).
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-Icon([int]$size, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(17, 19, 21))
  $c = [System.Drawing.Color]::FromArgb(138, 185, 166)
  $pen = New-Object System.Drawing.Pen $c, ([float]($size * 0.07))
  $r = $size * 0.26; $m = $size / 2
  $g.DrawEllipse($pen, [float]($m - $r), [float]($m - $r), [float](2 * $r), [float](2 * $r))
  $brush = New-Object System.Drawing.SolidBrush $c
  $d = $size * 0.085
  $g.FillEllipse($brush, [float]($m - $d), [float]($m - $d), [float](2 * $d), [float](2 * $d))
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Icon 180 'apple-touch-icon.png'
New-Icon 192 'icon-192.png'
New-Icon 512 'icon-512.png'
