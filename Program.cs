using BlogApp.Data;
using BlogApp.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=localhost;Database=blog_db;Uid=root;Pwd=;";

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

// Root compartido para EF Core InMemory
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

// Registro de servicios
builder.Services.AddScoped<IFileStorageService, FileStorageService>();
builder.Services.AddScoped<IPostService, PostService>();
builder.Services.AddScoped<IModuloService, ModuloService>();
builder.Services.AddScoped<IUsuarioService, UsuarioService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

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

app.UseAuthorization();
app.MapControllers();

Console.WriteLine("=================================================");
Console.WriteLine("  BlogApp .NET 10 corriendo en http://localhost:5000");
Console.WriteLine("=================================================");

app.Run();
