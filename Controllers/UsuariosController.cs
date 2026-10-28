using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsuariosController : ControllerBase
{
    private readonly IUsuarioService _usuarioService;
    private readonly IConfiguration _configuration;

    public UsuariosController(IUsuarioService usuarioService, IConfiguration configuration)
    {
        _usuarioService = usuarioService;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsuarios()
    {
        var usuarios = await _usuarioService.GetUsuariosAsync();
        return Ok(usuarios);
    }

    [AllowAnonymous]
    [HttpPost("registro")]
    public async Task<IActionResult> Register([FromBody] CreateUsuarioDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nombre) || string.IsNullOrWhiteSpace(dto.Correo) || string.IsNullOrWhiteSpace(dto.Password))
        {
            return BadRequest(new { message = "Todos los campos son obligatorios." });
        }

        try
        {
            var user = await _usuarioService.RegisterAsync(dto);
            return Ok(user);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpGet("auth-config")]
    public IActionResult GetAuthConfig()
    {
        var clientId = _configuration["Microsoft365:ClientId"] ?? "";
        var tenantId = _configuration["Microsoft365:TenantId"] ?? "common";
        var allowedDomain = _configuration["Microsoft365:AllowedDomain"] ?? "centroaguas.com";
        var isConfigured = !string.IsNullOrWhiteSpace(clientId) && !clientId.Contains("CONFIGURAR_") && !clientId.Contains("YOUR_");

        return Ok(new AuthConfigDto
        {
            ClientId = clientId,
            TenantId = tenantId,
            AllowedDomain = allowedDomain,
            IsConfigured = isConfigured
        });
    }

    [AllowAnonymous]
    [HttpPost("microsoft-login")]
    public async Task<IActionResult> MicrosoftLogin([FromBody] MicrosoftLoginDto dto)
    {
        try
        {
            var response = await _usuarioService.LoginWithMicrosoftAsync(dto);
            if (response == null)
            {
                return Unauthorized(new { message = "No fue posible autenticar con Microsoft 365." });
            }

            return Ok(response);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Error durante la autenticación: {ex.Message}" });
        }
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var response = await _usuarioService.LoginAsync(dto);
        if (response == null)
        {
            return Unauthorized(new { message = "Credenciales incorrectas o usuario no encontrado." });
        }

        return Ok(response);
    }
}


