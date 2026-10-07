using BlogApp.Models;
using Microsoft.EntityFrameworkCore;

namespace BlogApp.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(BlogDbContext context)
    {
        try
        {
            await context.Database.EnsureCreatedAsync();

            // Seed Estado (1 = Activo, 2 = Inactivo)
            try
            {
                var createEstadoSql = @"
                CREATE TABLE IF NOT EXISTS `estado` (
                  `id` tinyint unsigned NOT NULL AUTO_INCREMENT,
                  `nombre` varchar(50) NOT NULL,
                  `descripcion` varchar(255) DEFAULT NULL,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `idx_estado_nombre` (`nombre`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

                await context.Database.ExecuteSqlRawAsync(createEstadoSql);

                if (!await context.Estados.AnyAsync())
                {
                    context.Estados.Add(new Estado { Id = 1, Nombre = "Activo", Descripcion = "Entidad activa en el sistema" });
                    context.Estados.Add(new Estado { Id = 2, Nombre = "Inactivo", Descripcion = "Entidad inactivada o eliminada lógicamente" });
                    await context.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbInitializer] Verificación de tabla estado: {ex.Message}");
            }

            // Asegurar columna estado_id en post_tipo y rol
            try
            {
                var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                    await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_tipo' AND COLUMN_NAME = 'estado_id'";
                    var colCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                    if (colCount == 0)
                    {
                        await context.Database.ExecuteSqlRawAsync("ALTER TABLE `post_tipo` ADD COLUMN `estado_id` TINYINT UNSIGNED NOT NULL DEFAULT 1;");
                    }
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rol' AND COLUMN_NAME = 'estado_id'";
                    var colCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                    if (colCount == 0)
                    {
                        await context.Database.ExecuteSqlRawAsync("ALTER TABLE `rol` ADD COLUMN `estado_id` TINYINT UNSIGNED NOT NULL DEFAULT 1;");
                    }
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post_tipo' AND COLUMN_NAME = 'rol_id'";
                    var colCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                    if (colCount == 0)
                    {
                        await context.Database.ExecuteSqlRawAsync("ALTER TABLE `post_tipo` ADD COLUMN `rol_id` TINYINT UNSIGNED NULL;");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbInitializer] Verificación de columnas estado_id en post_tipo y rol: {ex.Message}");
            }

            // Asegurar columna estado_id en adjunto_post para borrado lógico de forma limpia
            try
            {
                var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                    await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'adjunto_post' AND COLUMN_NAME = 'estado_id'";
                var colCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                if (colCount == 0)
                {
                    await context.Database.ExecuteSqlRawAsync("ALTER TABLE `adjunto_post` ADD COLUMN `estado_id` INT NOT NULL DEFAULT 1;");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbInitializer] Verificación de columna estado_id: {ex.Message}");
            }



            // Asegurar creación de tabla area en MySQL si no existe
            try
            {
                var createAreaSql = @"
                CREATE TABLE IF NOT EXISTS `area` (
                  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
                  `codigo` varchar(50) NOT NULL,
                  `nombre` varchar(100) NOT NULL,
                  `descripcion` varchar(255) DEFAULT NULL,
                  `estado_id` tinyint unsigned NOT NULL DEFAULT '1',
                  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `codigo` (`codigo`),
                  KEY `idx_area_estado` (`estado_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

                await context.Database.ExecuteSqlRawAsync(createAreaSql);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbInitializer] Verificación de tabla area: {ex.Message}");
            }

            // Seed Area (Apps e Infraestructura)
            if (!await context.Areas.AnyAsync())
            {
                context.Areas.Add(new Area { Id = 1, Codigo = "apps", Nombre = "Apps (Aplicaciones)", Descripcion = "Aplicaciones corporativas e institucionales", EstadoId = 1 });
                context.Areas.Add(new Area { Id = 2, Codigo = "infraestructura", Nombre = "Infraestructura", Descripcion = "Infraestructura de servidores, redes y seguridad", EstadoId = 1 });
                await context.SaveChangesAsync();
            }

            // Asegurar columna area_id en tabla modulo
            try
            {
                var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                    await conn.OpenAsync();

                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modulo' AND COLUMN_NAME = 'area_id'";
                var modAreaCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                if (modAreaCount == 0)
                {
                    await context.Database.ExecuteSqlRawAsync("ALTER TABLE `modulo` ADD COLUMN `area_id` SMALLINT UNSIGNED NOT NULL DEFAULT 1;");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbInitializer] Verificación de columna area_id en modulo: {ex.Message}");
            }

            // Asegurar creación de tabla tipo_conocimiento y columnas en post
            try
            {
                var createTipoConocimientoSql = @"
                CREATE TABLE IF NOT EXISTS `tipo_conocimiento` (
                  `id` tinyint unsigned NOT NULL AUTO_INCREMENT,
                  `nombre` varchar(100) NOT NULL,
                  `descripcion` varchar(255) DEFAULT NULL,
                  `estado_id` tinyint unsigned NOT NULL DEFAULT '1',
                  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (`id`),
                  UNIQUE KEY `idx_tipo_conocimiento_nombre` (`nombre`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

                await context.Database.ExecuteSqlRawAsync(createTipoConocimientoSql);

                var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                    await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post' AND COLUMN_NAME = 'tipo_conocimiento_id'";
                    var colCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                    if (colCount == 0)
                    {
                        await context.Database.ExecuteSqlRawAsync("ALTER TABLE `post` ADD COLUMN `tipo_conocimiento_id` TINYINT UNSIGNED NULL;");
                    }
                }

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'post' AND COLUMN_NAME = 'palabras_clave'";
                    var colCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
                    if (colCount == 0)
                    {
                        await context.Database.ExecuteSqlRawAsync("ALTER TABLE `post` ADD COLUMN `palabras_clave` VARCHAR(500) NULL;");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DbInitializer] Verificación de tabla tipo_conocimiento y columnas en post: {ex.Message}");
            }

            // Seed TipoConocimiento
            if (!await context.TiposConocimiento.AnyAsync())
            {
                context.TiposConocimiento.Add(new TipoConocimiento { Id = 1, Nombre = "Técnico", Descripcion = "Documentación de arquitectura, código, configuraciones e infraestructura" });
                context.TiposConocimiento.Add(new TipoConocimiento { Id = 2, Nombre = "Funcional / Operativo", Descripcion = "Procedimientos corporativos, guías operativas e instructivos de uso" });
                context.TiposConocimiento.Add(new TipoConocimiento { Id = 3, Nombre = "Normativo / Políticas", Descripcion = "Políticas de empresa, estándares de cumplimiento y normativas" });
                context.TiposConocimiento.Add(new TipoConocimiento { Id = 4, Nombre = "Soporte / Incidencias", Descripcion = "Solución a fallos recurrentes, preguntas frecuentes y soporte técnico" });
                await context.SaveChangesAsync();
            }

            // Seed PostTipo con IDs explícitos (byte)
            if (!await context.PostTipos.AnyAsync())
            {
                context.PostTipos.Add(new PostTipo { Id = 1, Nombre = "Noticia", Descripcion = "Artículos de novedades y noticias de actualidad" });
                context.PostTipos.Add(new PostTipo { Id = 2, Nombre = "Tutorial", Descripcion = "Guías paso a paso y tutoriales prácticos" });
                context.PostTipos.Add(new PostTipo { Id = 3, Nombre = "Opinión", Descripcion = "Artículos de opinión y análisis personal" });
                context.PostTipos.Add(new PostTipo { Id = 4, Nombre = "Guía", Descripcion = "Documentación técnica y guías detalladas" });
                await context.SaveChangesAsync();
            }



            // Seed Modulo con AreaId (1 = Apps, 2 = Infraestructura)
            if (!await context.Modulos.AnyAsync())
            {
                // Submódulos de Apps (AreaId = 1)
                context.Modulos.Add(new Modulo { Id = 1, Nombre = "Portales Web", Slug = "portales-web", AreaId = 1, Descripcion = "Aplicaciones web institucionales y portales de servicios", EstadoId = 1 });
                context.Modulos.Add(new Modulo { Id = 2, Nombre = "Desarrollo & APIs", Slug = "desarrollo-apis", AreaId = 1, Descripcion = "Desarrollo de software, C#, .NET, microservicios y APIs", EstadoId = 1 });
                context.Modulos.Add(new Modulo { Id = 3, Nombre = "ERP / CRM", Slug = "erp-crm", AreaId = 1, Descripcion = "Sistemas corporativos de gestión empresarial y clientes", EstadoId = 1 });
                context.Modulos.Add(new Modulo { Id = 4, Nombre = "Sistemas Internos", Slug = "sistemas-internos", AreaId = 1, Descripcion = "Herramientas de automatización y aplicaciones internas", EstadoId = 1 });

                // Submódulos de Infraestructura (AreaId = 2)
                context.Modulos.Add(new Modulo { Id = 5, Nombre = "Servidores & Cloud", Slug = "servidores-cloud", AreaId = 2, Descripcion = "Servidores virtuales, Azure, Docker y cloud computing", EstadoId = 1 });
                context.Modulos.Add(new Modulo { Id = 6, Nombre = "Redes & Comunicaciones", Slug = "redes-comunicaciones", AreaId = 2, Descripcion = "Conectividad, switches, firewalls, VPN y enlaces", EstadoId = 1 });
                context.Modulos.Add(new Modulo { Id = 7, Nombre = "Seguridad AD / LDAP", Slug = "seguridad-ad-ldap", AreaId = 2, Descripcion = "Directorio Activo, políticas de grupo, accesos e identidades", EstadoId = 1 });
                context.Modulos.Add(new Modulo { Id = 8, Nombre = "Bases de Datos", Slug = "bases-de-datos", AreaId = 2, Descripcion = "Administración, respaldos y optimización de SQL Server / MySQL", EstadoId = 1 });
                await context.SaveChangesAsync();
            }

            // Seed Roles
            if (!await context.Roles.AnyAsync())
            {
                context.Roles.Add(new Rol { Id = 1, Nombre = "Administrador", Descripcion = "Acceso total al sistema, creación de contenido y administración de seguridad" });
                context.Roles.Add(new Rol { Id = 2, Nombre = "Editor", Descripcion = "Creación y edición de artículos y módulos temáticos" });
                context.Roles.Add(new Rol { Id = 3, Nombre = "Lector", Descripcion = "Acceso de solo lectura para visualizar artículos" });
                await context.SaveChangesAsync();
            }

            // Seed Permisos
            if (!await context.Permisos.AnyAsync())
            {
                context.Permisos.Add(new Permiso { Id = 1, Codigo = "posts.create", Nombre = "Crear Publicaciones", Descripcion = "Permite crear nuevos blogs y subir archivos adjuntos" });
                context.Permisos.Add(new Permiso { Id = 2, Codigo = "posts.edit", Nombre = "Editar Publicaciones", Descripcion = "Permite modificar publicaciones existentes" });
                context.Permisos.Add(new Permiso { Id = 3, Codigo = "posts.delete", Nombre = "Eliminar Publicaciones", Descripcion = "Permite eliminar publicaciones" });
                context.Permisos.Add(new Permiso { Id = 4, Codigo = "modulos.create", Nombre = "Crear Módulos", Descripcion = "Permite registrar nuevos módulos temáticos" });
                context.Permisos.Add(new Permiso { Id = 5, Codigo = "roles.manage", Nombre = "Gestionar Roles & Permisos", Descripcion = "Acceso al panel de administración de roles y permisos" });
                context.Permisos.Add(new Permiso { Id = 6, Codigo = "tipos.manage", Nombre = "Gestionar Tipos de Publicación", Descripcion = "Permite crear, editar y eliminar tipos de publicación" });
                await context.SaveChangesAsync();
            }
            else if (!await context.Permisos.AnyAsync(p => p.Codigo == "tipos.manage"))
            {
                context.Permisos.Add(new Permiso { Id = 6, Codigo = "tipos.manage", Nombre = "Gestionar Tipos de Publicación", Descripcion = "Permite crear, editar y eliminar tipos de publicación" });
                await context.SaveChangesAsync();

                if (!await context.RolPermisos.AnyAsync(rp => rp.RolId == 1 && rp.PermisoId == 6))
                    context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 6 });
                if (!await context.RolPermisos.AnyAsync(rp => rp.RolId == 2 && rp.PermisoId == 6))
                    context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 6 });
                await context.SaveChangesAsync();
            }

            if (!await context.Permisos.AnyAsync(p => p.Codigo == "tipos_conocimiento.manage"))
            {
                var p7 = new Permiso { Codigo = "tipos_conocimiento.manage", Nombre = "Gestionar Tipos de Conocimiento", Descripcion = "Permite crear, editar y eliminar tipos de conocimiento" };
                context.Permisos.Add(p7);
                await context.SaveChangesAsync();

                if (!await context.RolPermisos.AnyAsync(rp => rp.RolId == 1 && rp.PermisoId == p7.Id))
                    context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = p7.Id });
                if (!await context.RolPermisos.AnyAsync(rp => rp.RolId == 2 && rp.PermisoId == p7.Id))
                    context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = p7.Id });
                await context.SaveChangesAsync();
            }

            // Seed RolPermisos
            if (!await context.RolPermisos.AnyAsync())
            {
                // Administrador (Rol 1) tiene todos los permisos
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 1 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 2 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 3 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 4 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 5 });
                context.RolPermisos.Add(new RolPermiso { RolId = 1, PermisoId = 6 });

                // Editor (Rol 2) puede crear/editar posts, módulos y tipos
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 1 });
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 2 });
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 4 });
                context.RolPermisos.Add(new RolPermiso { RolId = 2, PermisoId = 6 });

                await context.SaveChangesAsync();
            }

            // Seed Usuario demo
            if (!await context.Usuarios.AnyAsync())
            {
                var adminUser = new Usuario
                {
                    Id = 1,
                    Nombre = "Administrador",
                    Correo = "admin@blogapp.com",
                    Password = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("Admin123!BlogAppSaltKey"))),
                    Estado = "activo",
                    RolId = 1,
                    CreadoEn = DateTime.UtcNow,
                    ActualizadoEn = DateTime.UtcNow
                };
                context.Usuarios.Add(adminUser);
                await context.SaveChangesAsync();

                var tecModulo = await context.Modulos.FirstOrDefaultAsync(m => m.Slug == "desarrollo-apis") ?? await context.Modulos.FirstOrDefaultAsync();
                var tutTipo = await context.PostTipos.FirstOrDefaultAsync(t => t.Nombre == "Tutorial");

                if (tecModulo != null && tutTipo != null)
                {
                    var postDemo = new Post
                    {
                        Id = 1,
                        UsuarioId = adminUser.Id,
                        ModuloId = tecModulo.Id,
                        TipoId = tutTipo.Id,
                        Titulo = "Bienvenidos al Sistema de Blogs en .NET 10",
                        Slug = "bienvenidos-al-sistema-de-blogs-en-net-10",
                        Resumen = "Primer artículo demostrativo creado automáticamente con soporte para archivos adjuntos e imágenes de portada.",
                        Contenido = "Este es un blog completo desarrollado con ASP.NET Core en .NET 10. Permite crear publicaciones por módulo, categorizarlas por tipo de post, subir múltiples fotos o adjuntos y gestionar imágenes de portada.",
                        Estado = "publicado",
                        CreadoEn = DateTime.UtcNow,
                        ActualizadoEn = DateTime.UtcNow
                    };
                    context.Posts.Add(postDemo);
                    await context.SaveChangesAsync();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DbInitializer] Error al sembrar datos: {ex.Message}");
        }
    }
}
