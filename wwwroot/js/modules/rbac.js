import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { getPrixmaSwal, setFormReadOnlyMode, setFormSkeletonState } from '../core/ui-helpers.js';
import { hasPermission } from './auth.js';

let rbacAllUsersCache = [];
let rbacAllRolesCache = [];
let rbacUserSearchTerm = '';
let rbacUsersCurrentPage = 1;
const rbacUsersPageSize = 6;
let rbacRolesCurrentPage = 1;
const rbacRolesPageSize = 5;

export async function loadRbacUsers() {
  const tbody = document.getElementById('usersRolesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios...</td></tr>';

  try {
    const [resUsers, resRoles] = await Promise.all([
      apiFetch('/api/roles/usuarios'),
      apiFetch('/api/roles')
    ]);

    if (!resUsers.ok || !resRoles.ok) throw new Error('Error al cargar datos de usuarios o roles.');

    rbacAllUsersCache = await resUsers.json();
    rbacAllRolesCache = await resRoles.json();
    rbacUsersCurrentPage = 1;
    rbacUserSearchTerm = '';

    const searchInput = document.getElementById('rbacUserSearchInput');
    if (searchInput) searchInput.value = '';

    renderRbacUsersTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--accent-rose); text-align:center; padding:1.5rem;">${escapeHtml(err.message)}</td></tr>`;
  }
}

export function onRbacUserSearchInput() {
  const searchInput = document.getElementById('rbacUserSearchInput');
  rbacUserSearchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  rbacUsersCurrentPage = 1;
  renderRbacUsersTable();
}

export function renderRbacUsersTable() {
  const tbody = document.getElementById('usersRolesTableBody');
  const paginationContainer = document.getElementById('rbacUsersPagination');
  if (!tbody) return;

  let filtered = rbacAllUsersCache;
  if (rbacUserSearchTerm) {
    filtered = filtered.filter(u =>
      (u.nombre && u.nombre.toLowerCase().includes(rbacUserSearchTerm)) ||
      (u.correo && u.correo.toLowerCase().includes(rbacUserSearchTerm)) ||
      (u.rolNombre && u.rolNombre.toLowerCase().includes(rbacUserSearchTerm))
    );
  }

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / rbacUsersPageSize) || 1;

  if (rbacUsersCurrentPage > totalPages) rbacUsersCurrentPage = totalPages;
  if (rbacUsersCurrentPage < 1) rbacUsersCurrentPage = 1;

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>';
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  const startIndex = (rbacUsersCurrentPage - 1) * rbacUsersPageSize;
  const pageUsers = filtered.slice(startIndex, startIndex + rbacUsersPageSize);

  tbody.innerHTML = pageUsers.map(u => {
    let roleOptions = rbacAllRolesCache.map(r => `<option value="${r.id}" ${r.id === u.rolId ? 'selected' : ''}>${escapeHtml(r.nombre)}</option>`).join('');

    const initial = (u.nombre && u.nombre.trim().length > 0) ? u.nombre.trim().charAt(0).toUpperCase() : 'U';

    return `
      <tr>
        <td style="padding:0.75rem; font-weight:600; color:var(--text-main);">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <div style="width:34px; height:34px; border-radius:50%; background:rgba(99,102,241,0.15); color:var(--primary); font-weight:700; font-size:0.85rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${escapeHtml(initial)}
            </div>
            <span>${escapeHtml(u.nombre)}</span>
          </div>
        </td>
        <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(u.correo)}</td>
        <td style="padding:0.75rem; text-align:right;">
          <div style="display:inline-flex; gap:0.5rem; align-items:center; justify-content:flex-end;">
            <select id="userRoleSelect_${u.id}" class="form-control" onchange="handleAssignUserRole(${u.id}, this.value)" style="width:auto; min-width:150px; padding:0.35rem 0.65rem; font-size:0.85rem; font-weight:600; cursor:pointer;" title="Cambiar rol (Se guarda automáticamente)">
              ${roleOptions}
            </select>
            <span id="userRoleSaveIndicator_${u.id}" style="font-size:0.75rem; color:var(--text-muted); min-width:85px; text-align:left; display:inline-flex; align-items:center; gap:3px;">
              <i class="fa-solid fa-bolt" style="color:var(--primary); font-size:0.7rem;" title="Guardado automático al cambiar"></i>
              <span style="font-size:0.72rem;">Auto-guardar</span>
            </span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (paginationContainer) {
    if (totalItems <= rbacUsersPageSize) {
      paginationContainer.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Mostrando ${totalItems} usuario(s)</span>`;
    } else {
      const prevDisabled = rbacUsersCurrentPage === 1 ? 'disabled' : '';
      const nextDisabled = rbacUsersCurrentPage === totalPages ? 'disabled' : '';

      paginationContainer.innerHTML = `
        <span>Mostrando ${startIndex + 1}-${Math.min(startIndex + rbacUsersPageSize, totalItems)} de ${totalItems} usuarios</span>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <button class="btn btn-secondary" style="padding:0.3rem 0.65rem; font-size:0.8rem;" ${prevDisabled} onclick="changeRbacUsersPage(${rbacUsersCurrentPage - 1})">
            <i class="fa-solid fa-chevron-left"></i> Anterior
          </button>
          <span style="font-size:0.8rem; padding:0 0.4rem;">Pág. <strong>${rbacUsersCurrentPage}</strong> de ${totalPages}</span>
          <button class="btn btn-secondary" style="padding:0.3rem 0.65rem; font-size:0.8rem;" ${nextDisabled} onclick="changeRbacUsersPage(${rbacUsersCurrentPage + 1})">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      `;
    }
  }
}

