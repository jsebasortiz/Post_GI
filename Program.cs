using BlogApp.Data;
using BlogApp.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using MySqlConnector;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=centroagsapo.mysql.database.azure.com;Port=3306;Database=blog_db;Uid=adminaurora;Pwd=b4s3d4t0sAurora2025;SslMode=Preferred;";

bool useMySql = false;
try
{
    using var testConn = new MySqlConnection(connectionString);
    testConn.Open();
    useMySql = true;
    Console.WriteLine("[Database] Conexión a MySQL exitosa.");
}
catch (Exception ex)
{
    Console.WriteLine($"[Database] Nota: MySQL no está accesible localmente ({ex.Message}). Usando proveedor InMemory compartido para desarrollo.");
}

var inMemoryRoot = new InMemoryDatabaseRoot();

if (useMySql)
{
    builder.Services.AddDbContext<BlogDbContext>(options =>
        options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));
}
else
{
    builder.Services.AddDbContext<BlogDbContext>(options =>
        options.UseInMemoryDatabase("BlogAppSharedDb", inMemoryRoot));
}

builder.Services.AddHttpClient();
builder.Services.AddMemoryCache();

// Registro de servicios de la aplicación
builder.Services.AddHttpClient();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IMicrosoftAuthService, MicrosoftAuthService>();
builder.Services.AddScoped<IFileStorageService, AzureBlobStorageService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IModuloService, ModuloService>();
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<IUsuarioService, UsuarioService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IPostChatService, PostChatService>();

// Configuración de Autenticación JWT Bearer
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"] ?? "BlogApp_Prixma_Super_Secret_JWT_Signing_Key_2026_SecureKey!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "BlogAppAPI";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "BlogAppClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey))
    };

    options.Events = new JwtBearerEvents
    {
        OnChallenge = async context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/problem+json";

            var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
            {
                Status = 401,
                Title = "No autorizado",
                Detail = "Acceso denegado. Se requiere un token JWT válido para acceder a este recurso.",
                Instance = context.Request.Path
            };

            var json = System.Text.Json.JsonSerializer.Serialize(problem, new System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
            });

            await context.Response.WriteAsync(json);
        },
        OnForbidden = async context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/problem+json";

            var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
            {
                Status = 403,
                Title = "Acceso prohibido",
                Detail = "No tienes los permisos necesarios para acceder a este recurso.",
                Instance = context.Request.Path
            };

            var json = System.Text.Json.JsonSerializer.Serialize(problem, new System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase
            });

            await context.Response.WriteAsync(json);
        }
    };
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "BlogApp API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Ingresa el token JWT en el formato: Bearer {token}",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer"),
            new List<string>()
        }
    });
});

var app = builder.Build();

// Middleware Global de Manejo de Excepciones (RFC 7807)
app.UseMiddleware<BlogApp.Middleware.GlobalExceptionMiddleware>();

// Inicialización de datos semilla
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<BlogDbContext>();
    await DbInitializer.SeedAsync(context);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapFallbackToFile("index.html");

Console.WriteLine("=================================================");
Console.WriteLine("  Prixma .NET 10 corriendo en http://localhost:5000");
Console.WriteLine("  Autenticación JWT + Microsoft 365 (Entra ID)");
Console.WriteLine("=================================================");

app.Run();

