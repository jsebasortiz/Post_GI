namespace BlogApp.DTOs;

public class CreateAreaDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
}

public class UpdateAreaDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
}

public class AreaResponseDto
{
    public ushort Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public byte EstadoId { get; set; }
    public string EstadoNombre { get; set; } = "Activo";
    public DateTime CreadoEn { get; set; }
}
