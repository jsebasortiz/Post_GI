import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { getPrixmaSwal, setFormSkeletonState, getTableSkeletonHtml, setFormReadOnlyMode } from '../core/ui-helpers.js';
import { hasPermission } from './auth.js';
import { getAllAreas, populateAreaSelects } from './areas.js';

export async function loadModulos() {
  try {
    const res = await apiFetch('/api/modulos');
    if (!res.ok) return;
    state.allModulosCache = await res.json();

    let modulosToRender = state.allModulosCache;
    if (state.currentCategoriaPadre) {
      modulosToRender = state.allModulosCache.filter(m => m.categoriaPadre && m.categoriaPadre.toLowerCase() === state.currentCategoriaPadre.toLowerCase());
    }

    const filterContainer = document.getElementById('modulesFilter');
    if (filterContainer) {
      let filterHtml = `<button class="module-pill ${state.currentModuloId === null ? 'active' : ''}" data-module-id="null" onclick="filterByModule(null, this)">Todos los Módulos</button>`;
      modulosToRender.forEach(m => {
        filterHtml += `<button class="module-pill ${state.currentModuloId === m.id ? 'active' : ''}" data-module-id="${m.id}" onclick="filterByModule(${m.id}, this)">${escapeHtml(m.nombre)}</button>`;
      });
      filterContainer.innerHTML = filterHtml;
    }

    const modalCatSelect = document.getElementById('selectCategoriaPadre');
    const selectedCategory = modalCatSelect ? modalCatSelect.value : 'apps';
    updatePostSubmoduloSelect(selectedCategory);
  } catch (err) {
    console.error('Error cargando módulos:', err);
  }
}