export function changeRbacUsersPage(newPage) {
  rbacUsersCurrentPage = newPage;
  renderRbacUsersTable();
}

export async function handleAssignUserRole(usuarioId, explicitRolId = null) {
  let rolId = explicitRolId;
  if (!rolId) {
    const select = document.getElementById(`userRoleSelect_${usuarioId}`);
    if (select) rolId = select.value;
  }
  if (!rolId) return;

  const targetUser = rbacAllUsersCache.find(u => u.id === parseInt(usuarioId));
  if (targetUser && targetUser.rolId === parseInt(rolId)) {
    return;
  }

  const indicator = document.getElementById(`userRoleSaveIndicator_${usuarioId}`);
  if (indicator) {
    indicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--primary);"></i> <span style="font-size:0.72rem; color:var(--text-muted);">Guardando...</span>';
  }

  try {
    const res = await apiFetch('/api/roles/asignar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: parseInt(usuarioId), rolId: parseInt(rolId) })
    });

    if (!res.ok) throw new Error('Error al asignar el rol.');

    const targetRole = rbacAllRolesCache.find(r => r.id === parseInt(rolId));
    if (targetUser && targetRole) {
      targetUser.rolId = targetRole.id;
      targetUser.rolNombre = targetRole.nombre;
    }

    if (indicator) {
      indicator.innerHTML = '<i class="fa-solid fa-check" style="color:#10b981;"></i> <span style="font-size:0.72rem; color:#10b981; font-weight:600;">Guardado</span>';
      setTimeout(() => {
        if (indicator) indicator.innerHTML = '<i class="fa-solid fa-bolt" style="color:var(--primary); font-size:0.7rem;" title="Guardado automático al cambiar"></i> <span style="font-size:0.72rem; color:var(--text-muted);">Auto-guardar</span>';
      }, 2500);
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Rol Actualizado',
      text: `El rol de "${targetUser ? targetUser.nombre : 'usuario'}" se ha cambiado a "${targetRole ? targetRole.nombre : ''}".`,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    if (indicator) {
      indicator.innerHTML = '<i class="fa-solid fa-xmark" style="color:var(--accent-rose);"></i> <span style="font-size:0.72rem; color:var(--accent-rose);">Error</span>';
    }
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Asignación',
      text: err.message
    });
  }
}

