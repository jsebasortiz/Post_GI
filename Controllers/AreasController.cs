using BlogApp.DTOs;
using BlogApp.Services;
using Microsoft.AspNetCore.Mvc;

namespace BlogApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AreasController : ControllerBase
{
    private readonly IAreaService _areaService;

    public AreasController(IAreaService areaService)
    {
        _areaService = areaService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAreas([FromQuery] bool soloActivas = true)
    {
        var areas = await _areaService.GetAreasAsync(soloActivas);
        return Ok(areas);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetAreaById(ushort id)
    {
        var area = await _areaService.GetAreaByIdAsync(id);
        if (area == null) return NotFound(new { message = "Área no encontrada." });
        return Ok(area);
    }

    [HttpPost]
    public async Task<IActionResult> CreateArea([FromBody] CreateAreaDto dto)
    {
        try
        {
            var result = await _areaService.CreateAreaAsync(dto);
            return CreatedAtAction(nameof(GetAreaById), new { id = result.Id }, result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error interno al crear el área.", detail = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateArea(ushort id, [FromBody] UpdateAreaDto dto)
    {
        try
        {
            var result = await _areaService.UpdateAreaAsync(id, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error interno al actualizar el área.", detail = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> InactivarArea(ushort id)
    {
        var success = await _areaService.InactivarAreaAsync(id);
        if (!success) return NotFound(new { message = "Área no encontrada." });

        return Ok(new { message = "El área fue cambiada a estado inactivo (borrado lógico)." });
    }
}
