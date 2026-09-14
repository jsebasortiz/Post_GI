namespace BlogApp.Services;

public record StoredFileInfo(string ArchivoUrl, string ArchivoNombreOriginal, string MimeType, ulong TamanioBytes);

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
        var folderRelativePath = Path.Combine("uploads", subDirectory, now.ToString("yyyy"), now.ToString("MM"));
        var uploadsFolder = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), folderRelativePath);

        if (!Directory.Exists(uploadsFolder))
        {
            Directory.CreateDirectory(uploadsFolder);
        }

        // Generar nombre de archivo único para evitar colisiones
        var extension = Path.GetExtension(file.FileName);
        var uniqueFileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(uploadsFolder, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var relativeUrl = $"/{folderRelativePath.Replace('\\', '/')}/{uniqueFileName}";

        return new StoredFileInfo(
            ArchivoUrl: relativeUrl,
            ArchivoNombreOriginal: file.FileName,
            MimeType: file.ContentType ?? "application/octet-stream",
            TamanioBytes: (ulong)file.Length
        );
    }

    public bool DeleteFile(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl)) return false;

        var cleanPath = relativeUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(_env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), cleanPath);

        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            return true;
        }

        return false;
    }
}
