import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { getPrixmaSwal, setFormSkeletonState, getTableSkeletonHtml, setFormReadOnlyMode } from '../core/ui-helpers.js';
import { hasPermission } from './auth.js';
import { getAllAreas, populateAreaSelects } from './areas.js';
import { loadPosts } from './posts.js';

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

export async function filterByModule(moduloId, btnElement) {
  state.currentModuloId = moduloId ? parseInt(moduloId, 10) : null;
  updateModulePillActiveState();

  // Actualizar URL sin recarga completa
  let targetPath = '/dashboard';
  if (state.currentModuloId) {
    targetPath = `/modulo/${state.currentModuloId}`;
  } else if (state.currentCategoriaPadre) {
    targetPath = `/area/${encodeURIComponent(state.currentCategoriaPadre)}`;
  }

  if (window.history && window.history.pushState) {
    const basePath = (window.getAppBasePath ? window.getAppBasePath() : '');
    window.history.pushState({}, '', basePath + targetPath);
  }

  // Cargar publicaciones directamente con el nuevo filtro
  await loadPosts(1);
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
  const areas = getAllAreas();
  const selectEl = document.getElementById('moduloAreaSelect');
  const editSelectEl = document.getElementById('editModuloAreaSelect');

  let html = '<option value="">Selecciona un Área</option>';
  areas.forEach(area => {
    html += `<option value="${area.id}">${escapeHtml(area.name)} (${escapeHtml(area.code)})</option>`;
  });

  if (selectEl) selectEl.innerHTML = html;
  if (editSelectEl) editSelectEl.innerHTML = html;
}

