using System.ComponentModel.DataAnnotations.Schema;

namespace BlogApp.Models;

[Table("rol_permiso")]
public class RolPermiso
{
    [Column("rol_id")]
    public byte RolId { get; set; }
    public Rol Rol { get; set; } = null!;

    [Column("permiso_id")]
    public ushort PermisoId { get; set; }
    public Permiso Permiso { get; set; } = null!;
}
