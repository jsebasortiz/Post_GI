using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

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

            // Optimización de imágenes a WebP
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
                // 2. Definir ruta y nombre de Blob único: {subDirectory}/{yyyy}/{MM}/{guid}{ext}
                var now = DateTime.UtcNow;
                var blobName = $"{subDirectory}/{now:yyyy}/{now:MM}/{Guid.NewGuid():N}{finalExtension}";
                var blobClient = containerClient.GetBlobClient(blobName);

                // 3. Subir el archivo directamente a Azure Storage con ContentType adecuado
                var headers = new BlobHttpHeaders
                {
                    ContentType = finalMimeType
                };

                await blobClient.UploadAsync(uploadStream, new BlobUploadOptions
                {
                    HttpHeaders = headers
                });

                // 4. Generar URL segura con SAS Token (Shared Access Signature) para lecturas
                var blobUrl = GetSasUrl(blobClient);
                Console.WriteLine($"[Azure Blob SUCCESS] Archivo subido a Azure con SAS Token: {blobUrl}");
                _logger.LogInformation("[Azure Blob] Archivo subido exitosamente a Azure: {BlobUrl}", blobUrl);

                return new StoredFileInfo(
                    ArchivoUrl: blobUrl,
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
        catch (Exception ex)
        {
            Console.WriteLine($"[Azure Blob ERROR] Fallo al subir archivo a Azure Storage: {ex.Message}");
            _logger.LogError(ex, "[Azure Blob] Error al subir el archivo a Azure Storage. Usando fallback a almacenamiento local.");
            return await _localStorageService.SaveFileAsync(file, subDirectory);
        }
    }

    private string GetSasUrl(BlobClient blobClient)
    {
        try
        {
            if (blobClient.CanGenerateSasUri)
            {
                var sasBuilder = new BlobSasBuilder
                {
                    BlobContainerName = blobClient.BlobContainerName,
                    BlobName = blobClient.Name,
                    Resource = "b",
                    ExpiresOn = DateTimeOffset.UtcNow.AddYears(10)
                };

                sasBuilder.SetPermissions(BlobSasPermissions.Read);
                return blobClient.GenerateSasUri(sasBuilder).ToString();
            }

            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Azure Blob] No se pudo generar SAS Token con credenciales compartidas. Usando URI directa.");
            return blobClient.Uri.ToString();
        }
    }

    public bool DeleteFile(string relativeUrl)
    {
        if (string.IsNullOrWhiteSpace(relativeUrl))
            return false;

        // Si es URL de Azure Blob Storage
        if (relativeUrl.Contains(".blob.core.windows.net"))
        {
            try
            {
                if (string.IsNullOrWhiteSpace(_connectionString))
                    return false;

                var uri = new Uri(relativeUrl);
                var blobName = uri.AbsolutePath.TrimStart('/');
                var firstSlash = blobName.IndexOf('/');
                if (firstSlash >= 0)
                {
                    blobName = blobName.Substring(firstSlash + 1);
                }

                var containerClient = new BlobContainerClient(_connectionString, _containerName);
                var blobClient = containerClient.GetBlobClient(blobName);
                return blobClient.DeleteIfExists();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Azure Blob] Error al eliminar el blob: {Url}", relativeUrl);
                return false;
            }
        }

        return _localStorageService.DeleteFile(relativeUrl);
    }
}
