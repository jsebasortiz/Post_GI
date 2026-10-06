import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { getPrixmaSwal, getTableSkeletonHtml } from '../core/ui-helpers.js';
import { hasPermission } from './auth.js';

const DEFAULT_AREAS = [
  { id: 1, code: 'apps', name: 'Apps (Aplicaciones)', icon: 'fa-solid fa-rocket', desc: 'Aplicaciones corporativas' },
  { id: 2, code: 'infraestructura', name: 'Infraestructura', icon: 'fa-solid fa-server', desc: 'Servidores y redes' }
];

export async function loadAreas() {
  try {
    const res = await apiFetch('/api/areas?soloActivas=true');
    if (res.ok) {
      state.allAreasCache = await res.json();
    } else {
      state.allAreasCache = DEFAULT_AREAS;
    }
  } catch (e) {
    console.error('Error cargando áreas desde MySQL API:', e);
    state.allAreasCache = DEFAULT_AREAS;
  }
  renderAreaTabs();
  populateAreaSelects();
}

export function getAllAreas() {
  if (state.allAreasCache && state.allAreasCache.length > 0) {
    return state.allAreasCache.map(a => ({
      id: a.id,
      code: a.codigo,
      name: a.nombre,
      icon: getAreaIcon(a.codigo, a.nombre),
      desc: a.descripcion
    }));
  }
  return DEFAULT_AREAS.map(a => ({ id: a.id, code: a.code, name: a.name, icon: a.icon, desc: a.desc }));
}

export function getAreaIcon(codigo, nombre) {
  const codeLower = (codigo || '').toLowerCase();
  const nameLower = (nombre || '').toLowerCase();
  if (codeLower === 'apps' || nameLower.includes('app')) return 'fa-solid fa-rocket';
  if (codeLower === 'infraestructura' || nameLower.includes('infra')) return 'fa-solid fa-server';
  if (nameLower.includes('telecom') || nameLower.includes('red') || nameLower.includes('telefon')) return 'fa-solid fa-phone';
  if (nameLower.includes('finanz') || nameLower.includes('contab') || nameLower.includes('pago')) return 'fa-solid fa-coins';
  if (nameLower.includes('recurso') || nameLower.includes('rrhh') || nameLower.includes('personal')) return 'fa-solid fa-users';
  if (nameLower.includes('sistem') || nameLower.includes('operacion') || nameLower.includes('ti')) return 'fa-solid fa-gears';
  if (nameLower.includes('segurid') || nameLower.includes('auditor')) return 'fa-solid fa-shield-halved';
  return 'fa-solid fa-sitemap';
}

export function renderAreaTabs() {
  const container = document.getElementById('mainCategoriesTabs');
  if (!container) return;

  const areas = getAllAreas();

  let html = `
    <button class="category-tab ${state.currentCategoriaPadre === null ? 'active' : ''}" onclick="switchMainCategory(null, this)">
      <i class="fa-solid fa-layer-group"></i> Todas las Áreas
    </button>
  `;

  areas.forEach(area => {
    const isActive = state.currentCategoriaPadre && state.currentCategoriaPadre.toLowerCase() === area.code.toLowerCase();
    let catClass = '';
    if (area.code === 'apps') catClass = 'cat-apps';
    else if (area.code === 'infraestructura') catClass = 'cat-infra';

    html += `
      <button class="category-tab ${catClass} ${isActive ? 'active' : ''}" onclick="switchMainCategory('${escapeHtml(area.code)}', this)">
        <i class="${area.icon || 'fa-solid fa-sitemap'}"></i> ${escapeHtml(area.name)}
      </button>
    `;
  });

  container.innerHTML = html;
}

export function populateAreaSelects() {
  const areas = getAllAreas();
  const selectIds = ['moduloCategoriaPadre', 'editModuloCategoriaPadre', 'selectCategoriaPadre', 'editSelectCategoriaPadre'];

  selectIds.forEach(id => {
    const selectEl = document.getElementById(id);
    if (!selectEl) return;

    const currentVal = selectEl.value;
    let html = '';
    areas.forEach(area => {
      html += `<option value="${escapeHtml(area.code)}">${escapeHtml(area.name)}</option>`;
    });
    selectEl.innerHTML = html;
    if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) {
      selectEl.value = currentVal;
    }
  });
}

let areasCurrentPage = 1;
const areasPageSize = 5;