export function updateModulePillActiveState() {
  const container = document.getElementById('modulesFilter');
  if (!container) return;

  const pills = container.querySelectorAll('.module-pill');
  pills.forEach(pill => {
    const modIdAttr = pill.getAttribute('data-module-id');
    const isAll = (modIdAttr === 'null' || modIdAttr === null || modIdAttr === '');
    if ((isAll && state.currentModuloId === null) || (!isAll && parseInt(modIdAttr, 10) === state.currentModuloId)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

export function filterByModule(moduloId, btnElement) {
  state.currentModuloId = moduloId;
  updateModulePillActiveState();
  if (window.navigateTo) {
    if (moduloId) {
      window.navigateTo(`/modulo/${moduloId}`);
    } else if (state.currentCategoriaPadre) {
      window.navigateTo(`/area/${encodeURIComponent(state.currentCategoriaPadre)}`);
    } else {
      window.navigateTo('/dashboard');
    }
  }
}

export function onPostCategoriaChange(cat) {
  updatePostSubmoduloSelect(cat);
}

export function updatePostSubmoduloSelect(cat) {
  const selectModulo = document.getElementById('selectModulo');
  if (!selectModulo) return;

  const targetCat = (cat || '').toLowerCase().trim();
  const filtered = (state.allModulosCache || []).filter(m => {
    if (!targetCat) return true;
    const mCat = (m.categoriaPadre || '').toLowerCase().trim();
    const mAreaCode = (m.area ? m.area.codigo : '').toLowerCase().trim();
    return mCat === targetCat || mAreaCode === targetCat;
  });

  let selectHtml = '<option value="">Selecciona un Módulo</option>';
  filtered.forEach(m => {
    selectHtml += `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`;
  });
  selectModulo.innerHTML = selectHtml;
}

export function populateModuloAreaSelect() {
  const select = document.getElementById('moduloCategoriaPadre');
  if (!select) return;
  const areas = getAllAreas();
  select.innerHTML = areas.map(a => `<option value="${escapeHtml(a.code)}">${escapeHtml(a.name)}</option>`).join('');
}

let modulesCurrentPage = 1;
const modulesPageSize = 5;

export async function loadModulesList() {
  const container = document.getElementById('modulesListContainer');
  if (!container) return;

  container.innerHTML = getTableSkeletonHtml(5, 4);

  try {
    const res = await apiFetch('/api/modulos?soloActivos=true');
    if (!res.ok) throw new Error('Error al obtener los módulos.');

    const modulos = await res.json();
    if (!modulos || modulos.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay módulos registrados.</div>';
      return;
    }

    const totalItems = modulos.length;
    const totalPages = Math.ceil(totalItems / modulesPageSize) || 1;

    if (modulesCurrentPage > totalPages) modulesCurrentPage = totalPages;
    if (modulesCurrentPage < 1) modulesCurrentPage = 1;

    const startIndex = (modulesCurrentPage - 1) * modulesPageSize;
    const pageModules = modulos.slice(startIndex, startIndex + modulesPageSize);

    let html = `
      <div class="table-responsive">
        <table class="rbac-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--bg-card-border); color:var(--text-muted); font-size:0.85rem;">
              <th style="padding:0.75rem;">Nombre del Módulo</th>
              <th style="padding:0.75rem;">Área Principal</th>
              <th style="padding:0.75rem;">Descripción</th>
              <th style="padding:0.75rem; text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pageModules.map(m => `
              <tr>
                <td style="padding:0.75rem; font-weight:600; color:var(--text-main);">${escapeHtml(m.nombre)}</td>
                <td style="padding:0.75rem;"><span class="badge" style="background:var(--bg-card-border); color:var(--accent-cyan); font-size:0.75rem; padding:2px 8px; border-radius:10px;">${escapeHtml(m.area ? m.area.nombre : 'General')}</span></td>
                <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(m.descripcion || 'Sin descripción')}</td>
                <td style="padding:0.75rem; text-align:right;">
                  <div style="display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                    <button class="btn btn-secondary" onclick="navigateTo('/modulos/show/' + ${m.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-cyan); border-color:rgba(6,182,212,0.3);" title="Ver Módulo">
                      <i class="fa-solid fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-secondary" onclick="navigateTo('/modulos/edit/' + ${m.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem;" title="Editar Módulo">
                      <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button class="btn btn-secondary" onclick="handleInactivarModulo(${m.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" title="Eliminar Módulo">
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

    if (totalItems > modulesPageSize) {
      const prevDisabled = modulesCurrentPage === 1 ? 'disabled' : '';
      const nextDisabled = modulesCurrentPage === totalPages ? 'disabled' : '';
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">
          <span>Página ${modulesCurrentPage} de ${totalPages} (${totalItems} módulos en total)</span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${prevDisabled} onclick="changeModulesPage(-1)">
              <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${nextDisabled} onclick="changeModulesPage(1)">
              Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    } else {
      html += `<div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">Mostrando ${totalItems} módulo(s)</div>`;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-rose); text-align:center;">${escapeHtml(err.message)}</div>`;
  }
}

export function changeModulesPage(delta) {
  modulesCurrentPage += delta;
  loadModulesList();
}

export async function handleCreateModule(event) {
  if (event) event.preventDefault();
  const categoriaPadre = document.getElementById('moduloCategoriaPadre').value;
  const nombre = document.getElementById('moduloNombre').value.trim();
  const descripcion = document.getElementById('moduloDesc').value.trim();

  if (!nombre) return;

  try {
    const res = await apiFetch('/api/modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoriaPadre, nombre, descripcion })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al crear el módulo.');
    }

    const form = document.getElementById('createModuleForm');
    if (form) form.reset();
    await loadModulos();
    if (window.navigateTo) window.navigateTo('/modulos');

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Módulo Creado',
      text: `El módulo "${nombre}" ha sido registrado.`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Crear Módulo',
      text: err.message
    });
  }
}

export function openEditModuleModal(id) {
  setFormSkeletonState('editModuleModal', true);
  if (window.navigateTo) window.navigateTo('/modulos/edit/' + id);
  populateAreaSelects();
  const modulo = (state.allModulosCache || []).find(m => m.id === id || m.id === parseInt(id, 10));
  if (modulo) {
    const idInput = document.getElementById('editModuleId');
    const nameInput = document.getElementById('editModuloNombre');
    const descInput = document.getElementById('editModuloDesc');
    const catSelect = document.getElementById('editModuloCategoriaPadre');

    if (idInput) idInput.value = modulo.id;
    if (nameInput) nameInput.value = modulo.nombre || '';
    if (descInput) descInput.value = modulo.descripcion || '';

    if (catSelect) {
      const catCode = modulo.categoriaPadre || (modulo.area ? modulo.area.codigo : 'apps');
      catSelect.value = catCode;
    }
  }
  setTimeout(() => setFormSkeletonState('editModuleModal', false), 250);
}

export async function handleUpdateModule(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editModuleId').value;
  const nombre = document.getElementById('editModuloNombre').value.trim();
  const categoriaPadre = document.getElementById('editModuloCategoriaPadre').value;
  const descripcion = document.getElementById('editModuloDesc').value.trim();

  if (!id || !nombre) return;

  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: `¿Deseas guardar los cambios realizados en el módulo "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/modulos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, categoriaPadre, descripcion })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al actualizar el módulo.');
    }

    await loadModulos();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Módulo Actualizado',
      text: `El módulo "${nombre}" fue actualizado correctamente.`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Actualizar Módulo',
      text: err.message
    });
  }
}

export async function handleInactivarModulo(id) {
  const modulo = (state.allModulosCache || []).find(m => m.id === id || m.id === parseInt(id));
  const nombre = modulo ? modulo.nombre : 'este módulo';

  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar módulo?',
    text: `El módulo "${nombre}" se eliminará y dejará de mostrarse en los filtros.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/modulos/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'No se pudo eliminar el módulo.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Módulo Eliminado',
      text: `El módulo "${nombre}" ha sido eliminado correctamente.`,
      timer: 2000,
      showConfirmButton: false
    });

    if (state.currentModuloId === id) filterByModule(null, null);
    await loadModulos();
    loadModulesList();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar Módulo',
      text: err.message
    });
    return false;
  }
}

