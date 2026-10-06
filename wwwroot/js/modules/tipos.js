import { apiFetch } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { getPrixmaSwal, getTableSkeletonHtml, setFormReadOnlyMode, setFormSkeletonState } from '../core/ui-helpers.js';

export async function loadPostTipos() {
  try {
    const res = await apiFetch('/api/modulos/tipos');
    if (!res.ok) return;
    const tipos = await res.json();

    const selectTipo = document.getElementById('selectTipo');
    if (!selectTipo) return;
    let selectHtml = '<option value="">Tipo de Publicación</option>';
    tipos.forEach(t => {
      selectHtml += `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`;
    });
    selectTipo.innerHTML = selectHtml;
  } catch (err) {
    console.error('Error cargando tipos de posts:', err);
  }
}

export async function loadTiposConocimiento() {
  try {
    const res = await apiFetch('/api/modulos/tipos-conocimiento');
    if (!res.ok) return;
    const tipos = await res.json();

    const selectTipo = document.getElementById('selectTipoConocimiento');
    const editSelectTipo = document.getElementById('editSelectTipoConocimiento');
    let selectHtml = '<option value="">Seleccionar Tipo de Conocimiento</option>';
    tipos.forEach(t => {
      selectHtml += `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`;
    });
    if (selectTipo) selectTipo.innerHTML = selectHtml;
    if (editSelectTipo) editSelectTipo.innerHTML = selectHtml;
  } catch (err) {
    console.error('Error cargando tipos de conocimiento:', err);
  }
}

let postTiposCurrentPage = 1;
const postTiposPageSize = 5;

export async function loadPostTiposList() {
  const container = document.getElementById('postTiposListContainer');
  if (!container) return;

  container.innerHTML = getTableSkeletonHtml(5, 4);

  try {
    const res = await apiFetch('/api/modulos/tipos');
    if (!res.ok) throw new Error('Error al obtener los tipos de publicación.');

    const tipos = await res.json();
    if (!tipos || tipos.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay tipos de publicación registrados.</div>';
      return;
    }

    const totalItems = tipos.length;
    const totalPages = Math.ceil(totalItems / postTiposPageSize) || 1;

    if (postTiposCurrentPage > totalPages) postTiposCurrentPage = totalPages;
    if (postTiposCurrentPage < 1) postTiposCurrentPage = 1;

    const startIndex = (postTiposCurrentPage - 1) * postTiposPageSize;
    const pageTipos = tipos.slice(startIndex, startIndex + postTiposPageSize);

    let html = `
      <div class="table-responsive">
        <table class="rbac-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--bg-card-border); color:var(--text-muted); font-size:0.85rem;">
              <th style="padding:0.75rem;">Nombre del Tipo</th>
              <th style="padding:0.75rem;">Descripción</th>
              <th style="padding:0.75rem;">Rol Asignado</th>
              <th style="padding:0.75rem; text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pageTipos.map(t => `
              <tr>
                <td style="padding:0.75rem; font-weight:600; color:var(--text-main);">${escapeHtml(t.nombre)}</td>
                <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(t.descripcion || 'Sin descripción')}</td>
                <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">
                  <span class="badge" style="background:rgba(59,130,246,0.1); color:var(--accent-blue, #3b82f6); border:1px solid rgba(59,130,246,0.2); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">
                    <i class="fa-solid fa-user-shield"></i> ${t.rol ? escapeHtml(t.rol.nombre) : 'Todos los roles'}
                  </span>
                </td>
                <td style="padding:0.75rem; text-align:right;">
                  <div style="display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                    <button class="btn btn-secondary" onclick="navigateTo('/tipos/show/' + ${t.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-cyan); border-color:rgba(6,182,212,0.3);" title="Ver Tipo">
                      <i class="fa-solid fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-secondary" onclick="navigateTo('/tipos/edit/' + ${t.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem;" title="Editar Tipo">
                      <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button class="btn btn-secondary" onclick="handleDeletePostTipo(${t.id}, '${escapeHtml(t.nombre)}')" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" title="Eliminar Tipo">
                      <i class="fa-solid fa-trash"></i> Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (totalItems > postTiposPageSize) {
      const prevDisabled = postTiposCurrentPage === 1 ? 'disabled' : '';
      const nextDisabled = postTiposCurrentPage === totalPages ? 'disabled' : '';
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">
          <span>Página ${postTiposCurrentPage} de ${totalPages} (${totalItems} tipos en total)</span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${prevDisabled} onclick="changePostTiposPage(-1)">
              <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${nextDisabled} onclick="changePostTiposPage(1)">
              Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    } else {
      html += `<div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">Mostrando ${totalItems} tipo(s)</div>`;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-rose); text-align:center;">${escapeHtml(err.message)}</div>`;
  }
}

