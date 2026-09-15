namespace BlogApp.DTOs;

public class PermisoDto
{
    public ushort Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
}

public class RolResponseDto
{
    public byte Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public List<PermisoDto> Permisos { get; set; } = new();
}

public class CreateRolDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public List<ushort> PermisosIds { get; set; } = new();
}

public class UpdateRolPermisosDto
{
    public List<ushort> PermisosIds { get; set; } = new();
}

public class AssignUsuarioRolDto
{
    public ulong UsuarioId { get; set; }
    public byte RolId { get; set; }
}
