using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BlogApp.Models;

[Table("usuarios")]
public class Usuario
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public ulong Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    [Column("correo")]
    public string Correo { get; set; } = string.Empty;

    [Required]
    [MaxLength(255)]
    [Column("password")]
    [JsonIgnore]
    public string Password { get; set; } = string.Empty;

    [Column("estado")]
    public string Estado { get; set; } = "activo";

    [Column("rol_id")]
    public byte RolId { get; set; } = 3;

    public Rol? Rol { get; set; }

    [Column("creado_en")]
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;

    [Column("actualizado_en")]
    public DateTime ActualizadoEn { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