export function changePostTiposPage(delta) {
  postTiposCurrentPage += delta;
  loadPostTiposList();
}

export async function handleCreatePostTipo() {
  const nombreInput = document.getElementById('newPostTipoNombre');
  const descInput = document.getElementById('newPostTipoDesc');

  const nombre = nombreInput ? nombreInput.value.trim() : '';
  const descripcion = descInput ? descInput.value.trim() : '';

  if (!nombre) {
    getPrixmaSwal().fire({
      icon: 'warning',
      title: 'Campo Requerido',
      text: 'Por favor ingresa un nombre para el nuevo tipo de publicación.'
    });
    return;
  }

  try {
    const res = await apiFetch('/api/modulos/tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear el tipo de publicación.');
    }

    if (nombreInput) nombreInput.value = '';
    if (descInput) descInput.value = '';

    await loadPostTiposList();
    await loadPostTipos();
    await loadEditPostTipos();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Tipo Creado',
      text: `El tipo de publicación "${nombre}" ha sido guardado.`,
      timer: 2000,
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

export async function handleEditPostTipo(id, currentNombre, currentDesc) {
  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Tipo de Publicación',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Nombre</label>
          <input id="swal-input-tipo-nombre" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentNombre)}">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Descripción</label>
          <input id="swal-input-tipo-desc" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentDesc)}">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('swal-input-tipo-nombre').value.trim();
      const descripcion = document.getElementById('swal-input-tipo-desc').value.trim();
      if (!nombre) {
        getPrixmaSwal().showValidationMessage('El nombre es requerido');
        return false;
      }
      return { nombre, descripcion };
    }
  });

  if (!formValues) return;

  try {
    const res = await apiFetch(`/api/modulos/tipos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el tipo de publicación.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Tipo Actualizado',
      text: 'Los datos del tipo de publicación se guardaron correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    await loadPostTiposList();
    await loadPostTipos();
    await loadEditPostTipos();
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
}

export async function handleDeletePostTipo(id, nombre) {
  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar Tipo?',
    text: `¿Estás seguro de eliminar el tipo de publicación "${nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--accent-rose, #f43f5e)',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/modulos/tipos/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo eliminar el tipo de publicación.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Tipo Eliminado',
      text: `El tipo "${nombre}" ha sido eliminado.`,
      timer: 2000,
      showConfirmButton: false
    });

    await loadPostTiposList();
    await loadPostTipos();
    await loadEditPostTipos();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar',
      text: err.message
    });
    return false;
  }
}

export function switchTiposSubTab(tab) {
  window.lastTiposSubTab = tab;
  const tabPublicacion = document.getElementById('tiposTabPublicacion');
  const tabConocimiento = document.getElementById('tiposTabConocimiento');
  const btnPublicacion = document.getElementById('tabBtnTiposPublicacion');
  const btnConocimiento = document.getElementById('tabBtnTiposConocimiento');

  if (tabPublicacion) tabPublicacion.classList.add('view-hidden');
  if (tabConocimiento) tabConocimiento.classList.add('view-hidden');
  if (btnPublicacion) btnPublicacion.classList.remove('active-rbac-tab');
  if (btnConocimiento) btnConocimiento.classList.remove('active-rbac-tab');

  if (tab === 'publicacion') {
    if (tabPublicacion) tabPublicacion.classList.remove('view-hidden');
    if (btnPublicacion) btnPublicacion.classList.add('active-rbac-tab');
    loadPostTiposList();
  } else if (tab === 'conocimiento') {
    if (tabConocimiento) tabConocimiento.classList.remove('view-hidden');
    if (btnConocimiento) btnConocimiento.classList.add('active-rbac-tab');
    loadTiposConocimientoList();
  }
}

let tiposConocimientoCurrentPage = 1;
const tiposConocimientoPageSize = 5;

export function changeTiposConocimientoPage(delta) {
  tiposConocimientoCurrentPage += delta;
  loadTiposConocimientoList();
}

