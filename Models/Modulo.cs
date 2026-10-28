using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BlogApp.Models;

[Table("modulo")]
public class Modulo
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public ushort Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    [Column("slug")]
    public string Slug { get; set; } = string.Empty;

    [Column("descripcion")]
    public string? Descripcion { get; set; }

    [Column("area_id")]
    public ushort AreaId { get; set; } = 1;

    [ForeignKey("AreaId")]
    public Area? Area { get; set; }

    [NotMapped]
    public string CategoriaPadre => Area?.Codigo ?? "apps";

    [Column("estado_id")]
    public byte EstadoId { get; set; } = 1;

    [ForeignKey("EstadoId")]
    public Estado? Estado { get; set; }

    [Column("creado_en")]
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;

    // Relaciones
    [JsonIgnore]
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
