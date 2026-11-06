using System.ComponentModel.DataAnnotations;

namespace BlogApp.DTOs;

public class CreateModuloDto
{
    [Required(ErrorMessage = "El nombre del módulo es requerido.")]
    [StringLength(100, MinimumLength = 3, ErrorMessage = "El nombre debe tener entre 3 y 100 caracteres.")]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "La categoría padre es requerida.")]
    [StringLength(50, ErrorMessage = "La categoría padre no puede superar 50 caracteres.")]
    public string CategoriaPadre { get; set; } = "apps";

    [MaxLength(500, ErrorMessage = "La descripción no puede superar 500 caracteres.")]
    public string? Descripcion { get; set; }
}

public class UpdateModuloDto
{
    [Required(ErrorMessage = "El nombre del módulo es requerido.")]
    [StringLength(100, MinimumLength = 3, ErrorMessage = "El nombre debe tener entre 3 y 100 caracteres.")]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "La categoría padre es requerida.")]
    [StringLength(50, ErrorMessage = "La categoría padre no puede superar 50 caracteres.")]
    public string CategoriaPadre { get; set; } = "apps";

    [MaxLength(500, ErrorMessage = "La descripción no puede superar 500 caracteres.")]
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
    [Required(ErrorMessage = "El nombre del tipo es requerido.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 100 caracteres.")]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "La descripción no puede superar 500 caracteres.")]
    public string? Descripcion { get; set; }

    public byte? RolId { get; set; }
}

public class CreateTipoConocimientoDto
{
    [Required(ErrorMessage = "El nombre del tipo de conocimiento es requerido.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 100 caracteres.")]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "La descripción no puede superar 500 caracteres.")]
    public string? Descripcion { get; set; }
}

public class CreateUsuarioDto
{
    [Required(ErrorMessage = "El nombre del usuario es requerido.")]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "El correo institucional es requerido.")]
    [EmailAddress(ErrorMessage = "El formato de correo no es válido.")]
    public string Correo { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}

public class LoginDto
{
    [Required(ErrorMessage = "El correo es requerido.")]
    [EmailAddress(ErrorMessage = "El formato de correo no es válido.")]
    public string Correo { get; set; } = string.Empty;

    [Required(ErrorMessage = "La contraseña es requerida.")]
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

public class MicrosoftLoginDto
{
    [Required(ErrorMessage = "El token de Microsoft es requerido.")]
    public string IdToken { get; set; } = string.Empty;
    public string? AccessToken { get; set; }
}

public class AuthConfigDto
{
    public string ClientId { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public string AllowedDomain { get; set; } = string.Empty;
    public bool IsConfigured { get; set; }
}