let rbacMatrixViewMode = 'cards';
let rbacCachedRoles = [];
let rbacCachedPermisos = [];

export function switchRbacMatrixView(mode) {
  rbacMatrixViewMode = mode;
  ['btnRbacViewCards', 'btnRbacViewCardsIndex'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.background = mode === 'cards' ? 'var(--primary)' : 'transparent';
      el.style.color = mode === 'cards' ? 'white' : 'var(--text-muted)';
    }
  });
  ['btnRbacViewTable', 'btnRbacViewTableIndex'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.background = mode === 'table' ? 'var(--primary)' : 'transparent';
      el.style.color = mode === 'table' ? 'white' : 'var(--text-muted)';
    }
  });

  renderRbacMatrix();
}

function getRoleIcon(roleName) {
  const name = (roleName || '').toLowerCase();
  if (name.includes('admin')) return 'fa-user-shield';
  if (name.includes('edit')) return 'fa-user-pen';
  if (name.includes('lect') || name.includes('read')) return 'fa-user-check';
  return 'fa-user-gear';
}

export function renderRbacMatrix() {
  const container = document.getElementById('rolesMatrixContainer');
  if (!container) return;

  const roles = rbacCachedRoles || [];
  const permisos = (rbacCachedPermisos || []).filter(p => p.codigo !== 'tipos_conocimiento.manage');

  if (roles.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No hay roles registrados.</div>';
    return;
  }

  if (rbacMatrixViewMode === 'cards') {
    container.className = 'roles-matrix-grid';
    container.innerHTML = roles.map(r => {
      const activePermIds = new Set((r.permisos || []).map(p => p.id));
      const roleIcon = getRoleIcon(r.nombre);

      const chipsHtml = permisos.map(p => {
        const isChecked = activePermIds.has(p.id);
        return `
          <label class="perm-chip ${isChecked ? 'is-active' : ''}">
            <input type="checkbox" class="role-perm-cb-${r.id}" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="this.closest('.perm-chip').classList.toggle('is-active', this.checked)">
            <div class="perm-chip-content">
              <span class="perm-chip-name">${escapeHtml(p.nombre)}</span>
            </div>
          </label>
        `;
      }).join('');

      return `
        <div class="role-card">
          <div class="role-header">
            <div class="role-title-box">
              <div class="role-icon-avatar">
                <i class="fa-solid ${roleIcon}"></i>
              </div>
              <div>
                <strong style="font-size:1.05rem; color:var(--text-main); display:block; line-height:1.2;">${escapeHtml(r.nombre)}</strong>
                <span style="font-size:0.78rem; color:var(--text-muted); line-height:1.2;">${escapeHtml(r.descripcion || 'Sin descripción')}</span>
              </div>
            </div>
            <div class="role-header-actions">
              <button type="button" class="btn btn-secondary btn-sm" onclick="handleCheckAllRolePermisos(${r.id})" title="Marcar todos los permisos" style="padding:0.35rem 0.6rem; font-size:0.75rem;">
                <i class="fa-solid fa-square-check"></i> Marcar
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="handleUncheckAllRolePermisos(${r.id})" title="Desmarcar todos los permisos" style="padding:0.35rem 0.6rem; font-size:0.75rem;">
                <i class="fa-solid fa-square-minus"></i> Desmarcar
              </button>
              <button type="button" class="btn btn-primary btn-sm" onclick="handleSaveRolePermisos(${r.id})" style="padding:0.35rem 0.75rem; font-size:0.75rem;">
                <i class="fa-solid fa-floppy-disk"></i> Guardar
              </button>
            </div>
          </div>
          <div class="perm-checkbox-group">
            ${chipsHtml}
          </div>
        </div>
      `;
    }).join('');
  } else {
    // Comparative Table View
    container.className = 'rbac-matrix-table-container';

    const roleHeadersHtml = roles.map(r => `
      <th class="cell-center" style="min-width: 130px;">
        <div style="font-size:0.9rem; font-weight:700; color:var(--text-main); margin-bottom:0.3rem;">
          <i class="fa-solid ${getRoleIcon(r.nombre)}" style="color:var(--primary); margin-right:4px;"></i>
          ${escapeHtml(r.nombre)}
        </div>
        <div style="display:flex; gap:0.25rem; justify-content:center; flex-wrap:wrap; margin-top:0.25rem;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="handleCheckAllRolePermisos(${r.id})" title="Marcar todos" style="padding:0.2rem 0.4rem; font-size:0.7rem;">
            <i class="fa-solid fa-square-check"></i>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="handleUncheckAllRolePermisos(${r.id})" title="Desmarcar todos" style="padding:0.2rem 0.4rem; font-size:0.7rem;">
            <i class="fa-solid fa-square-minus"></i>
          </button>
          <button type="button" class="btn btn-primary btn-sm" onclick="handleSaveRolePermisos(${r.id})" title="Guardar" style="padding:0.2rem 0.5rem; font-size:0.7rem;">
            <i class="fa-solid fa-floppy-disk"></i>
          </button>
        </div>
      </th>
    `).join('');

    const rowsHtml = permisos.map(p => {
      const roleCellsHtml = roles.map(r => {
        const activePermIds = new Set((r.permisos || []).map(item => item.id));
        const isChecked = activePermIds.has(p.id);
        return `
          <td class="cell-center">
            <input type="checkbox" class="role-perm-cb-${r.id}" value="${p.id}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--primary); cursor:pointer;">
          </td>
        `;
      }).join('');

      return `
        <tr>
          <td>
            <strong style="font-size:0.88rem; color:var(--text-main); display:block;">${escapeHtml(p.nombre)}</strong>
            ${p.descripcion ? `<p style="font-size:0.75rem; color:var(--text-muted); margin:2px 0 0 0;">${escapeHtml(p.descripcion)}</p>` : ''}
          </td>
          ${roleCellsHtml}
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table class="rbac-matrix-table">
        <thead>
          <tr>
            <th style="min-width: 240px;">Permiso</th>
            ${roleHeadersHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }
}

export async function loadRbacMatrix() {
  const container = document.getElementById('rolesMatrixContainer');
  if (!container) return;

  container.className = '';
  container.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando matriz de permisos...</div>';

  try {
    const [resRoles, resPermisos] = await Promise.all([
      apiFetch('/api/roles'),
      apiFetch('/api/roles/permisos')
    ]);

    if (!resRoles.ok || !resPermisos.ok) throw new Error('Error al cargar permisos.');

    rbacCachedRoles = await resRoles.json();
    rbacCachedPermisos = await resPermisos.json();

    renderRbacMatrix();
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-rose); text-align:center;">${escapeHtml(err.message)}</div>`;
  }
}

export function handleCheckAllRolePermisos(rolId) {
  const checkboxes = document.querySelectorAll(`.role-perm-cb-${rolId}`);
  checkboxes.forEach(cb => { 
    cb.checked = true; 
    const chip = cb.closest('.perm-chip');
    if (chip) chip.classList.add('is-active');
  });
}

export function handleUncheckAllRolePermisos(rolId) {
  const checkboxes = document.querySelectorAll(`.role-perm-cb-${rolId}`);
  checkboxes.forEach(cb => { 
    cb.checked = false; 
    const chip = cb.closest('.perm-chip');
    if (chip) chip.classList.remove('is-active');
  });
}

export async function handleSaveRolePermisos(rolId) {
  const checkboxes = document.querySelectorAll(`.role-perm-cb-${rolId}:checked`);
  const permisosIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  try {
    const res = await apiFetch(`/api/roles/${rolId}/permisos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permisosIds })
    });

    if (!res.ok) throw new Error('Error al actualizar permisos del rol.');

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Permisos Actualizados',
      text: 'Los permisos del rol han sido guardados correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    loadRbacMatrix();
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Guardado',
      text: err.message
    });
  }
}

export function toggleNewRoleForm() {
  const form = document.getElementById('newRoleForm');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

export async function handleCreateRole() {
  const nombre = document.getElementById('newRoleNombre').value.trim();
  const descripcion = document.getElementById('newRoleDesc').value.trim();

  if (!nombre) {
    getPrixmaSwal().fire({
      icon: 'warning',
      title: 'Campo Requerido',
      text: 'Por favor ingresa un nombre para el nuevo rol.'
    });
    return;
  }

  try {
    const res = await apiFetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, permisosIds: [] })
    });

    if (!res.ok) throw new Error('Error al crear el rol.');
    toggleNewRoleForm();
    const nameInput = document.getElementById('newRoleNombre');
    const descInput = document.getElementById('newRoleDesc');
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    loadRbacRolesList();
    loadRbacMatrix();
    loadRbacUsers();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Rol Creado',
      text: `El rol "${nombre}" ha sido registrado.`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Crear Rol',
      text: err.message
    });
  }
}

export async function loadRbacRolesList() {
  const tbody = document.getElementById('rolesManagementTableBody');
  if (!tbody) return;

  tbody.innerHTML = Array.from({ length: 4 }).map(() => '<tr><td colspan="4" style="padding:0.75rem;"><div class="skeleton-box" style="height:18px; width:85%; border-radius:4px;"></div></td></tr>').join('');

  try {
    const res = await apiFetch('/api/roles');
    if (!res.ok) throw new Error('Error al obtener la lista de roles.');

    const roles = await res.json();
    rbacAllRolesCache = roles;
    rbacRolesCurrentPage = 1;

    renderRbacRolesTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--accent-rose); text-align:center; padding:1.5rem;">${escapeHtml(err.message)}</td></tr>`;
  }
}

export function renderRbacRolesTable() {
  const tbody = document.getElementById('rolesManagementTableBody');
  const paginationContainer = document.getElementById('rbacRolesPagination');
  if (!tbody) return;

  const roles = rbacAllRolesCache || [];
  const totalItems = roles.length;
  const totalPages = Math.ceil(totalItems / rbacRolesPageSize) || 1;

  if (rbacRolesCurrentPage > totalPages) rbacRolesCurrentPage = totalPages;
  if (rbacRolesCurrentPage < 1) rbacRolesCurrentPage = 1;

  if (totalItems === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay roles registrados.</td></tr>';
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  const startIndex = (rbacRolesCurrentPage - 1) * rbacRolesPageSize;
  const pageRoles = roles.slice(startIndex, startIndex + rbacRolesPageSize);

  tbody.innerHTML = pageRoles.map(r => {
    const isSystemRole = (r.id === 1 || r.nombre === 'Administrador');
    const deleteBtnHtml = isSystemRole ? '' : `
      <button class="btn btn-secondary" onclick="handleDeleteRole(${r.id}, '${escapeHtml(r.nombre)}')" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" title="Eliminar Rol">
        <i class="fa-solid fa-trash"></i> Eliminar
      </button>
    `;

    return `
      <tr>
        <td style="padding:0.75rem; font-weight:600; color:var(--text-main);">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            ${escapeHtml(r.nombre)}
            ${isSystemRole ? '<span class="badge" style="background:rgba(99,102,241,0.2); color:#818cf8; font-size:0.7rem; padding:2px 8px; border-radius:12px;">Sistema</span>' : ''}
          </div>
        </td>
        <td style="padding:0.75rem; color:var(--text-muted); font-size:0.85rem;">${escapeHtml(r.descripcion || 'Sin descripción')}</td>
        <td style="padding:0.75rem;"><span class="badge" style="position:static; background:var(--primary-glow); color:var(--primary); font-weight:700; font-size:0.85rem; padding:4px 10px; border-radius:12px;">${r.permisos ? r.permisos.length : 0}</span></td>
        <td style="padding:0.75rem; text-align:right;">
          <div style="display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
            <button class="btn btn-secondary" onclick="navigateTo('/roles/show/' + ${r.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; color:var(--accent-cyan); border-color:rgba(6,182,212,0.3);" title="Ver Rol">
              <i class="fa-solid fa-eye"></i> Ver
            </button>
            <button class="btn btn-secondary" onclick="navigateTo('/roles/edit/' + ${r.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem;" title="Editar Rol">
              <i class="fa-solid fa-pen"></i> Editar
            </button>
            ${deleteBtnHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (paginationContainer) {
    if (totalItems <= rbacRolesPageSize) {
      paginationContainer.innerHTML = `<span style="font-size:0.8rem; color:var(--text-muted);">Mostrando ${totalItems} rol(es)</span>`;
    } else {
      const prevDisabled = rbacRolesCurrentPage === 1 ? 'disabled' : '';
      const nextDisabled = rbacRolesCurrentPage === totalPages ? 'disabled' : '';

      paginationContainer.innerHTML = `
        <span style="font-size:0.8rem; color:var(--text-muted);">Página ${rbacRolesCurrentPage} de ${totalPages} (${totalItems} roles en total)</span>
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${prevDisabled} onclick="changeRbacRolesPage(-1)">
            <i class="fa-solid fa-chevron-left"></i> Anterior
          </button>
          <button class="btn btn-secondary" style="padding:0.3rem 0.75rem; font-size:0.8rem;" ${nextDisabled} onclick="changeRbacRolesPage(1)">
            Siguiente <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      `;
    }
  }
}

export function changeRbacRolesPage(delta) {
  rbacRolesCurrentPage += delta;
  renderRbacRolesTable();
}

export function switchRbacSubTab(tab) {
  const tabUsers = document.getElementById('rbacTabUsers');
  const tabRoles = document.getElementById('rbacTabRoles');
  const tabMatrix = document.getElementById('rbacTabMatrix');

  const btnUsers = document.getElementById('tabBtnUsersRole');
  const btnRoles = document.getElementById('tabBtnRolesManage');
  const btnMatrix = document.getElementById('tabBtnRolesMatrix');

  if (tabUsers) tabUsers.classList.add('view-hidden');
  if (tabRoles) tabRoles.classList.add('view-hidden');
  if (tabMatrix) tabMatrix.classList.add('view-hidden');

  if (btnUsers) btnUsers.classList.remove('active-rbac-tab');
  if (btnRoles) btnRoles.classList.remove('active-rbac-tab');
  if (btnMatrix) btnMatrix.classList.remove('active-rbac-tab');

  if (tab === 'users') {
    if (tabUsers) tabUsers.classList.remove('view-hidden');
    if (btnUsers) btnUsers.classList.add('active-rbac-tab');
  } else if (tab === 'roles') {
    if (tabRoles) tabRoles.classList.remove('view-hidden');
    if (btnRoles) btnRoles.classList.add('active-rbac-tab');
    loadRbacRolesList();
  } else if (tab === 'matrix') {
    if (tabMatrix) tabMatrix.classList.remove('view-hidden');
    if (btnMatrix) btnMatrix.classList.add('active-rbac-tab');
    loadRbacMatrix();
  }
}

export function openRbacModal() {
  if (!hasPermission('roles.manage')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permiso para acceder a la gestión de roles.'
    });
    return;
  }
  if (window.navigateTo) window.navigateTo('/rbac');
}

export async function handleDeleteRole(rolId, rolNombre) {
  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar Rol?',
    text: `¿Estás seguro de que deseas eliminar el rol "${rolNombre}"? Esta acción no se puede deshacer.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--accent-rose, #f43f5e)',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/roles/${rolId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo eliminar el rol.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Rol Eliminado',
      text: data.message || 'El rol fue eliminado exitosamente.',
      timer: 2000,
      showConfirmButton: false
    });

    loadRbacRolesList();
    loadRbacMatrix();
    loadRbacUsers();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Inactivación',
      text: err.message
    });
    return false;
  }
}

// Dedicated View Functions for Role Detail / Edit View
export let editRoleInitialValues = { nombre: '', descripcion: '' };

export async function loadRoleForShow(id) {
  if (window.switchAppView) window.switchAppView('viewRoleEdit');
  await loadRoleForEdit(id);
  setFormReadOnlyMode('editRoleForm', true, 'Detalles del Rol', 'fa-eye');
}

export async function loadRoleForEdit(id) {
  setFormReadOnlyMode('editRoleForm', false);
  setFormSkeletonState('editRoleForm', true);
  try {
    let role = rbacAllRolesCache.find(r => r.id === parseInt(id, 10));
    if (!role) {
      const res = await apiFetch(`/api/roles/${id}`);
      if (res.ok) role = await res.json();
    }
    if (role) {
      const idEl = document.getElementById('editRoleId');
      const nombreEl = document.getElementById('editRoleNombre');
      const descEl = document.getElementById('editRoleDesc');

      if (idEl) idEl.value = role.id;
      if (nombreEl) nombreEl.value = role.nombre || '';
      if (descEl) descEl.value = role.descripcion || '';

      editRoleInitialValues = {
        nombre: (role.nombre || '').trim(),
        descripcion: (role.descripcion || '').trim()
      };
    }
  } catch (e) {
    console.error('Error cargando rol para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editRoleForm', false), 250);
  }
}

