using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BlogApp.Models;

[Table("tipo_conocimiento")]
public class TipoConocimiento
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public byte Id { get; set; }

    [Required]
    [MaxLength(100)]
    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("descripcion")]
    public string? Descripcion { get; set; }

    [Column("estado_id")]
    public byte EstadoId { get; set; } = 1;

    [ForeignKey("EstadoId")]
    public Estado? Estado { get; set; }

    [Column("creado_en")]
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public ICollection<Post> Posts { get; set; } = new List<Post>();
}
