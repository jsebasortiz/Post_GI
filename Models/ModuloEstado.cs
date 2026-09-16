using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BlogApp.Models;

[Table("modulo_estado")]
public class ModuloEstado
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    [Column("id")]
    public byte Id { get; set; }

    [Required]
    [MaxLength(50)]
    [Column("nombre")]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(255)]
    [Column("descripcion")]
    public string? Descripcion { get; set; }

    public ICollection<Modulo> Modulos { get; set; } = new List<Modulo>();
}