export async function loadTiposConocimientoList() {
  const container = document.getElementById('tiposConocimientoListContainer');
  if (!container) return;

  container.innerHTML = getTableSkeletonHtml(5, 3);

  try {
    const res = await apiFetch('/api/modulos/tipos-conocimiento');
    if (!res.ok) throw new Error('Error al obtener los tipos de conocimiento.');

    const tipos = await res.json();
    if (!tipos || tipos.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay tipos de conocimiento registrados.</div>';
      return;
    }

    const totalItems = tipos.length;
    const totalPages = Math.ceil(totalItems / tiposConocimientoPageSize) || 1;

    if (tiposConocimientoCurrentPage > totalPages) tiposConocimientoCurrentPage = totalPages;
    if (tiposConocimientoCurrentPage < 1) tiposConocimientoCurrentPage = 1;

    const startIndex = (tiposConocimientoCurrentPage - 1) * tiposConocimientoPageSize;
    const pageTipos = tipos.slice(startIndex, startIndex + tiposConocimientoPageSize);

    let html = `
      <div class="table-responsive">
        <table class="rbac-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--bg-card-border); color:var(--text-muted); font-size:0.85rem;">
              <th style="padding:0.75rem;">Nombre del Tipo de Conocimiento</th>
              <th style="padding:0.75rem;">Descripción</th>
              <th style="padding:0.75rem; text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pageTipos.map(t => `
              <tr>
                <td style="padding:0.75rem; font-weight:600; color:var(--text-main);">${escapeHtml(t.nombre)}</td>
                <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(t.descripcion || 'Sin descripción')}</td>
                <td style="padding:0.75rem; text-align:right;">
                  <div style="display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
                    <button class="btn btn-secondary" onclick="navigateTo('/tipos-conocimiento/show/' + ${t.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-cyan); border-color:rgba(6,182,212,0.3);" title="Ver Tipo de Conocimiento">
                      <i class="fa-solid fa-eye"></i> Ver
                    </button>
                    <button class="btn btn-secondary" onclick="navigateTo('/tipos-conocimiento/edit/' + ${t.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem;" title="Editar Tipo de Conocimiento">
                      <i class="fa-solid fa-pen"></i> Editar
                    </button>
                    <button class="btn btn-secondary" onclick="handleDeleteTipoConocimiento(${t.id}, '${escapeHtml(t.nombre)}')" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" title="Eliminar Tipo de Conocimiento">
                      <i class="fa-solid fa-trash"></i> Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (totalItems > tiposConocimientoPageSize) {
      const prevDisabled = tiposConocimientoCurrentPage === 1 ? 'disabled' : '';
      const nextDisabled = tiposConocimientoCurrentPage === totalPages ? 'disabled' : '';
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">
          <span>Página ${tiposConocimientoCurrentPage} de ${totalPages} (${totalItems} tipos en total)</span>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${prevDisabled} onclick="changeTiposConocimientoPage(-1)">
              <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${nextDisabled} onclick="changeTiposConocimientoPage(1)">
              Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      `;
    } else {
      html += `<div style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--bg-card-border); font-size:0.85rem; color:var(--text-muted);">Mostrando ${totalItems} tipo(s) de conocimiento</div>`;
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-rose); text-align:center;">${escapeHtml(err.message)}</div>`;
  }
}

export async function handleCreateTipoConocimientoInline() {
  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Crear Tipo de Conocimiento',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Nombre del Tipo de Conocimiento</label>
          <input id="swal-input-tipo-conoc-nombre" class="swal2-input" style="width:100%; margin:0;" placeholder="Ej: General, Técnico, Operativo">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Descripción</label>
          <input id="swal-input-tipo-conoc-desc" class="swal2-input" style="width:100%; margin:0;" placeholder="Breve descripción del área de conocimiento...">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('swal-input-tipo-conoc-nombre').value.trim();
      const descripcion = document.getElementById('swal-input-tipo-conoc-desc').value.trim();
      if (!nombre) {
        getPrixmaSwal().showValidationMessage('El nombre es requerido');
        return false;
      }
      return { nombre, descripcion };
    }
  });

  if (!formValues) return;

  try {
    const res = await apiFetch('/api/modulos/tipos-conocimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear el tipo de conocimiento.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Tipo Creado',
      text: 'El tipo de conocimiento se creó correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    await loadTiposConocimientoList();
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
}

export async function handleEditTipoConocimientoInline(id, currentNombre, currentDesc) {
  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Tipo de Conocimiento',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Nombre</label>
          <input id="swal-input-tipo-conoc-nombre" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentNombre)}">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Descripción</label>
          <input id="swal-input-tipo-conoc-desc" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentDesc)}">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('swal-input-tipo-conoc-nombre').value.trim();
      const descripcion = document.getElementById('swal-input-tipo-conoc-desc').value.trim();
      if (!nombre) {
        getPrixmaSwal().showValidationMessage('El nombre es requerido');
        return false;
      }
      return { nombre, descripcion };
    }
  });

  if (!formValues) return;

  try {
    const res = await apiFetch(`/api/modulos/tipos-conocimiento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el tipo de conocimiento.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Tipo Actualizado',
      text: 'Los datos del tipo de conocimiento se guardaron correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    await loadTiposConocimientoList();
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
}

export async function handleDeleteTipoConocimiento(id, nombre) {
  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar Tipo de Conocimiento?',
    text: `¿Estás seguro de eliminar el tipo de conocimiento "${nombre}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--accent-rose, #f43f5e)',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/modulos/tipos-conocimiento/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo eliminar el tipo de conocimiento.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Tipo Eliminado',
      text: `El tipo de conocimiento "${nombre}" ha sido eliminado.`,
      timer: 2000,
      showConfirmButton: false
    });

    await loadTiposConocimientoList();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar',
      text: err.message
    });
    return false;
  }
}