export function hasRoleEditChanged() {
  if (document.getElementById('editRoleForm')?.dataset.readOnly === 'true') return false;
  const nombre = (document.getElementById('editRoleNombre')?.value || '').trim();
  const desc = (document.getElementById('editRoleDesc')?.value || '').trim();
  return nombre !== editRoleInitialValues.nombre || desc !== editRoleInitialValues.descripcion;
}

export async function handleSaveCreateRole(event) {
  if (event) event.preventDefault();
  const nombre = (document.getElementById('newRoleNombre')?.value || '').trim();
  const descripcion = (document.getElementById('newRoleDesc')?.value || '').trim();
  if (!nombre) return;

  try {
    const res = await apiFetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, permisosIds: [] })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al crear el rol.');
    }
    await loadRbacRolesList();
    await loadRbacMatrix();
    await loadRbacUsers();
    getPrixmaSwal().fire({ icon: 'success', title: 'Rol Creado', text: `El rol "${nombre}" ha sido registrado.`, timer: 2000, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/rbac');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error al Crear Rol', text: err.message });
  }
}

export async function handleSaveEditRole(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editRoleId')?.value;
  const nombre = (document.getElementById('editRoleNombre')?.value || '').trim();
  const descripcion = (document.getElementById('editRoleDesc')?.value || '').trim();
  if (!id || !nombre) return;

  const hasChanged = hasRoleEditChanged();
  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en el rol "${nombre}"?`
      : `¿Deseas guardar la información del rol "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el rol.');
    }
    await loadRbacRolesList();
    await loadRbacMatrix();
    await loadRbacUsers();
    getPrixmaSwal().fire({ icon: 'success', title: 'Rol Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    if (window.navigateTo) window.navigateTo('/rbac');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

export async function handleCancelEditRole(event) {
  if (event) event.preventDefault();
  if (hasRoleEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones en este rol. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });
    if (!confirmResult.isConfirmed) return;
  }
  if (window.navigateTo) window.navigateTo('/rbac');
}

export async function handleDeleteRoleFromForm() {
  const id = document.getElementById('editRoleId')?.value;
  const nombre = document.getElementById('editRoleNombre')?.value || 'este rol';
  if (id) {
    const success = await handleDeleteRole(id, nombre);
    if (success && window.navigateTo) window.navigateTo('/rbac');
  }
}

