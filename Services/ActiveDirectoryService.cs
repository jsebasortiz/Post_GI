using System.DirectoryServices.Protocols;
using System.Net;

namespace BlogApp.Services;

public record AdUserInfo(string Username, string DisplayName, string Email, bool IsAuthenticated);

public interface IActiveDirectoryService
{
    Task<AdUserInfo> AuthenticateAsync(string username, string password);
}

public class ActiveDirectoryService : IActiveDirectoryService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ActiveDirectoryService> _logger;

    public ActiveDirectoryService(
        IConfiguration configuration,
        ILogger<ActiveDirectoryService> logger
    )
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AdUserInfo> AuthenticateAsync(string username, string password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            return new AdUserInfo(username, "", "", false);
        }

        var server = _configuration["ActiveDirectory:Server"] ?? "cag01.centroaguas.com";
        var portStr = _configuration["ActiveDirectory:Port"] ?? "389";
        int.TryParse(portStr, out int port);
        if (port == 0)
            port = 389;

        var domain = _configuration["ActiveDirectory:Domain"] ?? "CENTROAGUAS";
        var baseDn = _configuration["ActiveDirectory:BaseDn"] ?? "DC=centroaguas,DC=com";

        // Formatear nombre de usuario para AD
        string cleanUsername = username.Trim();
        if (cleanUsername.Contains('\\'))
        {
            cleanUsername = cleanUsername.Split('\\')[1];
        }
        else if (cleanUsername.Contains('@'))
        {
            cleanUsername = cleanUsername.Split('@')[0];
        }

        string adUserPrincipal = $"{domain}\\{cleanUsername}";
        string adUserEmail = $"{cleanUsername}@centroaguas.com";
        string displayName = cleanUsername;

        try
        {
            var identifier = new LdapDirectoryIdentifier(server, port);
            using var connection = new LdapConnection(identifier) { AuthType = AuthType.Basic };

            connection.SessionOptions.ProtocolVersion = 3;
            // Autenticar credenciales del usuario en LDAP / Active Directory
            var credential = new NetworkCredential(adUserPrincipal, password);
            connection.Bind(credential);

            _logger.LogInformation(
                "Autenticación LDAP exitosa para usuario AD: {User}",
                adUserPrincipal
            );

            // Intentar buscar atributos adicionales (displayName, mail) usando la conexión autenticada
            try
            {
                var filter = $"(&(objectClass=user)(sAMAccountName={cleanUsername}))";
                var searchRequest = new SearchRequest(
                    baseDn,
                    filter,
                    SearchScope.Subtree,
                    "displayName",
                    "mail",
                    "cn",
                    "sAMAccountName"
                );

                var response = (SearchResponse)connection.SendRequest(searchRequest);
                if (response.Entries.Count > 0)
                {
                    var entry = response.Entries[0];
                    if (
                        entry.Attributes.Contains("displayName")
                        && entry.Attributes["displayName"].Count > 0
                    )
                    {
                        displayName =
                            entry.Attributes["displayName"][0].ToString() ?? cleanUsername;
                    }
                    else if (entry.Attributes.Contains("cn") && entry.Attributes["cn"].Count > 0)
                    {
                        displayName = entry.Attributes["cn"][0].ToString() ?? cleanUsername;
                    }

                    if (entry.Attributes.Contains("mail") && entry.Attributes["mail"].Count > 0)
                    {
                        adUserEmail = entry.Attributes["mail"][0].ToString() ?? adUserEmail;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    "No se pudieron obtener atributos extendidos de LDAP: {Message}",
                    ex.Message
                );
            }

            return new AdUserInfo(cleanUsername, displayName, adUserEmail, true);
        }
        catch (LdapException ex)
        {
            _logger.LogWarning(
                "Fallo de autenticación LDAP para {User}: {Message} (Código: {ResultCode})",
                adUserPrincipal,
                ex.Message,
                ex.ErrorCode
            );
            return new AdUserInfo(cleanUsername, "", "", false);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                "Error conectando al servidor de Directorio Activo {Server}: {Message}",
                server,
                ex.Message
            );
            return new AdUserInfo(cleanUsername, "", "", false);
        }
    }
}
