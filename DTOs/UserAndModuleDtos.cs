namespace BlogApp.DTOs;

public class CreateModuloDto
{
    public string Nombre { get; set; } = string.Empty;
    public string CategoriaPadre { get; set; } = "apps";
    public string? Descripcion { get; set; }
}

public class UpdateModuloDto
{
    public string Nombre { get; set; } = string.Empty;
    public string CategoriaPadre { get; set; } = "apps";
    public string? Descripcion { get; set; }
}

public class ModuloResponseDto
{
    public ushort Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string CategoriaPadre { get; set; } = "apps";
    public string? Descripcion { get; set; }
    public byte EstadoId { get; set; } = 1;
    public string EstadoNombre { get; set; } = "Activo";
    public bool Estado => EstadoId == 1;
    public DateTime CreadoEn { get; set; }
}

public class CreatePostTipoDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public byte? RolId { get; set; }
}

public class CreateTipoConocimientoDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
}

public class CreateUsuarioDto
{
    public string Nombre { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginDto
{
    public string Correo { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class UsuarioResponseDto
{
    public ulong Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public byte RolId { get; set; }
    public string RolNombre { get; set; } = string.Empty;
    public List<string> Permisos { get; set; } = new();
    public DateTime CreadoEn { get; set; }
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public UsuarioResponseDto Usuario { get; set; } = new();
}

