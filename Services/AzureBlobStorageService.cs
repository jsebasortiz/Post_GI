using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace BlogApp.Services;

public class AzureBlobStorageService : IFileStorageService
{
    private readonly string? _connectionString;
    private readonly string _containerName;
    private readonly IWebHostEnvironment _env;
    private readonly FileStorageService _localStorageService;
    private readonly ILogger<AzureBlobStorageService> _logger;

    public AzureBlobStorageService(
        IConfiguration configuration,
        IWebHostEnvironment env,
        ILogger<AzureBlobStorageService> logger)
    {
        _env = env;
        _logger = logger;
        _localStorageService = new FileStorageService(env);

        _connectionString = configuration["AzureStorage:ConnectionString"];
        _containerName = configuration["AzureStorage:ContainerName"] ?? "blog-uploads";
    }

    public async Task<StoredFileInfo> SaveFileAsync(IFormFile file, string subDirectory = "posts")
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("El archivo está vacío o no fue enviado.");
        }

        // Si no hay Cadena de Conexión de Azure configurada, usar almacenamiento local en wwwroot
        if (string.IsNullOrWhiteSpace(_connectionString))
        {
            _logger.LogInformation("[FileStorage] Cadena de conexión de Azure Blob Storage no configurada. Guardando archivo en almacenamiento local.");
            return await _localStorageService.SaveFileAsync(file, subDirectory);
        }

        try
        {
            // 1. Conectar con el contenedor de Azure Blob Storage
            var containerClient = new BlobContainerClient(_connectionString, _containerName);
            try
            {
                await containerClient.CreateIfNotExistsAsync();
            }
            catch (Exception exAccess)
            {
                _logger.LogWarning("[Azure Blob] Advertencia en CreateIfNotExists: {Message}", exAccess.Message);
            }

            // 2. Definir ruta y nombre de Blob único: {subDirectory}/{yyyy}/{MM}/{guid}{ext}
            var now = DateTime.UtcNow;
            var extension = Path.GetExtension(file.FileName);
            var blobName = $"{subDirectory}/{now:yyyy}/{now:MM}/{Guid.NewGuid():N}{extension}";

            var blobClient = containerClient.GetBlobClient(blobName);

            // 3. Subir el archivo directamente a Azure Storage con ContentType adecuado
            using (var stream = file.OpenReadStream())
            {
                var headers = new BlobHttpHeaders
                {
                    ContentType = file.ContentType ?? "application/octet-stream"
                };

                await blobClient.UploadAsync(stream, new BlobUploadOptions
                {
                    HttpHeaders = headers
                });
            }

            var blobUrl = blobClient.Uri.ToString();
            Console.WriteLine($"[Azure Blob SUCCESS] Archivo subido a Azure: {blobUrl}");
            _logger.LogInformation("[Azure Blob] Archivo subido exitosamente a Azure: {BlobUrl}", blobUrl);

            return new StoredFileInfo(
                ArchivoUrl: blobUrl,
                ArchivoNombreOriginal: file.FileName,
                MimeType: file.ContentType ?? "application/octet-stream",
                TamanioBytes: (ulong)file.Length
            );
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Azure Blob ERROR] Fallo al subir archivo a Azure Storage: {ex.Message}");
            _logger.LogError(ex, "[Azure Blob] Error al subir el archivo a Azure Storage. Usando fallback a almacenamiento local.");
            return await _localStorageService.SaveFileAsync(file, subDirectory);
        }
    }

    public bool DeleteFile(string relativeOrAbsoluteUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeOrAbsoluteUrl))
            return false;

        if (string.IsNullOrWhiteSpace(_connectionString) || !relativeOrAbsoluteUrl.StartsWith("http"))
        {
            return _localStorageService.DeleteFile(relativeOrAbsoluteUrl);
        }

        try
        {
            var containerClient = new BlobContainerClient(_connectionString, _containerName);
            var uri = new Uri(relativeOrAbsoluteUrl);
            var blobName = uri.AbsolutePath.TrimStart('/');

            // Si la ruta incluye el nombre del contenedor
            if (blobName.StartsWith(_containerName + "/"))
            {
                blobName = blobName.Substring(_containerName.Length + 1);
            }

            var blobClient = containerClient.GetBlobClient(blobName);
            return blobClient.DeleteIfExists().Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Azure Blob] Error al eliminar el blob de Azure Storage: {Url}", relativeOrAbsoluteUrl);
            return false;
        }
    }
}