export async function loadEditPostTipos(selectedTipoId = null) {
  try {
    const res = await apiFetch('/api/modulos/tipos');
    if (!res.ok) return;
    const tipos = await res.json();

    const selectTipo = document.getElementById('editSelectTipo');
    if (!selectTipo) return;

    let selectHtml = '<option value="">Tipo de Publicación</option>';
    tipos.forEach(t => {
      const isSel = selectedTipoId && t.id === selectedTipoId ? 'selected' : '';
      selectHtml += `<option value="${t.id}" ${isSel}>${escapeHtml(t.nombre)}</option>`;
    });
    selectTipo.innerHTML = selectHtml;
  } catch (err) {
    console.error('Error cargando tipos:', err);
  }
}

// Initial values for dirty tracking
export let editPostTipoInitialValues = { nombre: '', descripcion: '' };
export let editTipoConocimientoInitialValues = { nombre: '', descripcion: '' };

export async function prepareCreatePostTipoForm() {
  const form = document.getElementById('createPostTipoForm');
  if (form) form.reset();
}

export async function loadPostTipoForShow(id) {
  if (window.switchAppView) window.switchAppView('viewPostTiposEdit');
  await loadPostTipoForEdit(id);
  setFormReadOnlyMode('editPostTipoForm', true, 'Detalles del Tipo de Publicación', 'fa-eye');
}

export async function loadPostTipoForEdit(id) {
  setFormReadOnlyMode('editPostTipoForm', false);
  setFormSkeletonState('editPostTipoForm', true);
  try {
    const res = await apiFetch(`/api/modulos/tipos/${id}`);
    if (res.ok) {
      const tipo = await res.json();
      const idEl = document.getElementById('editPostTipoId');
      const nombreEl = document.getElementById('editPostTipoNombre');
      const descEl = document.getElementById('editPostTipoDesc');

      if (idEl) idEl.value = tipo.id;
      if (nombreEl) nombreEl.value = tipo.nombre || '';
      if (descEl) descEl.value = tipo.descripcion || '';

      editPostTipoInitialValues = {
        nombre: (tipo.nombre || '').trim(),
        descripcion: (tipo.descripcion || '').trim()
      };
    }
  } catch (e) {
    console.error('Error cargando tipo de publicación para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editPostTipoForm', false), 250);
  }
}

export function hasPostTipoEditChanged() {
  if (document.getElementById('editPostTipoForm')?.dataset.readOnly === 'true') return false;
  const nombre = (document.getElementById('editPostTipoNombre')?.value || '').trim();
  const desc = (document.getElementById('editPostTipoDesc')?.value || '').trim();
  return nombre !== editPostTipoInitialValues.nombre || desc !== editPostTipoInitialValues.descripcion;
}

export async function handleSaveCreatePostTipo(event) {
  if (event) event.preventDefault();
  const nombre = (document.getElementById('newPostTipoNombre')?.value || '').trim();
  const descripcion = (document.getElementById('newPostTipoDesc')?.value || '').trim();
  if (!nombre) return;

  try {
    const res = await apiFetch('/api/modulos/tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear el tipo de publicación.');
    }
    await loadPostTipos();
    await loadPostTiposList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Creado', text: 'El tipo de publicación fue creado correctamente.', timer: 2000, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/tipos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function handleSaveEditPostTipo(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editPostTipoId')?.value;
  const nombre = (document.getElementById('editPostTipoNombre')?.value || '').trim();
  const descripcion = (document.getElementById('editPostTipoDesc')?.value || '').trim();
  if (!id || !nombre) return;

  const hasChanged = hasPostTipoEditChanged();
  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en el tipo "${nombre}"?`
      : `¿Deseas guardar la información del tipo "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/modulos/tipos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el tipo de publicación.');
    }
    await loadPostTipos();
    await loadPostTiposList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/tipos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function handleCancelEditPostTipo(event) {
  if (event) event.preventDefault();
  if (hasPostTipoEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });
    if (!confirmResult.isConfirmed) return;
  }
  if (window.navigateTo) window.navigateTo('/tipos');
}

