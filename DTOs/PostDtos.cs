namespace BlogApp.DTOs;

public class CreatePostDto
{
    public ulong UsuarioId { get; set; }
    public ushort ModuloId { get; set; }
    public byte TipoId { get; set; }
    public byte? TipoConocimientoId { get; set; }
    public string? PalabrasClave { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string? Resumen { get; set; }
    public string Contenido { get; set; } = string.Empty;
    public string Estado { get; set; } = "publicado";
    public int? PortadaIndex { get; set; } = 0;
    public List<IFormFile>? Archivos { get; set; }
}

public class UpdatePostDto
{
    public ushort ModuloId { get; set; }
    public byte TipoId { get; set; }
    public byte? TipoConocimientoId { get; set; }
    public string? PalabrasClave { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string? Resumen { get; set; }
    public string Contenido { get; set; } = string.Empty;
    public string Estado { get; set; } = "publicado";
}

public class AdjuntoResponseDto
{
    public ulong Id { get; set; }
    public ulong PostId { get; set; }
    public string ArchivoUrl { get; set; } = string.Empty;
    public string ArchivoNombreOriginal { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public ulong TamanioBytes { get; set; }
    public bool EsPortada { get; set; }
    public int EstadoId { get; set; } = 1;
    public DateTime CreadoEn { get; set; }
}

public class PostResponseDto
{
    public ulong Id { get; set; }
    public ulong UsuarioId { get; set; }
    public string UsuarioNombre { get; set; } = string.Empty;
    public ushort ModuloId { get; set; }
    public string ModuloNombre { get; set; } = string.Empty;
    public string ModuloSlug { get; set; } = string.Empty;
    public string ModuloCategoriaPadre { get; set; } = string.Empty;
    public byte TipoId { get; set; }
    public string TipoNombre { get; set; } = string.Empty;
    public byte? TipoConocimientoId { get; set; }
    public string? TipoConocimientoNombre { get; set; }
    public string? PalabrasClave { get; set; }
    public byte EstadoId { get; set; } = 1;
    public string EstadoNombre { get; set; } = "Activo";
    public string Titulo { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Resumen { get; set; }
    public string Contenido { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public DateTime CreadoEn { get; set; }
    public DateTime ActualizadoEn { get; set; }
    public string? PortadaUrl { get; set; }
    public List<AdjuntoResponseDto> Adjuntos { get; set; } = new();
}
