import { state } from '../core/state.js';
import { getAppBasePath } from '../core/utils.js';
import { startTopProgressBar, finishTopProgressBar } from '../core/ui-helpers.js';
import { showAuthGate, hasPermission, renderUserNavArea } from '../modules/auth.js';
import { loadPosts, openDetailView, openEditView } from '../modules/posts.js';
import { loadAreas, loadAreasList, renderAreaTabs, populateAreaSelects } from '../modules/areas.js';
import { loadModulos, loadModulesList, updateModulePillActiveState, populateModuloAreaSelect, updatePostSubmoduloSelect } from '../modules/modulos.js';
import { loadPostTipos, loadPostTiposList, loadTiposConocimiento, loadTiposConocimientoList, switchTiposSubTab } from '../modules/tipos.js';
import { loadRbacUsers, loadRbacRolesList, loadRbacMatrix } from '../modules/rbac.js';

export function navigateTo(path) {
  if (!path) path = '/dashboard';
  if (path.startsWith('#')) path = path.substring(1);
  if (!path.startsWith('/')) path = '/' + path;

  const cleanPath = path.split('#')[0];
  const basePath = getAppBasePath();
  const targetPath = (basePath ? basePath : '') + cleanPath;

  if (window.location.pathname !== targetPath || window.location.hash) {
    window.history.pushState({}, '', targetPath);
  }
  state.isHandlingRoute = false;
  handleRoute();
}

export function switchAppView(viewId) {
  const views = [
    'viewDashboard', 'viewCreatePost', 'viewEditPost', 'viewPostDetail',
    'viewAreaIndex', 'viewAreaCreate', 'viewAreaEdit',
    'viewModuleIndex', 'viewModuleCreate', 'viewModuleEdit',
    'viewPostTiposIndex', 'viewPostTiposCreate', 'viewPostTiposEdit',
    'viewTipoConocimientoCreate', 'viewTipoConocimientoEdit',
    'viewRbacIndex', 'viewRoleCreate', 'viewRoleEdit'
  ];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === viewId) {
        el.classList.remove('view-hidden');
      } else {
        el.classList.add('view-hidden');
      }
    }
  });
  window.scrollTo(0, 0);
}

export function switchMainCategory(categoriaPadre, tabBtnElement) {
  if (categoriaPadre) {
    navigateTo(`/area/${encodeURIComponent(categoriaPadre)}`);
  } else {
    navigateTo('/dashboard');
  }
}

export async function showMainApp() {
  const authGate = document.getElementById('authGateScreen');
  const mainApp = document.getElementById('appMainArea');
  if (authGate) authGate.classList.add('view-hidden');
  if (mainApp) mainApp.classList.remove('view-hidden');

  renderUserNavArea();

  if (!state.isAppInitialized) {
    state.isAppInitialized = true;
    await loadAreas();
    await loadModulos();
    await loadPostTipos();
    await loadTiposConocimiento();
    await loadPosts();
  }
}