export async function loadAreasList() {
  const container = document.getElementById('areasListContainer');
  if (!container) return;

  container.innerHTML = getTableSkeletonHtml(5, 4);

  const areas = getAllAreas() || [];
  const totalItems = areas.length;
  const totalPages = Math.ceil(totalItems / areasPageSize) || 1;

  if (areasCurrentPage > totalPages) areasCurrentPage = totalPages;
  if (areasCurrentPage < 1) areasCurrentPage = 1;

  if (totalItems === 0) {
    container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay áreas registradas.</div>';
    return;
  }

  const startIndex = (areasCurrentPage - 1) * areasPageSize;
  const pageAreas = areas.slice(startIndex, startIndex + areasPageSize);

  let html = `
    <div class="table-responsive">
      <table class="rbac-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="text-align:left; border-bottom:1px solid var(--bg-card-border); color:var(--text-muted); font-size:0.85rem;">
            <th style="padding:0.75rem;">Área</th>
            <th style="padding:0.75rem;">Código</th>
            <th style="padding:0.75rem;">Descripción</th>
            <th style="padding:0.75rem; text-align:right;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${pageAreas.map(a => `
            <tr>
              <td style="padding:0.75rem; font-weight:600; color:var(--text-main);">${escapeHtml(a.name)}</td>
              <td style="padding:0.75rem;"><span class="badge" style="background:var(--bg-card-border); color:var(--text-muted); font-size:0.75rem; padding:2px 8px; border-radius:10px;">${escapeHtml(a.code)}</span></td>
              <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(a.desc || 'Sin descripción')}</td>
              <td style="padding:0.75rem; text-align:right;">
                <div style="display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                  <button class="btn btn-secondary" onclick="navigateTo('/areas/show/' + ${a.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-cyan); border-color:rgba(6,182,212,0.3);" title="Ver Área">
                    <i class="fa-solid fa-eye"></i> Ver
                  </button>
                  <button class="btn btn-secondary" onclick="navigateTo('/areas/edit/' + ${a.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem;" title="Editar Área">
                    <i class="fa-solid fa-pen"></i> Editar
                  </button>
                  <button class="btn btn-secondary" onclick="handleInactivarArea(${a.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" title="Eliminar Área">
                    <i class="fa-solid fa-trash-can"></i> Eliminar
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  if (totalItems > areasPageSize) {
    const prevDisabled = areasCurrentPage === 1 ? 'disabled' : '';
    const nextDisabled = areasCurrentPage === totalPages ? 'disabled' : '';
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">
        <span>Página ${areasCurrentPage} de ${totalPages} (${totalItems} áreas en total)</span>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${prevDisabled} onclick="changeAreasPage(-1)">
            <i class="fa-solid fa-chevron-left"></i> Anterior
          </button>
          <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${nextDisabled} onclick="changeAreasPage(1)">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>
    `;
  } else {
    html += `<div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">Mostrando ${totalItems} área(s)</div>`;
  }

  container.innerHTML = html;
}

export function changeAreasPage(delta) {
  areasCurrentPage += delta;
  loadAreasList();
}

export async function handleCreateArea(event) {
  if (event) event.preventDefault();
  const nombreInput = document.getElementById('areaNombre');
  const descInput = document.getElementById('areaDesc');

  const nombre = nombreInput ? nombreInput.value.trim() : '';
  const descripcion = descInput ? descInput.value.trim() : '';

  if (!nombre) return;

  try {
    const res = await apiFetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al crear el área.');
    }

    const newArea = await res.json();

    const form = document.getElementById('createAreaForm');
    if (form) form.reset();

    await loadAreas();
    loadAreasList();
    if (window.navigateTo) window.navigateTo('/areas');

    getPrixmaSwal().fire({
      icon: 'success',
      title: '¡Área Creada!',
      text: `El área "${newArea.nombre}" ha sido registrada en la base de datos.`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Crear Área',
      text: err.message
    });
  }
}

export async function handleEditAreaInline(id, currentName, currentDesc) {
  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Área',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Nombre del Área</label>
          <input id="swal-input-area-nombre" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentName)}">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Descripción</label>
          <input id="swal-input-area-desc" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentDesc)}">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('swal-input-area-nombre').value.trim();
      const descripcion = document.getElementById('swal-input-area-desc').value.trim();
      if (!nombre) {
        getPrixmaSwal().showValidationMessage('El nombre es requerido');
        return false;
      }
      return { nombre, descripcion };
    }
  });

  if (!formValues) return;

  try {
    const res = await apiFetch(`/api/areas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al actualizar el área.');
    }

    await loadAreas();
    loadAreasList();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Área Actualizada',
      text: 'Los cambios fueron guardados correctamente.',
      timer: 1800,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
}

export function openEditAreaModal(id) {
  const areas = getAllAreas();
  const area = areas.find(a => a.id === id || a.id === parseInt(id));
  if (!area) return;

  const idInput = document.getElementById('editAreaId');
  const nameInput = document.getElementById('editAreaNombre');
  const descInput = document.getElementById('editAreaDesc');

  if (idInput) idInput.value = area.id;
  if (nameInput) nameInput.value = area.name || '';
  if (descInput) descInput.value = area.desc || '';

  if (window.navigateTo) window.navigateTo('/areas/edit/' + id);
}

export async function handleUpdateArea(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editAreaId').value;
  const nombre = document.getElementById('editAreaNombre').value.trim();
  const descripcion = document.getElementById('editAreaDesc').value.trim();

  if (!id || !nombre) return;

  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: `¿Deseas guardar los cambios realizados en el área "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/areas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al actualizar el área.');
    }

    await loadAreas();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Área Actualizada',
      text: 'Los cambios del área han sido guardados correctamente.',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Actualizar Área',
      text: err.message
    });
  }
}

export async function handleInactivarArea(id) {
  const areas = getAllAreas();
  const area = areas.find(a => a.id === id || a.id === parseInt(id));
  const nombre = area ? area.name : 'esta área';

  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar área?',
    text: `El área "${nombre}" se eliminará y dejará de mostrarse en el portal.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/areas/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'No se pudo eliminar el área.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Área Eliminada',
      text: `El área "${nombre}" ha sido eliminada correctamente.`,
      timer: 2000,
      showConfirmButton: false
    });

    if (state.currentCategoriaPadre && window.switchMainCategory) window.switchMainCategory(null, null);
    await loadAreas();
    loadAreasList();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar Área',
      text: err.message
    });
    return false;
  }
}