export async function handleEditModuloInline(id, currentName, currentCat, currentDesc) {
  const areas = getAllAreas();
  const areaOptionsHtml = areas.map(a => `<option value="${escapeHtml(a.code)}" ${a.code === currentCat ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');

  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Módulo',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Área Principal</label>
          <select id="swal-select-modulo-cat" class="swal2-input" style="width:100%; margin:0; height:42px; padding:0 0.75rem;">
            ${areaOptionsHtml}
          </select>
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Nombre del Módulo</label>
          <input id="swal-input-modulo-nombre" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentName)}">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Descripción</label>
          <input id="swal-input-modulo-desc" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentDesc)}">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const categoriaPadre = document.getElementById('swal-select-modulo-cat').value;
      const nombre = document.getElementById('swal-input-modulo-nombre').value.trim();
      const descripcion = document.getElementById('swal-input-modulo-desc').value.trim();
      if (!nombre) {
        getPrixmaSwal().showValidationMessage('El nombre es requerido');
        return false;
      }
      return { categoriaPadre, nombre, descripcion };
    }
  });

  if (!formValues) return;

  try {
    const res = await apiFetch(`/api/modulos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el módulo.');
    }

    await loadModulos();
    loadModulesList();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Módulo Actualizado',
      text: 'El módulo fue actualizado correctamente.',
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

// Dedicated View Functions for Module Detail / Edit View
export let editModuleInitialValues = { categoriaPadre: '', nombre: '', descripcion: '' };

export async function loadModuleForShow(id) {
  if (window.switchAppView) window.switchAppView('viewModuleEdit');
  populateModuloAreaSelect();
  await loadModuleForEdit(id);
  setFormReadOnlyMode('editModuleForm', true, 'Detalles del Módulo', 'fa-eye');
}

export async function loadModuleForEdit(id) {
  setFormReadOnlyMode('editModuleForm', false);
  setFormSkeletonState('editModuleForm', true);
  try {
    const res = await apiFetch(`/api/modulos/${id}`);
    if (res.ok) {
      const mod = await res.json();
      const idEl = document.getElementById('editModuleId');
      const nombreEl = document.getElementById('editModuloNombre');
      const descEl = document.getElementById('editModuloDesc');
      const catSelect = document.getElementById('editModuloCategoriaPadre');
      const catVal = mod.categoriaPadre || (mod.area ? mod.area.codigo : '');

      if (idEl) idEl.value = mod.id;
      if (nombreEl) nombreEl.value = mod.nombre || '';
      if (descEl) descEl.value = mod.descripcion || '';
      if (catSelect) catSelect.value = catVal;

      editModuleInitialValues = {
        categoriaPadre: (catVal || '').trim(),
        nombre: (mod.nombre || '').trim(),
        descripcion: (mod.descripcion || '').trim()
      };
    }
  } catch (e) {
    console.error('Error cargando módulo para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editModuleForm', false), 250);
  }
}

export function hasModuleEditChanged() {
  if (document.getElementById('editModuleForm')?.dataset.readOnly === 'true') return false;
  const cat = (document.getElementById('editModuloCategoriaPadre')?.value || '').trim();
  const nombre = (document.getElementById('editModuloNombre')?.value || '').trim();
  const desc = (document.getElementById('editModuloDesc')?.value || '').trim();
  return cat !== editModuleInitialValues.categoriaPadre ||
    nombre !== editModuleInitialValues.nombre ||
    desc !== editModuleInitialValues.descripcion;
}

export async function handleSaveEditModule(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editModuleId').value;
  const categoriaPadre = document.getElementById('editModuloCategoriaPadre').value;
  const nombre = document.getElementById('editModuloNombre').value.trim();
  const descripcion = document.getElementById('editModuloDesc').value.trim();
  if (!id || !nombre) return;

  const hasChanged = hasModuleEditChanged();

  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en el módulo "${nombre}"?`
      : `¿Deseas guardar la información del módulo "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/modulos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoriaPadre, nombre, descripcion })
    });
    if (!res.ok) throw new Error('Error al actualizar el módulo.');
    await loadModulos();
    getPrixmaSwal().fire({ icon: 'success', title: 'Módulo Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/modulos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function handleCancelEditModule(event) {
  if (event) event.preventDefault();

  if (hasModuleEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones en este módulo. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });

    if (!confirmResult.isConfirmed) return;
  }

  if (window.navigateTo) window.navigateTo('/modulos');
}

export async function handleDeleteModuleFromForm() {
  const id = document.getElementById('editModuleId').value;
  if (id) {
    const success = await handleInactivarModulo(id);
    if (success) {
      if (window.navigateTo) window.navigateTo('/modulos');
    }
  }
}