export async function handleRoute() {
  if (state.isHandlingRoute) return;
  state.isHandlingRoute = true;
  startTopProgressBar();

  try {
    let rawPath = window.location.pathname;
    const basePath = getAppBasePath();
    if (basePath && rawPath.startsWith(basePath)) {
      rawPath = rawPath.substring(basePath.length);
    }
    if (window.location.hash) {
      const hashPath = window.location.hash.replace(/^#/, '');
      if (hashPath && !hashPath.startsWith('http')) {
        rawPath = hashPath.startsWith('/') ? hashPath : '/' + hashPath;
      }
    }
    if (!rawPath || rawPath === '/' || rawPath === '/index.html') {
      rawPath = '/dashboard';
    }
    const cleanHash = rawPath.split('?')[0].split('#')[0];

    // 1. Ruta de Login
    if (cleanHash === '/login') {
      if (state.currentUser && state.jwtToken) {
        navigateTo('/dashboard');
        return;
      }
      showAuthGate();
      return;
    }

    // 2. Control de Acceso: si no hay sesión activa ni token, redirigir a /login
    const activeToken = state.jwtToken || localStorage.getItem('jwtToken');
    if (!state.currentUser || !activeToken) {
      navigateTo('/login');
      return;
    }

    // 3. Mostrar Vista Principal de la App
    await showMainApp();

    // 4. Subrutas de Navegación SPA por Recurso
    if (cleanHash === '/rbac' || cleanHash === '/roles') {
      if (!hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewRbacIndex');
      loadRbacUsers();
      loadRbacRolesList();
      loadRbacMatrix();
    } else if (cleanHash === '/roles/create') {
      if (!hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewRoleCreate');
      const f = document.getElementById('createRoleForm');
      if (f) f.reset();
    } else if (cleanHash.startsWith('/roles/show/')) {
      const roleId = cleanHash.replace('/roles/show/', '');
      if (window.loadRoleForShow) await window.loadRoleForShow(roleId);
    } else if (cleanHash.startsWith('/roles/edit/')) {
      if (!hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      const roleId = cleanHash.replace('/roles/edit/', '');
      switchAppView('viewRoleEdit');
      if (window.loadRoleForEdit) await window.loadRoleForEdit(roleId);
    } else if (cleanHash === '/areas') {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewAreaIndex');
      loadAreasList();
    } else if (cleanHash === '/areas/create') {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewAreaCreate');
      const f = document.getElementById('createAreaForm');
      if (f) f.reset();
    } else if (cleanHash.startsWith('/areas/show/')) {
      const areaId = cleanHash.replace('/areas/show/', '');
      if (window.loadAreaForShow) await window.loadAreaForShow(areaId);
    } else if (cleanHash.startsWith('/areas/edit/')) {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      const areaId = cleanHash.replace('/areas/edit/', '');
      switchAppView('viewAreaEdit');
      if (window.loadAreaForEdit) window.loadAreaForEdit(areaId);
    } else if (cleanHash === '/modulos') {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewModuleIndex');
      populateModuloAreaSelect();
      loadModulesList();
    } else if (cleanHash === '/modulos/create') {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewModuleCreate');
      populateModuloAreaSelect();
      const f = document.getElementById('createModuleForm');
      if (f) f.reset();
    } else if (cleanHash.startsWith('/modulos/show/')) {
      const modId = cleanHash.replace('/modulos/show/', '');
      if (window.loadModuleForShow) await window.loadModuleForShow(modId);
    } else if (cleanHash.startsWith('/modulos/edit/')) {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      const modId = cleanHash.replace('/modulos/edit/', '');
      switchAppView('viewModuleEdit');
      populateModuloAreaSelect();
      if (window.loadModuleForEdit) await window.loadModuleForEdit(modId);
    } else if (cleanHash === '/tipos' || cleanHash === '/tipos-conocimiento') {
      if (!hasPermission('tipos.manage') && !hasPermission('tipos_conocimiento.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewPostTiposIndex');
      if (cleanHash === '/tipos-conocimiento' || window.lastTiposSubTab === 'conocimiento') {
        switchTiposSubTab('conocimiento');
      } else {
        switchTiposSubTab('publicacion');
      }
    } else if (cleanHash === '/tipos/create') {
      if (!hasPermission('tipos.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewPostTiposCreate');
      const f = document.getElementById('createPostTipoForm');
      if (f) f.reset();
      if (window.prepareCreatePostTipoForm) await window.prepareCreatePostTipoForm();
    } else if (cleanHash.startsWith('/tipos/show/')) {
      const tipoId = cleanHash.replace('/tipos/show/', '');
      if (window.loadPostTipoForShow) await window.loadPostTipoForShow(tipoId);
    } else if (cleanHash.startsWith('/tipos/edit/')) {
      if (!hasPermission('tipos.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      const tipoId = cleanHash.replace('/tipos/edit/', '');
      switchAppView('viewPostTiposEdit');
      if (window.loadPostTipoForEdit) await window.loadPostTipoForEdit(tipoId);
    } else if (cleanHash === '/tipos-conocimiento/create') {
      if (!hasPermission('tipos_conocimiento.manage') && !hasPermission('tipos.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewTipoConocimientoCreate');
      const f = document.getElementById('createTipoConocimientoForm');
      if (f) f.reset();
    } else if (cleanHash.startsWith('/tipos-conocimiento/show/')) {
      const tipoId = cleanHash.replace('/tipos-conocimiento/show/', '');
      if (window.loadTipoConocimientoForShow) await window.loadTipoConocimientoForShow(tipoId);
    } else if (cleanHash.startsWith('/tipos-conocimiento/edit/')) {
      if (!hasPermission('tipos_conocimiento.manage') && !hasPermission('tipos.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      const tipoId = cleanHash.replace('/tipos-conocimiento/edit/', '');
      switchAppView('viewTipoConocimientoEdit');
      if (window.loadTipoConocimientoForEdit) await window.loadTipoConocimientoForEdit(tipoId);
    } else if (cleanHash === '/posts/create') {
      if (!hasPermission('posts.create')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewCreatePost');
      populateAreaSelects();
      if (!state.allModulosCache || state.allModulosCache.length === 0) {
        await loadModulos();
      }
      const catSelect = document.getElementById('selectCategoriaPadre');
      updatePostSubmoduloSelect(catSelect ? catSelect.value : '');
    } else if (cleanHash.startsWith('/posts/edit/')) {
      if (!hasPermission('posts.edit') && !hasPermission('posts.create')) {
        navigateTo('/dashboard');
        return;
      }
      const rawId = cleanHash.replace('/posts/edit/', '').split('#')[0].split('/')[0];
      const postId = parseInt(rawId, 10);
      if (!isNaN(postId) && postId > 0) {
        switchAppView('viewEditPost');
        await openEditView(postId);
      } else {
        navigateTo('/dashboard');
      }
    } else if (cleanHash.startsWith('/post/')) {
      const rawId = cleanHash.replace('/post/', '').split('#')[0].split('/')[0];
      const postId = parseInt(rawId, 10);
      if (!isNaN(postId) && postId > 0) {
        switchAppView('viewPostDetail');
        await openDetailView(postId);
      } else {
        navigateTo('/dashboard');
      }
    } else if (cleanHash.startsWith('/area/')) {
      switchAppView('viewDashboard');
      const areaCode = decodeURIComponent(cleanHash.replace('/area/', ''));
      if (areaCode) {
        state.currentCategoriaPadre = areaCode;
        state.currentModuloId = null;
        renderAreaTabs();
        await loadModulos();
        await loadPosts(1);
      }
    } else if (cleanHash.startsWith('/modulo/')) {
      switchAppView('viewDashboard');
      const modId = parseInt(cleanHash.replace('/modulo/', ''));
      if (!isNaN(modId)) {
        state.currentModuloId = modId;
        if (!state.allModulosCache || state.allModulosCache.length === 0) {
          await loadModulos();
        } else {
          updateModulePillActiveState();
        }
        await loadPosts(1);
      }
    } else {
      switchAppView('viewDashboard');
      if (state.currentCategoriaPadre !== null || state.currentModuloId !== null) {
        state.currentCategoriaPadre = null;
        state.currentModuloId = null;
        renderAreaTabs();
        await loadModulos();
        await loadPosts(1);
      }
    }
  } finally {
    state.isHandlingRoute = false;
    finishTopProgressBar();
  }
}