// -------------------------------------------------------------
// CRUD DE MÓDULOS (VISTAS COMPLETAS TIPO SAAS)
// -------------------------------------------------------------
export async function loadModulesList(page = 1) {
  const tbody = document.getElementById('modulesTableBody');
  const pagination = document.getElementById('modulesPagination');
  if (!tbody) return;

  tbody.innerHTML = getTableSkeletonHtml(5, 5);

  try {
    const res = await apiFetch(`/api/modulos/paged?page=${page}&pageSize=10`);
    if (!res.ok) throw new Error('Error al cargar la lista de módulos.');

    const data = await res.json();
    const modules = data.items || [];
    const totalPages = data.totalPages || 1;
    const currentPage = data.currentPage || 1;

    if (modules.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">No hay módulos registrados.</td></tr>';
      if (pagination) pagination.innerHTML = '';
      return;
    }

    tbody.innerHTML = modules.map(m => {
      const areaName = m.area ? m.area.nombre : (m.categoriaPadre || 'General');
      const isActivo = m.estadoId === 1;
      const statusBadge = isActivo
        ? '<span class="status-badge status-active"><span class="status-dot"></span> Activo</span>'
        : '<span class="status-badge status-inactive"><span class="status-dot"></span> Inactivo</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(m.nombre)}</strong></td>
          <td><code style="color:var(--primary); font-size:0.85rem;">${escapeHtml(m.slug)}</code></td>
          <td><span class="badge badge-module">${escapeHtml(areaName)}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap:0.4rem; justify-content:flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="navigateTo('/modulos/show/${m.id}')" title="Ver Módulo">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="navigateTo('/modulos/edit/${m.id}')" title="Editar Módulo">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn btn-danger btn-sm" onclick="handleInactivarModulo(${m.id}, '${escapeHtml(m.nombre)}')" title="Eliminar / Inactivar">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (pagination) {
      pagination.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; font-size:0.88rem; color:var(--text-muted);">
          <span>Página ${currentPage} de ${totalPages}</span>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-secondary btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="changeModulesPage(${currentPage - 1})">Anterior</button>
            <button class="btn btn-secondary btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changeModulesPage(${currentPage + 1})">Siguiente</button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-rose);">${escapeHtml(err.message)}</td></tr>`;
  }
}

export function changeModulesPage(p) {
  loadModulesList(p);
}

export async function handleCreateModule(event) {
  event.preventDefault();
  const nombre = document.getElementById('moduleNombre').value.trim();
  const slug = document.getElementById('moduleSlug').value.trim();
  const areaId = document.getElementById('moduloAreaSelect').value;
  const descripcion = document.getElementById('moduleDescripcion').value.trim();

  if (!nombre) {
    getPrixmaSwal().fire({ icon: 'warning', title: 'Atención', text: 'El nombre del módulo es obligatorio.' });
    return;
  }

  try {
    const payload = {
      nombre,
      slug: slug || nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      areaId: areaId ? parseInt(areaId, 10) : null,
      descripcion,
      estadoId: 1
    };

    const res = await apiFetch('/api/modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear el módulo.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: '¡Módulo Creado!',
      text: 'El nuevo módulo ha sido registrado exitosamente.',
      timer: 1800,
      showConfirmButton: false
    });

    await loadModulos();
    navigateTo('/modulos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function loadModuleForShow(id) {
  switchAppView('viewModuleShow');
  setFormSkeletonState('moduleShowCard', true);

  try {
    const res = await apiFetch(`/api/modulos/${id}`);
    if (!res.ok) throw new Error('No se pudo cargar la información del módulo.');

    const m = await res.json();
    document.getElementById('showModuleTitle').innerText = m.nombre;
    document.getElementById('showModuleSlug').innerText = m.slug;
    document.getElementById('showModuleArea').innerText = m.area ? m.area.nombre : (m.categoriaPadre || 'General');
    document.getElementById('showModuleDescripcion').innerText = m.descripcion || 'Sin descripción asignada.';
    document.getElementById('showModuleEstado').innerHTML = m.estadoId === 1
      ? '<span class="status-badge status-active"><span class="status-dot"></span> Activo</span>'
      : '<span class="status-badge status-inactive"><span class="status-dot"></span> Inactivo</span>';

    const editBtn = document.getElementById('btnShowModuleEdit');
    if (editBtn) editBtn.onclick = () => navigateTo(`/modulos/edit/${m.id}`);
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
    navigateTo('/modulos');
  } finally {
    setFormSkeletonState('moduleShowCard', false);
  }
}

export async function loadModuleForEdit(id) {
  switchAppView('viewModuleEdit');
  setFormSkeletonState('editModuleForm', true);
  populateModuloAreaSelect();

  try {
    const res = await apiFetch(`/api/modulos/${id}`);
    if (!res.ok) throw new Error('No se pudo cargar el módulo para edición.');

    const m = await res.json();
    document.getElementById('editModuleId').value = m.id;
    document.getElementById('editModuleNombre').value = m.nombre;
    document.getElementById('editModuleSlug').value = m.slug;
    if (m.areaId) document.getElementById('editModuloAreaSelect').value = m.areaId;
    document.getElementById('editModuleDescripcion').value = m.descripcion || '';
    document.getElementById('editModuleEstado').value = m.estadoId;

    state.initialModuleEditState = {
      nombre: m.nombre,
      slug: m.slug,
      areaId: m.areaId,
      descripcion: m.descripcion || '',
      estadoId: m.estadoId
    };
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
    navigateTo('/modulos');
  } finally {
    setFormSkeletonState('editModuleForm', false);
  }
}

export function hasModuleEditChanged() {
  if (!state.initialModuleEditState) return false;
  const current = {
    nombre: document.getElementById('editModuleNombre')?.value.trim(),
    slug: document.getElementById('editModuleSlug')?.value.trim(),
    areaId: parseInt(document.getElementById('editModuloAreaSelect')?.value, 10) || null,
    descripcion: document.getElementById('editModuleDescripcion')?.value.trim(),
    estadoId: parseInt(document.getElementById('editModuleEstado')?.value, 10)
  };
  return JSON.stringify(current) !== JSON.stringify(state.initialModuleEditState);
}

export async function handleSaveEditModule(event) {
  event.preventDefault();
  const id = document.getElementById('editModuleId').value;
  const nombre = document.getElementById('editModuleNombre').value.trim();
  const slug = document.getElementById('editModuleSlug').value.trim();
  const areaId = document.getElementById('editModuloAreaSelect').value;
  const descripcion = document.getElementById('editModuleDescripcion').value.trim();
  const estadoId = parseInt(document.getElementById('editModuleEstado').value, 10);

  if (!nombre) {
    getPrixmaSwal().fire({ icon: 'warning', title: 'Atención', text: 'El nombre del módulo no puede quedar vacío.' });
    return;
  }

  try {
    const payload = {
      nombre,
      slug,
      areaId: areaId ? parseInt(areaId, 10) : null,
      descripcion,
      estadoId
    };

    const res = await apiFetch(`/api/modulos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el módulo.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Módulo Actualizado',
      text: 'Los cambios han sido guardados correctamente.',
      timer: 1800,
      showConfirmButton: false
    });

    state.initialModuleEditState = null;
    await loadModulos();
    navigateTo('/modulos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export function handleCancelEditModule(event) {
  if (event) event.preventDefault();
  if (hasModuleEditChanged()) {
    getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Tienes modificaciones sin guardar en este módulo.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Continuar editando'
    }).then(res => {
      if (res.isConfirmed) {
        state.initialModuleEditState = null;
        navigateTo('/modulos');
      }
    });
  } else {
    state.initialModuleEditState = null;
    navigateTo('/modulos');
  }
}

export async function handleDeleteModuleFromForm() {
  const id = document.getElementById('editModuleId').value;
  const nombre = document.getElementById('editModuleNombre').value;
  if (!id) return;
  const deleted = await handleInactivarModulo(id, nombre);
  if (deleted) {
    state.initialModuleEditState = null;
    navigateTo('/modulos');
  }
}

export async function handleInactivarModulo(id, nombre) {
  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar módulo?',
    text: `¿Estás seguro de que deseas eliminar o inactivar el módulo "${nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/modulos/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No fue posible eliminar el módulo.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Módulo Inactivado',
      text: `El módulo "${nombre}" ha sido inactivado correctamente.`,
      timer: 1800,
      showConfirmButton: false
    });

    await loadModulos();
    loadModulesList();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
    return false;
  }
}

export function openEditModuleModal(id) {
  navigateTo(`/modulos/edit/${id}`);
}

export async function handleUpdateModule(event) {
  return handleSaveEditModule(event);
}

export function handleEditModuloInline(id) {
  navigateTo(`/modulos/edit/${id}`);
}
