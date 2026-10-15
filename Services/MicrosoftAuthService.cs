using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Text.Json;

namespace BlogApp.Services;

public record MicrosoftUserInfo(
    string Email,
    string DisplayName,
    string Oid,
    bool IsAuthenticated,
    string? ErrorMessage = null
);

public interface IMicrosoftAuthService
{
    Task<MicrosoftUserInfo> AuthenticateAsync(string idToken, string? accessToken = null);
}

public class MicrosoftAuthService : IMicrosoftAuthService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<MicrosoftAuthService> _logger;

    public MicrosoftAuthService(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<MicrosoftAuthService> logger)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<MicrosoftUserInfo> AuthenticateAsync(string idToken, string? accessToken = null)
    {
        var clientId = _configuration["Microsoft365:ClientId"] ?? "";
        var tenantId = _configuration["Microsoft365:TenantId"] ?? "common";

        if (string.IsNullOrWhiteSpace(clientId) || clientId.Contains("CONFIGURAR_") || clientId.Contains("YOUR_"))
        {
            return new MicrosoftUserInfo("", "", "", false, "Microsoft 365 no ha sido configurado en el servidor. Configura el ClientId y TenantId en appsettings.json.");
        }

        string email = "";
        string displayName = "";
        string oid = "";

        // 1. Si se proporciona accessToken, validar directamente llamando a Microsoft Graph API (/v1.0/me)
        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                var response = await client.GetAsync("https://graph.microsoft.com/v1.0/me");

                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("mail", out var mailProp) && !string.IsNullOrWhiteSpace(mailProp.GetString()))
                    {
                        email = mailProp.GetString()!;
                    }
                    else if (root.TryGetProperty("userPrincipalName", out var upnProp))
                    {
                        email = upnProp.GetString() ?? "";
                    }

                    if (root.TryGetProperty("displayName", out var nameProp))
                    {
                        displayName = nameProp.GetString() ?? "";
                    }

                    if (root.TryGetProperty("id", out var idProp))
                    {
                        oid = idProp.GetString() ?? "";
                    }

                    _logger.LogInformation("Usuario validado exitosamente via Microsoft Graph API: {Email} ({Name})", email, displayName);
                    return new MicrosoftUserInfo(email, displayName, oid, true);
                }
                else
                {
                    _logger.LogWarning("Microsoft Graph retornó status {Status}: {Reason}", response.StatusCode, response.ReasonPhrase);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Fallo al consultar Microsoft Graph API: {Message}", ex.Message);
            }
        }

        // 2. Analizar y validar el idToken JWT
        if (!string.IsNullOrWhiteSpace(idToken))
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                if (!handler.CanReadToken(idToken))
                {
                    return new MicrosoftUserInfo("", "", "", false, "El token de identidad de Microsoft tiene un formato inválido.");
                }

                var jwtToken = handler.ReadJwtToken(idToken);

                // Validar expiración
                if (jwtToken.ValidTo < DateTime.UtcNow.AddMinutes(-5))
                {
                    return new MicrosoftUserInfo("", "", "", false, "El token de Microsoft ha expirado. Inicia sesión nuevamente.");
                }

                // Validar audiencia (ClientId) si está configurado
                if (!string.IsNullOrWhiteSpace(clientId) && !clientId.Contains("CONFIGURAR_"))
                {
                    var aud = jwtToken.Audiences.FirstOrDefault();
                    if (!string.Equals(aud, clientId, StringComparison.OrdinalIgnoreCase))
                    {
                        _logger.LogWarning("Audiencia de token inválida: {Audience} vs {ClientId}", aud, clientId);
                        return new MicrosoftUserInfo("", "", "", false, "La aplicación cliente no coincide con la registrada en el servidor.");
                    }
                }

                // Extraer claims
                email = jwtToken.Claims.FirstOrDefault(c => c.Type == "preferred_username")?.Value
                     ?? jwtToken.Claims.FirstOrDefault(c => c.Type == "email")?.Value
                     ?? jwtToken.Claims.FirstOrDefault(c => c.Type == "upn")?.Value
                     ?? "";

                displayName = jwtToken.Claims.FirstOrDefault(c => c.Type == "name")?.Value ?? "";
                oid = jwtToken.Claims.FirstOrDefault(c => c.Type == "oid")?.Value
                   ?? jwtToken.Claims.FirstOrDefault(c => c.Type == "sub")?.Value
                   ?? "";

                if (string.IsNullOrWhiteSpace(email))
                {
                    return new MicrosoftUserInfo("", "", "", false, "El token de Microsoft no contiene un correo o nombre principal válido.");
                }

                if (string.IsNullOrWhiteSpace(displayName))
                {
                    displayName = email.Split('@')[0];
                }

                _logger.LogInformation("Usuario validado exitosamente via Microsoft ID Token: {Email} ({Name})", email, displayName);
                return new MicrosoftUserInfo(email, displayName, oid, true);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error al procesar el token de Microsoft: {Message}", ex.Message);
                return new MicrosoftUserInfo("", "", "", false, $"Error validando token: {ex.Message}");
            }
        }

        return new MicrosoftUserInfo("", "", "", false, "No se recibió un token de Microsoft válido.");
    }
}
