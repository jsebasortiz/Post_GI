Add-Type -AssemblyName System.Drawing

$inputFile = "C:\Users\jsortiz\.gemini\antigravity-ide\brain\0088b3bc-5026-4c65-bd6c-ef89d6af9421\.user_uploaded\media_1789488129482.png"
$outputFile = "c:\Users\jsortiz\.gemini\antigravity-ide\scratch\BlogApp\wwwroot\images\logo.png"

$src = [System.Drawing.Bitmap]::FromFile($inputFile)
$bmp = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($x = 0; $x -lt $src.Width; $x++) {
    for ($y = 0; $y -lt $src.Height; $y++) {
        $pixel = $src.GetPixel($x, $y)
        $r = $pixel.R
        $g = $pixel.G
        $b = $pixel.B
        $brightness = ($r + $g + $b) / 3.0

        if ($brightness -gt 248) {
            # Fully transparent background
            $newColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
        } elseif ($brightness -gt 210) {
            # Soft threshold transition
            $alpha = [int](255 * ($brightness - 210) / 38.0)
            $alphaVal = 255 - $alpha
            if ($alphaVal -lt 0) { $alphaVal = 0 }
            if ($alphaVal -gt 255) { $alphaVal = 255 }
            
            # Preserve color while setting alpha
            $newColor = [System.Drawing.Color]::FromArgb($alphaVal, $r, $g, $b)
        } else {
            $newColor = [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
        }
        $bmp.SetPixel($x, $y, $newColor)
    }
}

$src.Dispose()
$bmp.Save($outputFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Prixma prism logo with transparent background saved to $outputFile"
