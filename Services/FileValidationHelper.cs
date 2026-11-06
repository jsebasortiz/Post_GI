namespace BlogApp.Services;

public static class FileValidationHelper
{
    // Tamaño máximo por archivo: 25 MB
    public const long MaxFileSizeBytes = 25 * 1024 * 1024;

    // Tamaño total acumulado por post: 100 MB
    public const long MaxTotalSizeBytes = 100 * 1024 * 1024;

    // Extensiones permitidas (Lista blanca segura)
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Imágenes
        ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif",
        // Documentos
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv",
        // Archivos comprimidos
        ".zip", ".rar", ".7z"
    };

    // Extensiones bloqueadas explícitamente (ejecutables y scripts de alto riesgo)
    private static readonly HashSet<string> BlockedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".msi", ".dll", ".com", ".scr", ".pif"
    };

    public static void ValidateFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            throw new ArgumentException("El archivo seleccionado está vacío o no fue enviado.");
        }

        if (file.Length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"El archivo '{file.FileName}' supera el límite permitido de 25 MB (tamaño: {file.Length / (1024 * 1024)} MB).");
        }

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext))
        {
            throw new ArgumentException($"El archivo '{file.FileName}' no tiene una extensión válida.");
        }

        if (BlockedExtensions.Contains(ext))
        {
            throw new ArgumentException($"Por motivos de seguridad corporativa, no se admiten archivos ejecutables ni scripts ('{ext}').");
        }

        if (!AllowedExtensions.Contains(ext))
        {
            throw new ArgumentException($"El formato '{ext}' no está permitido. Formatos aceptados: imágenes, PDF, Office (Word, Excel, PowerPoint), TXT, CSV y ZIP/RAR.");
        }
    }

    public static void ValidateFilesList(List<IFormFile>? files)
    {
        if (files == null || files.Count == 0) return;

        if (files.Count > 15)
        {
            throw new ArgumentException("No puedes adjuntar más de 15 archivos en una sola publicación.");
        }

        long totalSize = 0;
        foreach (var file in files)
        {
            ValidateFile(file);
            totalSize += file.Length;
        }

        if (totalSize > MaxTotalSizeBytes)
        {
            throw new ArgumentException($"El peso total de los archivos ({totalSize / (1024 * 1024)} MB) excede el máximo permitido de 100 MB.");
        }
    }

    public static string SanitizeFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return "archivo";
        var safe = Path.GetFileName(fileName);
        foreach (char c in Path.GetInvalidFileNameChars())
        {
            safe = safe.Replace(c, '_');
        }
        return safe.Trim();
    }
}