export async function handleDeleteTipoFromForm() {
  const id = document.getElementById('editPostTipoId')?.value;
  const nombre = document.getElementById('editPostTipoNombre')?.value || 'este tipo';
  if (id) {
    const success = await handleDeletePostTipo(id, nombre);
    if (success && window.navigateTo) window.navigateTo('/tipos');
  }
}

// Tipo de Conocimiento show / edit lifecycles
export async function loadTipoConocimientoForShow(id) {
  if (window.switchAppView) window.switchAppView('viewTipoConocimientoEdit');
  await loadTipoConocimientoForEdit(id);
  setFormReadOnlyMode('editTipoConocimientoForm', true, 'Detalles del Tipo de Conocimiento', 'fa-eye');
}

export async function loadTipoConocimientoForEdit(id) {
  setFormReadOnlyMode('editTipoConocimientoForm', false);
  setFormSkeletonState('editTipoConocimientoForm', true);
  try {
    const res = await apiFetch(`/api/modulos/tipos-conocimiento/${id}`);
    if (res.ok) {
      const tipo = await res.json();
      const idEl = document.getElementById('editTipoConocimientoId');
      const nombreEl = document.getElementById('editTipoConocimientoNombre');
      const descEl = document.getElementById('editTipoConocimientoDesc');

      if (idEl) idEl.value = tipo.id;
      if (nombreEl) nombreEl.value = tipo.nombre || '';
      if (descEl) descEl.value = tipo.descripcion || '';

      editTipoConocimientoInitialValues = {
        nombre: (tipo.nombre || '').trim(),
        descripcion: (tipo.descripcion || '').trim()
      };
    }
  } catch (e) {
    console.error('Error cargando tipo de conocimiento para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editTipoConocimientoForm', false), 250);
  }
}

export function hasTipoConocimientoEditChanged() {
  if (document.getElementById('editTipoConocimientoForm')?.dataset.readOnly === 'true') return false;
  const nombre = (document.getElementById('editTipoConocimientoNombre')?.value || '').trim();
  const desc = (document.getElementById('editTipoConocimientoDesc')?.value || '').trim();
  return nombre !== editTipoConocimientoInitialValues.nombre || desc !== editTipoConocimientoInitialValues.descripcion;
}

export async function handleSaveCreateTipoConocimiento(event) {
  if (event) event.preventDefault();
  const nombre = (document.getElementById('newTipoConocimientoNombre')?.value || '').trim();
  const descripcion = (document.getElementById('newTipoConocimientoDesc')?.value || '').trim();
  if (!nombre) return;

  try {
    const res = await apiFetch('/api/modulos/tipos-conocimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear el tipo de conocimiento.');
    }
    await loadTiposConocimiento();
    await loadTiposConocimientoList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Creado', text: 'El tipo de conocimiento fue creado correctamente.', timer: 2000, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/tipos-conocimiento');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function handleSaveEditTipoConocimiento(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editTipoConocimientoId')?.value;
  const nombre = (document.getElementById('editTipoConocimientoNombre')?.value || '').trim();
  const descripcion = (document.getElementById('editTipoConocimientoDesc')?.value || '').trim();
  if (!id || !nombre) return;

  const hasChanged = hasTipoConocimientoEditChanged();
  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en el tipo "${nombre}"?`
      : `¿Deseas guardar la información del tipo "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/modulos/tipos-conocimiento/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el tipo de conocimiento.');
    }
    await loadTiposConocimiento();
    await loadTiposConocimientoList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/tipos-conocimiento');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function handleCancelEditTipoConocimiento(event) {
  if (event) event.preventDefault();
  if (hasTipoConocimientoEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });
    if (!confirmResult.isConfirmed) return;
  }
  if (window.navigateTo) window.navigateTo('/tipos-conocimiento');
}

export async function handleDeleteTipoConocimientoFromForm() {
  const id = document.getElementById('editTipoConocimientoId')?.value;
  const nombre = document.getElementById('editTipoConocimientoNombre')?.value || 'este tipo de conocimiento';
  if (id) {
    const success = await handleDeleteTipoConocimiento(id, nombre);
    if (success && window.navigateTo) window.navigateTo('/tipos-conocimiento');
  }
}

