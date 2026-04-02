param(
    [Parameter(Mandatory = $true)]
    [string]$IconPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function New-SquareBitmap {
    param(
        [System.Drawing.Bitmap]$Source,
        [int]$Size,
        [int]$Padding
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $bmp.SetResolution(96, 96)

    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $targetSize = $Size - ($Padding * 2)
    $x = [int](($Size - $targetSize) / 2)
    $y = [int](($Size - $targetSize) / 2)
    $graphics.DrawImage($Source, $x, $y, $targetSize, $targetSize)
    $graphics.Dispose()

    return $bmp
}

$stream = [System.IO.File]::OpenRead($IconPath)
try {
    $icon = New-Object System.Drawing.Icon($stream)
    $source = $icon.ToBitmap()
} finally {
    $stream.Dispose()
}

$drawableDir = Join-Path $OutputRoot 'drawable'
$mipmapMap = @{
    'mipmap-mdpi'    = 48
    'mipmap-hdpi'    = 72
    'mipmap-xhdpi'   = 96
    'mipmap-xxhdpi'  = 144
    'mipmap-xxxhdpi' = 192
}

New-Item -ItemType Directory -Force -Path $drawableDir | Out-Null

$adaptive = New-SquareBitmap -Source $source -Size 432 -Padding 42
$adaptive.Save((Join-Path $drawableDir 'ic_launcher_foreground_image.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$adaptive.Dispose()

foreach ($entry in $mipmapMap.GetEnumerator()) {
    $dir = Join-Path $OutputRoot $entry.Key
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    $png = New-SquareBitmap -Source $source -Size $entry.Value -Padding ([Math]::Max([int]($entry.Value * 0.1), 4))
    $png.Save((Join-Path $dir 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $png.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $png.Dispose()
}

$source.Dispose()
