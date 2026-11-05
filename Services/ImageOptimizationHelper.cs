using SkiaSharp;

namespace BlogApp.Services;

public static class ImageOptimizationHelper
{
    private static readonly HashSet<string> SupportedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".bmp", ".webp"
    };

    public static bool IsSupportedImage(string fileName, string? mimeType)
    {
        var ext = Path.GetExtension(fileName);
        if (!string.IsNullOrEmpty(ext) && SupportedImageExtensions.Contains(ext))
        {
            return true;
        }

        if (!string.IsNullOrEmpty(mimeType) && mimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
        {
            return !mimeType.Contains("svg", StringComparison.OrdinalIgnoreCase) 
                && !mimeType.Contains("gif", StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    /// <summary>
    /// Redimensiona la imagen respetando su relación de aspecto (max 1920x1080)
    /// y la codifica en formato WebP con compresión de alta calidad (82%),
    /// reduciendo drásticamente su tamaño.
    /// </summary>
    public static async Task<(Stream Stream, string ContentType, string Extension, long Size)> OptimizeToWebpAsync(
        IFormFile file, 
        int maxWidth = 1920, 
        int maxHeight = 1080, 
        int quality = 82)
    {
        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        memoryStream.Position = 0;

        using var originalBitmap = SKBitmap.Decode(memoryStream);
        if (originalBitmap == null)
        {
            // Si SkiaSharp no pudo decodificar, retornar el stream original sin alterar
            var fallbackStream = file.OpenReadStream();
            return (fallbackStream, file.ContentType ?? "application/octet-stream", Path.GetExtension(file.FileName), file.Length);
        }

        int origWidth = originalBitmap.Width;
        int origHeight = originalBitmap.Height;

        // Calcular nuevas dimensiones si excede el tamaño máximo
        int targetWidth = origWidth;
        int targetHeight = origHeight;

        if (origWidth > maxWidth || origHeight > maxHeight)
        {
            double ratioX = (double)maxWidth / origWidth;
            double ratioY = (double)maxHeight / origHeight;
            double ratio = Math.Min(ratioX, ratioY);

            targetWidth = Math.Max(1, (int)(origWidth * ratio));
            targetHeight = Math.Max(1, (int)(origHeight * ratio));
        }

        SKBitmap finalBitmap = originalBitmap;
        bool needsDispose = false;

        if (targetWidth != origWidth || targetHeight != origHeight)
        {
            var samplingOptions = new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear);
            finalBitmap = originalBitmap.Resize(new SKImageInfo(targetWidth, targetHeight), samplingOptions);
            needsDispose = true;
        }

        try
        {
            using var image = SKImage.FromBitmap(finalBitmap);
            var webpData = image.Encode(SKEncodedImageFormat.Webp, quality);

            var outputStream = new MemoryStream();
            webpData.SaveTo(outputStream);
            outputStream.Position = 0;

            return (outputStream, "image/webp", ".webp", outputStream.Length);
        }
        finally
        {
            if (needsDispose && finalBitmap != null)
            {
                finalBitmap.Dispose();
            }
        }
    }
}

