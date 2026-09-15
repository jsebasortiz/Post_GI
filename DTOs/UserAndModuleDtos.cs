namespace BlogApp.DTOs;

public class CreateModuloDto
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
    public bool Estado { get; set; }
    public DateTime CreadoEn { get; set; }
}

public class CreatePostTipoDto
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
