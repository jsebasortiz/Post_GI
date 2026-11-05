namespace BlogApp.Services;

public record StoredFileInfo(
    string ArchivoUrl,
    string ArchivoNombreOriginal,
    string MimeType,
    ulong TamanioBytes
);

public interface IFileStorageService
{
    Task<StoredFileInfo> SaveFileAsync(IFormFile file, string subDirectory = "posts");
    bool DeleteFile(string relativeUrl);
}

public class FileStorageService : IFileStorageService
{
    private readonly IWebHostEnvironment _env;

    public FileStorageService(IWebHostEnvironment env)
    {
        _env = env;
    }

    public async Task<StoredFileInfo> SaveFileAsync(IFormFile file, string subDirectory = "posts")
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("El archivo está vacío o no fue enviado.");
        }

        // Crear estructura de directorios wwwroot/uploads/{subDirectory}/{yyyy}/{MM}
        var now = DateTime.UtcNow;
        var folderRelativePath = Path.Combine(
            "uploads",
            subDirectory,
            now.ToString("yyyy"),
            now.ToString("MM")
        );
        var uploadsFolder = Path.Combine(
            _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            folderRelativePath
        );

        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        // Si es una imagen soportada, optimizar y convertir a WebP
        Stream uploadStream;
        string finalMimeType;
        string finalExtension;
        long finalLength;
        bool isCustomStream = false;

        if (ImageOptimizationHelper.IsSupportedImage(file.FileName, file.ContentType))
        {
            try
            {
                var opt = await ImageOptimizationHelper.OptimizeToWebpAsync(file);
                uploadStream = opt.Stream;
                finalMimeType = opt.ContentType;
                finalExtension = opt.Extension;
                finalLength = opt.Size;
                isCustomStream = true;
            }
            catch
            {
                uploadStream = file.OpenReadStream();
                finalMimeType = file.ContentType ?? "application/octet-stream";
                finalExtension = Path.GetExtension(file.FileName);
                finalLength = file.Length;
            }
        }
        else
        {
            uploadStream = file.OpenReadStream();
            finalMimeType = file.ContentType ?? "application/octet-stream";
            finalExtension = Path.GetExtension(file.FileName);
            finalLength = file.Length;
        }

        try
        {
            // Generar nombre de archivo único para evitar colisiones
            var uniqueFileName = $"{Guid.NewGuid():N}{finalExtension}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await uploadStream.CopyToAsync(fileStream);
            }

            var relativeUrl = $"/{folderRelativePath.Replace('\\', '/')}/{uniqueFileName}";

            return new StoredFileInfo(
                ArchivoUrl: relativeUrl,
                ArchivoNombreOriginal: file.FileName,
                MimeType: finalMimeType,
                TamanioBytes: (ulong)finalLength
            );
        }
        finally
        {
            if (isCustomStream)
            {
                await uploadStream.DisposeAsync();
            }
        }
    }

    public bool DeleteFile(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl))
            return false;

        var cleanPath = relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(
            _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            cleanPath
        );

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return true;
        }

        return false;
    }
}
