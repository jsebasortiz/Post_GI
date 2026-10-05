let currentCategoriaPadre = null;
let currentModuloId = null;
let currentSearch = '';
let selectedFiles = [];
let coverIndex = 0;
let searchDebounceTimer = null;
let currentUser = null;
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let totalItems = 0;
let allModulosCache = [];

let jwtToken = localStorage.getItem('jwtToken') || null;

// Helper global para peticiones REST API con JWT Bearer Token
async function apiFetch(url, options = {}) {
  options.headers = options.headers || {};

  const token = jwtToken || localStorage.getItem('jwtToken');
  if (token) {
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', `Bearer ${token}`);
    } else {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, options);

  if ((response.status === 401 || response.status === 403) && !url.includes('/api/usuarios/login')) {
    console.warn('Sesión no autorizada o token expirado. Redirigiendo a Login.');
    handleLogout(true);
  }

  return response;
}

// ==========================================================================
// Spinner and Loading Feedback Helpers
// ==========================================================================
let topProgressTimer = null;
let topProgressWidth = 0;

function startTopProgressBar() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;
  
  if (topProgressTimer) clearInterval(topProgressTimer);
  topProgressWidth = 15;
  bar.style.width = topProgressWidth + '%';
  bar.classList.add('active');
  
  topProgressTimer = setInterval(() => {
    if (topProgressWidth < 85) {
      topProgressWidth += Math.random() * 10 + 3;
      bar.style.width = topProgressWidth + '%';
    }
  }, 180);
}

function finishTopProgressBar() {
  const bar = document.getElementById('topProgressBar');
  if (!bar) return;
  
  if (topProgressTimer) {
    clearInterval(topProgressTimer);
    topProgressTimer = null;
  }
  bar.style.width = '100%';
  setTimeout(() => {
    bar.classList.remove('active');
    setTimeout(() => {
      bar.style.width = '0%';
    }, 350);
  }, 180);
}

let routeSpinnerCount = 0;
function showRouteSpinner(title = 'Cargando...', subtext = 'Por favor espera un momento') {
  routeSpinnerCount++;
  const spinner = document.getElementById('globalRouteSpinner');
  const titleEl = document.getElementById('globalSpinnerTitle');
  const subtextEl = document.getElementById('globalSpinnerSubtext');
  
  if (titleEl) titleEl.textContent = title;
  if (subtextEl) subtextEl.textContent = subtext;
  
  if (spinner) spinner.classList.add('active');
  startTopProgressBar();
}

function hideRouteSpinner(force = false) {
  if (force) {
    routeSpinnerCount = 0;
  } else {
    routeSpinnerCount = Math.max(0, routeSpinnerCount - 1);
  }
  
  if (routeSpinnerCount === 0) {
    const spinner = document.getElementById('globalRouteSpinner');
    if (spinner) spinner.classList.remove('active');
    finishTopProgressBar();
  }
}

/**
 * Pone un botón en estado de carga con spinner
 * @param {HTMLElement|string} btn Elemento del botón o id
 * @param {boolean} isLoading True para activar spinner, false para restaurar
 * @param {string} loadingText Texto a mostrar mientras carga (ej: "Guardando...", "Autenticando...")
 */
function setButtonLoading(btn, isLoading, loadingText = 'Procesando...') {
  if (!btn) return;
  if (typeof btn === 'string') btn = document.getElementById(btn);
  if (!btn) return;

  if (isLoading) {
    if (btn.classList.contains('btn-loading')) return;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = `<span class="btn-text-content">${btn.innerHTML}</span><span class="btn-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> ${loadingText}</span>`;
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    if (btn.dataset.originalHtml !== undefined) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

// Helper: Skeleton Loading State for Forms
function setFormSkeletonState(formIdOrElement, isLoading) {
  const container = typeof formIdOrElement === 'string' ? document.getElementById(formIdOrElement) : formIdOrElement;
  if (!container) return;

  const inputs = container.querySelectorAll('.form-control, input:not([type="hidden"]), select, textarea');
  const buttons = container.querySelectorAll('button[type="submit"], .btn-primary, .btn-secondary, .btn-danger');

  inputs.forEach(input => {
    if (isLoading) {
      input.classList.add('skeleton-input');
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        input.dataset.oldVal = input.value || '';
        input.value = 'Cargando...';
      }
    } else {
      input.classList.remove('skeleton-input');
      if (input.dataset.oldVal !== undefined) {
        delete input.dataset.oldVal;
      }
    }
  });

  buttons.forEach(btn => {
    btn.disabled = isLoading;
    if (isLoading) {
      btn.classList.add('skeleton-input');
    } else {
      btn.classList.remove('skeleton-input');
    }
  });
}

// Helper: Toggle Read-Only Mode for Forms (Ver / Detalles)
function setFormReadOnlyMode(formIdOrElement, isReadOnly, titleText, titleIcon) {
  const container = typeof formIdOrElement === 'string' ? document.getElementById(formIdOrElement) : formIdOrElement;
  if (!container) return;

  container.dataset.readOnly = isReadOnly ? 'true' : 'false';

  const inputs = container.querySelectorAll('.form-control, input, select, textarea');
  inputs.forEach(input => {
    if (isReadOnly) {
      input.setAttribute('disabled', 'disabled');
      input.style.pointerEvents = 'none';
      input.style.opacity = '0.85';
    } else {
      input.removeAttribute('disabled');
      input.style.pointerEvents = '';
      input.style.opacity = '';
    }
  });

  const checkables = container.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  checkables.forEach(chk => {
    chk.disabled = isReadOnly;
  });

  const submitBtns = container.querySelectorAll('button[type="submit"], .btn-primary:not([onclick*="navigateTo"])');
  submitBtns.forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : '';
  });

  const dangerBtns = container.querySelectorAll('.btn-danger, button[onclick*="Inactivar"], button[onclick*="Delete"], button[onclick*="inactivar"], button[onclick*="delete"]');
  dangerBtns.forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : '';
  });

  const parentView = container.closest('.app-view') || container.parentElement;
  if (parentView) {
    const titleEl = parentView.querySelector('h2, h3, .card-title, .view-title');
    if (titleEl) {
      if (!titleEl.dataset.originalTitle) {
        titleEl.dataset.originalTitle = titleEl.innerHTML;
      }
      if (isReadOnly && titleText) {
        const iconClass = titleIcon || 'fa-eye';
        titleEl.innerHTML = `<i class="fa-solid ${iconClass}" style="color:var(--accent-cyan);"></i> ${escapeHtml(titleText)}`;
      } else {
        titleEl.innerHTML = titleEl.dataset.originalTitle;
      }
    }
  }
}

// Helper: Skeleton HTML generator for Table Rows
function getTableSkeletonHtml(rowsCount = 5, colsCount = 4) {
  return `
    <div class="table-responsive">
      <table class="rbac-table" style="width:100%; border-collapse:collapse;">
        <tbody>
          ${Array.from({ length: rowsCount }).map(() => `
            <tr>
              ${Array.from({ length: colsCount }).map(() => `
                <td style="padding:0.75rem;">
                  <div class="skeleton-box" style="height:18px; width:85%; border-radius:4px;"></div>
                </td>
              `).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}


let currentTheme = localStorage.getItem('prixmaTheme') || 'light';

function initTheme() {
  setTheme(currentTheme);
}

function toggleTheme() {
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function setTheme(theme) {
  currentTheme = theme;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('prixmaTheme', theme);

  const themeIcon = document.getElementById('themeIcon');
  const themeBtn = document.getElementById('btnToggleTheme');
  const themeText = document.getElementById('themeText');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
  if (themeBtn) {
    themeBtn.setAttribute('title', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  }
  if (themeText) {
    themeText.textContent = theme === 'dark' ? 'Claro' : 'Oscuro';
  }
}

// SweetAlert2 Prixma Custom Light/Dark Helper
function getPrixmaSwal() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  if (typeof Swal !== 'undefined') {
    return Swal.mixin({
      background: isDark ? '#1e293b' : '#ffffff',
      color: isDark ? '#f8fafc' : '#0f172a',
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#e11d48',
      customClass: {
        popup: 'prixma-swal-popup',
        title: 'prixma-swal-title',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
      },
      buttonsStyling: false
    });
  }
  return {
    fire: (opts) => alert(opts.text || opts.title)
  };
}

// Areas Management State & Helpers (Conectados a MySQL API)
let allAreasCache = [];

const DEFAULT_AREAS = [
  { id: 1, code: 'apps', name: 'Apps (Aplicaciones)', icon: 'fa-solid fa-rocket', desc: 'Aplicaciones corporativas' },
  { id: 2, code: 'infraestructura', name: 'Infraestructura', icon: 'fa-solid fa-server', desc: 'Servidores y redes' }
];

async function loadAreas() {
  try {
    const res = await apiFetch('/api/areas?soloActivas=true');
    if (res.ok) {
      allAreasCache = await res.json();
    } else {
      allAreasCache = DEFAULT_AREAS;
    }
  } catch (e) {
    console.error('Error cargando áreas desde MySQL API:', e);
    allAreasCache = DEFAULT_AREAS;
  }
  renderAreaTabs();
  populateAreaSelects();
}

function getAllAreas() {
  if (allAreasCache && allAreasCache.length > 0) {
    return allAreasCache.map(a => ({
      id: a.id,
      code: a.codigo,
      name: a.nombre,
      icon: getAreaIcon(a.codigo, a.nombre),
      desc: a.descripcion
    }));
  }
  return DEFAULT_AREAS.map(a => ({ id: a.id, code: a.code, name: a.name, icon: a.icon, desc: a.desc }));
}

function getAreaIcon(codigo, nombre) {
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

function renderAreaTabs() {
  const container = document.getElementById('mainCategoriesTabs');
  if (!container) return;

  const areas = getAllAreas();
  const canManage = hasPermission('modulos.create');

  let html = `
    <button class="category-tab ${currentCategoriaPadre === null ? 'active' : ''}" onclick="switchMainCategory(null, this)">
      <i class="fa-solid fa-layer-group"></i> Todas las Áreas
    </button>
  `;

  areas.forEach(area => {
    const isActive = currentCategoriaPadre && currentCategoriaPadre.toLowerCase() === area.code.toLowerCase();
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

function populateAreaSelects() {
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

// --- SPA ROUTER (Clean HTML5 URLs without '#') ---
function navigateTo(path) {
  if (!path) path = '/dashboard';
  if (path.startsWith('#')) path = path.substring(1);
  if (!path.startsWith('/')) path = '/' + path;

  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  handleRoute();
}

function switchAppView(viewId) {
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

let isHandlingRoute = false;
let isAppInitialized = false;

async function handleRoute() {
  if (isHandlingRoute) return;
  isHandlingRoute = true;
  startTopProgressBar();

  try {
    let rawPath = window.location.pathname;
    if (window.location.hash) {
      const hashPath = window.location.hash.replace(/^#/, '');
      if (hashPath) rawPath = hashPath.startsWith('/') ? hashPath : '/' + hashPath;
    }
    if (!rawPath || rawPath === '/' || rawPath === '/index.html') {
      rawPath = '/dashboard';
    }
    const cleanHash = rawPath.split('?')[0];

    // 1. Ruta de Login
    if (cleanHash === '/login') {
      if (currentUser && (jwtToken || localStorage.getItem('jwtToken'))) {
        navigateTo('/dashboard');
        return;
      }
      showAuthGate();
      return;
    }

    // 2. Control de Acceso: si no hay sesión activa ni token, redirigir a /login
    const activeToken = jwtToken || localStorage.getItem('jwtToken');
    if (!currentUser || !activeToken) {
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
      await loadRoleForShow(roleId);
    } else if (cleanHash.startsWith('/roles/edit/')) {
      if (!hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      const roleId = cleanHash.replace('/roles/edit/', '');
      switchAppView('viewRoleEdit');
      await loadRoleForEdit(roleId);
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
      await loadAreaForShow(areaId);
    } else if (cleanHash.startsWith('/areas/edit/')) {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      const areaId = cleanHash.replace('/areas/edit/', '');
      switchAppView('viewAreaEdit');
      loadAreaForEdit(areaId);
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
      await loadModuleForShow(modId);
    } else if (cleanHash.startsWith('/modulos/edit/')) {
      if (!hasPermission('modulos.create')) {
        navigateTo('/dashboard');
        return;
      }
      const modId = cleanHash.replace('/modulos/edit/', '');
      switchAppView('viewModuleEdit');
      populateModuloAreaSelect();
      await loadModuleForEdit(modId);
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
      await prepareCreatePostTipoForm();
    } else if (cleanHash.startsWith('/tipos/show/')) {
      const tipoId = cleanHash.replace('/tipos/show/', '');
      await loadPostTipoForShow(tipoId);
    } else if (cleanHash.startsWith('/tipos/edit/')) {
      if (!hasPermission('tipos.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      const tipoId = cleanHash.replace('/tipos/edit/', '');
      switchAppView('viewPostTiposEdit');
      await loadPostTipoForEdit(tipoId);
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
      await loadTipoConocimientoForShow(tipoId);
    } else if (cleanHash.startsWith('/tipos-conocimiento/edit/')) {
      if (!hasPermission('tipos_conocimiento.manage') && !hasPermission('tipos.manage') && !hasPermission('modulos.create') && !hasPermission('roles.manage')) {
        navigateTo('/dashboard');
        return;
      }
      const tipoId = cleanHash.replace('/tipos-conocimiento/edit/', '');
      switchAppView('viewTipoConocimientoEdit');
      await loadTipoConocimientoForEdit(tipoId);
    } else if (cleanHash === '/posts/create') {
      if (!hasPermission('posts.create')) {
        navigateTo('/dashboard');
        return;
      }
      switchAppView('viewCreatePost');
      populateAreaSelects();
      if (!allModulosCache || allModulosCache.length === 0) {
        await loadModulos();
      }
      const catSelect = document.getElementById('selectCategoriaPadre');
      updatePostSubmoduloSelect(catSelect ? catSelect.value : '');
    } else if (cleanHash.startsWith('/posts/edit/')) {
      if (!hasPermission('posts.edit') && !hasPermission('posts.create')) {
        navigateTo('/dashboard');
        return;
      }
      const postId = cleanHash.replace('/posts/edit/', '');
      if (postId) {
        switchAppView('viewEditPost');
        await openEditView(postId);
      } else {
        navigateTo('/dashboard');
      }
    } else if (cleanHash.startsWith('/post/')) {
      const postId = cleanHash.replace('/post/', '');
      if (postId) {
        switchAppView('viewPostDetail');
        await openDetailView(postId);
      } else {
        navigateTo('/dashboard');
      }
    } else if (cleanHash.startsWith('/area/')) {
      switchAppView('viewDashboard');
      const areaCode = decodeURIComponent(cleanHash.replace('/area/', ''));
      if (areaCode) {
        currentCategoriaPadre = areaCode;
        currentModuloId = null;
        renderAreaTabs();
        await loadModulos();
        await loadPosts(1);
      }
    } else if (cleanHash.startsWith('/modulo/')) {
      switchAppView('viewDashboard');
      const modId = parseInt(cleanHash.replace('/modulo/', ''));
      if (!isNaN(modId)) {
        currentModuloId = modId;
        if (!allModulosCache || allModulosCache.length === 0) {
          await loadModulos();
        } else {
          updateModulePillActiveState();
        }
        await loadPosts(1);
      }
    } else {
      // /dashboard o ruta por defecto
      switchAppView('viewDashboard');
      if (currentCategoriaPadre !== null || currentModuloId !== null) {
        currentCategoriaPadre = null;
        currentModuloId = null;
        renderAreaTabs();
        await loadModulos();
        await loadPosts(1);
      }
    }
  } finally {
    isHandlingRoute = false;
    finishTopProgressBar();
  }
}

window.addEventListener('popstate', handleRoute);
window.addEventListener('hashchange', handleRoute);

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initUserSession();
});

// Inicializar la sesión del usuario guardada en localStorage
function initUserSession() {
  const savedUser = localStorage.getItem('currentUser');
  const savedToken = localStorage.getItem('jwtToken');

  if (savedUser && savedToken) {
    try {
      currentUser = JSON.parse(savedUser);
      jwtToken = savedToken;
    } catch (e) {
      currentUser = null;
      jwtToken = null;
      localStorage.removeItem('currentUser');
      localStorage.removeItem('jwtToken');
    }
  } else {
    currentUser = null;
    jwtToken = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('jwtToken');
  }

  handleRoute();
}

async function showMainApp() {
  const authGate = document.getElementById('authGateScreen');
  const mainApp = document.getElementById('appMainArea');
  if (authGate) authGate.classList.add('view-hidden');
  if (mainApp) mainApp.classList.remove('view-hidden');

  renderUserNavArea();

  if (!isAppInitialized) {
    isAppInitialized = true;
    await loadAreas();
    await loadModulos();
    await loadPostTipos();
    await loadTiposConocimiento();
    await loadPosts();
  }
}

function showAuthGate() {
  isAppInitialized = false;
  const authGate = document.getElementById('authGateScreen');
  const mainApp = document.getElementById('appMainArea');
  if (mainApp) mainApp.classList.add('view-hidden');
  if (authGate) authGate.classList.remove('view-hidden');

  renderUserNavArea();
}

function hasPermission(codigo) {
  if (!currentUser) return false;
  if (currentUser.rolNombre === 'Administrador' || (currentUser.rolId && currentUser.rolId === 1)) return true;
  if (!currentUser.permisos) return false;
  return currentUser.permisos.includes(codigo);
}

function updateNavButtonsPermissions() {
  const btnPost = document.getElementById('btnOpenCreatePost');
  const btnModule = document.getElementById('btnOpenCreateModule');
  const btnArea = document.getElementById('btnOpenCreateArea');
  const btnTipo = document.getElementById('btnOpenPostTiposModal');
  const btnRbac = document.getElementById('btnOpenRbacModal');

  if (btnPost) btnPost.style.display = hasPermission('posts.create') ? 'inline-flex' : 'none';
  if (btnModule) btnModule.style.display = hasPermission('modulos.create') ? 'inline-flex' : 'none';
  if (btnArea) btnArea.style.display = hasPermission('modulos.create') ? 'inline-flex' : 'none';
  if (btnTipo) btnTipo.style.display = (hasPermission('tipos.manage') || hasPermission('tipos_conocimiento.manage') || hasPermission('modulos.create')) ? 'inline-flex' : 'none';
  if (btnRbac) btnRbac.style.display = hasPermission('roles.manage') ? 'inline-flex' : 'none';
}

function renderUserNavArea() {
  const container = document.getElementById('userNavArea');
  if (!container) return;

  if (currentUser) {
    const rolBadge = currentUser.rolNombre || 'Lector';
    container.innerHTML = `
      <div class="user-nav-profile">
        <div class="avatar-sm" style="width:36px; height:36px; font-size:0.95rem; flex-shrink:0;">${escapeHtml(currentUser.nombre.charAt(0).toUpperCase())}</div>
        <div class="user-info-details">
          <strong class="user-display-name" title="${escapeHtml(currentUser.nombre)}">${escapeHtml(currentUser.nombre)}</strong>
          <span class="user-role-badge"><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(rolBadge)}</span>
        </div>
        <button class="btn btn-logout-btn" onclick="handleLogout()" title="Cerrar Sesión">
          <i class="fa-solid fa-right-from-bracket"></i> <span class="btn-text">Salir</span>
        </button>
      </div>
    `;
    updateNavButtonsPermissions();
  } else {
    container.innerHTML = '';
    updateNavButtonsPermissions();
  }
}

// Autenticación con Directorio Activo via REST API con validaciones WCAG AA & UX Writing
async function handleLogin(event) {
  event.preventDefault();

  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');

  // 1. Limpieza de estado de error previo
  clearLoginErrors();

  const correo = userInput ? userInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  // 2. Validación previa al envío (Campos vacíos)
  let isValid = true;
  if (!correo) {
    markInputInvalid(userInput);
    isValid = false;
  }
  if (!password) {
    markInputInvalid(passInput);
    isValid = false;
  }

  if (!isValid) {
    showLoginError("Por favor completa todos los campos requeridos.");
    if (!correo && userInput) userInput.focus();
    else if (!password && passInput) passInput.focus();
    return;
  }

  // 3. Manejo de estado en progreso (deshabilitar inputs/botón + spinner)
  setLoginLoadingState(true);

  try {
    const res = await fetch('/api/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));

      // UX Writing: Mensajes específicos y seguros según respuesta de la API/estado HTTP
      if (res.status === 423 || (errData.message && errData.message.toLowerCase().includes('bloquead'))) {
        markInputInvalid(userInput);
        markInputInvalid(passInput);
        throw new Error("Cuenta bloqueada temporalmente por intentos fallidos. Contacta al área de TI.");
      } else if (res.status >= 500) {
        throw new Error("No fue posible conectar con el servidor corporativo. Intenta de nuevo más tarde.");
      } else {
        // Status 401 / 400 u otro error de credenciales -> Texto seguro sin enumeración
        markInputInvalid(userInput);
        markInputInvalid(passInput);
        throw new Error("El usuario o la contraseña no coinciden.");
      }
    }

    const loginData = await res.json();
    const token = loginData.token || loginData.Token;
    const user = loginData.usuario || loginData.Usuario || loginData;

    if (token) {
      jwtToken = token;
      localStorage.setItem('jwtToken', token);
    }
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));

    const form = document.getElementById('gateLoginForm');
    if (form) form.reset();

    navigateTo('/dashboard');
  } catch (err) {
    if (err.name === 'TypeError') {
      // Error de red/conexión sin respuesta de servidor
      showLoginError("No fue posible conectar con el servidor corporativo. Intenta de nuevo más tarde.");
    } else {
      showLoginError(err.message || "El usuario o la contraseña no coinciden.");
    }
  } finally {
    setLoginLoadingState(false);
  }
}

// Helpers de validación, accesibilidad (WCAG AA) y manejo de estados UI/UX
function setLoginLoadingState(isLoading) {
  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');
  const btn = document.getElementById('btnLoginSubmit');

  if (isLoading) {
    if (btn) {
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Autenticando...';
    }
    if (userInput) userInput.disabled = true;
    if (passInput) passInput.disabled = true;
  } else {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Autenticar y Entrar';
    }
    if (userInput) userInput.disabled = false;
    if (passInput) passInput.disabled = false;
  }
}

function showLoginError(msg) {
  const errorBanner = document.getElementById('loginErrorMsg');
  const errorText = document.getElementById('loginErrorText');
  if (errorBanner && errorText) {
    errorText.textContent = msg;
    errorBanner.style.display = 'flex';
  }
}

function clearLoginErrors() {
  const errorBanner = document.getElementById('loginErrorMsg');
  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');

  if (errorBanner) errorBanner.style.display = 'none';
  if (userInput) {
    userInput.classList.remove('is-invalid');
    userInput.removeAttribute('aria-invalid');
    userInput.removeAttribute('aria-describedby');
  }
  if (passInput) {
    passInput.classList.remove('is-invalid');
    passInput.removeAttribute('aria-invalid');
    passInput.removeAttribute('aria-describedby');
  }
}

function markInputInvalid(inputEl) {
  if (!inputEl) return;
  inputEl.classList.add('is-invalid');
  inputEl.setAttribute('aria-invalid', 'true');
  inputEl.setAttribute('aria-describedby', 'loginErrorMsg');
}

function clearInputError(inputEl) {
  if (!inputEl) return;
  inputEl.classList.remove('is-invalid');
  inputEl.removeAttribute('aria-invalid');
  inputEl.removeAttribute('aria-describedby');

  const userInput = document.getElementById('loginUser');
  const passInput = document.getElementById('loginPass');
  const errorBanner = document.getElementById('loginErrorMsg');

  // Ocultar banner si ambos campos ya no están en estado is-invalid
  if (errorBanner && (!userInput || !userInput.classList.contains('is-invalid')) && (!passInput || !passInput.classList.contains('is-invalid'))) {
    errorBanner.style.display = 'none';
  }
}


async function handleLogout(force = false) {
  if (force !== true) {
    const swal = getPrixmaSwal();
    const result = await swal.fire({
      title: '¿Cerrar Sesión?',
      text: '¿Estás seguro de que deseas salir de la aplicación?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '<i class="fa-solid fa-right-from-bracket"></i> Sí, cerrar sesión',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;
  }

  currentUser = null;
  jwtToken = null;
  localStorage.removeItem('currentUser');
  localStorage.removeItem('jwtToken');
  isAppInitialized = false;
  navigateTo('/login');
}

function switchMainCategory(categoriaPadre, tabBtnElement) {
  if (categoriaPadre) {
    navigateTo(`/area/${encodeURIComponent(categoriaPadre)}`);
  } else {
    navigateTo('/dashboard');
  }
}

// Carga los módulos para los filtros y selectores
async function loadModulos() {
  try {
    const res = await apiFetch('/api/modulos');
    if (!res.ok) return;
    allModulosCache = await res.json();

    let modulosToRender = allModulosCache;
    if (currentCategoriaPadre) {
      modulosToRender = allModulosCache.filter(m => m.categoriaPadre && m.categoriaPadre.toLowerCase() === currentCategoriaPadre.toLowerCase());
    }

    const canManage = hasPermission('modulos.create');
    const filterContainer = document.getElementById('modulesFilter');
    let filterHtml = `<button class="module-pill ${currentModuloId === null ? 'active' : ''}" data-module-id="null" onclick="filterByModule(null, this)">Todos los Módulos</button>`;
    modulosToRender.forEach(m => {
      filterHtml += `<button class="module-pill ${currentModuloId === m.id ? 'active' : ''}" data-module-id="${m.id}" onclick="filterByModule(${m.id}, this)">${escapeHtml(m.nombre)}</button>`;
    });
    filterContainer.innerHTML = filterHtml;

    const modalCatSelect = document.getElementById('selectCategoriaPadre');
    const selectedCategory = modalCatSelect ? modalCatSelect.value : 'apps';
    updatePostSubmoduloSelect(selectedCategory);
  } catch (err) {
    console.error('Error cargando módulos:', err);
  }
}

function updateModulePillActiveState() {
  const container = document.getElementById('modulesFilter');
  if (!container) return;

  const pills = container.querySelectorAll('.module-pill');
  pills.forEach(pill => {
    const modIdAttr = pill.getAttribute('data-module-id');
    const isAll = (modIdAttr === 'null' || modIdAttr === null || modIdAttr === '');
    if ((isAll && currentModuloId === null) || (!isAll && parseInt(modIdAttr, 10) === currentModuloId)) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

function onPostCategoriaChange(cat) {
  updatePostSubmoduloSelect(cat);
}

function updatePostSubmoduloSelect(cat) {
  const selectModulo = document.getElementById('selectModulo');
  if (!selectModulo) return;

  const targetCat = (cat || '').toLowerCase().trim();
  const filtered = allModulosCache.filter(m => {
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

// Carga los tipos de posts para el selector
async function loadPostTipos() {
  try {
    const res = await apiFetch('/api/modulos/tipos');
    if (!res.ok) return;
    const tipos = await res.json();

    const selectTipo = document.getElementById('selectTipo');
    let selectHtml = '<option value="">Tipo de Publicación</option>';
    tipos.forEach(t => {
      selectHtml += `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`;
    });
    selectTipo.innerHTML = selectHtml;
  } catch (err) {
    console.error('Error cargando tipos de posts:', err);
  }
}

// Carga los tipos de conocimiento para los selectores
async function loadTiposConocimiento() {
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

// Cargar posts con filtros opcionales y paginación
async function loadPosts(page = 1) {
  currentPage = page;
  const grid = document.getElementById('postsGrid');
  const pagination = document.getElementById('paginationContainer');

  grid.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-box" style="height:135px; width:100%;"></div>
      <div style="padding:1rem;">
        <div class="skeleton-box" style="height:14px; width:35%; margin-bottom:0.75rem; border-radius:10px;"></div>
        <div class="skeleton-box" style="height:20px; width:85%; margin-bottom:0.75rem; border-radius:6px;"></div>
        <div class="skeleton-box" style="height:14px; width:95%; margin-bottom:0.4rem; border-radius:4px;"></div>
        <div class="skeleton-box" style="height:14px; width:65%; margin-bottom:1.25rem; border-radius:4px;"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--bg-card-border); padding-top:0.75rem;">
          <div class="skeleton-box" style="height:14px; width:40%; border-radius:4px;"></div>
          <div class="skeleton-box" style="height:14px; width:25%; border-radius:4px;"></div>
        </div>
      </div>
    </div>
  `).join('');

  try {
    let url = `/api/posts?estado=publicado&page=${currentPage}&pageSize=${pageSize}`;
    if (currentCategoriaPadre) url += `&categoriaPadre=${encodeURIComponent(currentCategoriaPadre)}`;
    if (currentModuloId) url += `&moduloId=${currentModuloId}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    const res = await apiFetch(url);
    if (!res.ok) throw new Error('No se pudieron obtener las publicaciones.');

    const pagedResult = await res.json();
    const posts = pagedResult.items || [];
    totalItems = pagedResult.totalItems || 0;
    totalPages = pagedResult.totalPages || 1;

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem 1rem;">
          <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 1rem; color: var(--primary);"></i>
          <h3>No se encontraron publicaciones</h3>
          <p style="font-size:0.9rem; margin-top:0.5rem;">Intenta seleccionar otro módulo o crea una nueva publicación.</p>
        </div>
      `;
      if (pagination) pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = posts.map(post => renderPostCard(post)).join('');
    renderPaginationControls();
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--accent-rose); padding: 3rem;">
        <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
        <p style="margin-top: 0.5rem;">${escapeHtml(err.message)}</p>
      </div>
    `;
    if (pagination) pagination.innerHTML = '';
  }
}

function renderPaginationControls() {
  const pagination = document.getElementById('paginationContainer');
  if (!pagination) return;

  if (totalItems === 0 || totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  let pagesHtml = '';

  // Botón Anterior
  pagesHtml += `
    <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})" title="Página Anterior">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Números de Página
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    pagesHtml += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      pagesHtml += `<span class="page-btn page-btn-ellipsis">&hellip;</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    pagesHtml += `
      <button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">
        ${p}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pagesHtml += `<span class="page-btn page-btn-ellipsis">&hellip;</span>`;
    }
    pagesHtml += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  // Botón Siguiente
  pagesHtml += `
    <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})" title="Página Siguiente">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = `
    <div class="pagination-info">
      Mostrando <strong>${startItem} - ${endItem}</strong> de <strong>${totalItems}</strong> publicaciones
    </div>
    <div class="pagination-nav">
      ${pagesHtml}
    </div>
  `;
}

function goToPage(page) {
  if (page < 1 || page > totalPages || page === currentPage) return;
  loadPosts(page);
  const grid = document.getElementById('postsGrid');
  if (grid) {
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function isImageUrl(url) {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  const nonImgExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z', '.tar', '.gz'];
  if (nonImgExtensions.some(ext => cleanUrl.endsWith(ext))) return false;
  return cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.webp') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.svg') || cleanUrl.includes('/uploads/') || cleanUrl.includes('image');
}

function getPostCoverUrl(post) {
  if (post.portadaUrl && isImageUrl(post.portadaUrl)) {
    return post.portadaUrl;
  }
  if (post.adjuntos && post.adjuntos.length > 0) {
    const imgAdj = post.adjuntos.find(a => isImageUrl(a.archivoUrl));
    if (imgAdj) return imgAdj.archivoUrl;
  }
  // Si no hay foto de portada o solo se subieron archivos PDF/documentos, usar la imagen de portada corporativa por defecto
  return 'images/portada.jpg';
}

function renderPostCard(post) {
  const coverUrl = getPostCoverUrl(post);
  const coverHtml = `<img src="${coverUrl}" alt="${escapeHtml(post.titulo)}" loading="lazy" onerror="this.onerror=null; this.src='images/portada.jpg';">`;

  const dateStr = formatDate(post.creadoEn);
  const attachCount = post.adjuntos ? post.adjuntos.length : 0;

  const canEdit = hasPermission('posts.edit');
  const canDelete = hasPermission('posts.delete');

  const actionsHtml = (canEdit || canDelete) ? `
    <div class="post-card-actions">
      ${canEdit ? `<button class="btn-card-action" onclick="event.stopPropagation(); openEditModal(${post.id})" title="Editar Publicación"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
      ${canDelete ? `<button class="btn-card-action btn-card-delete" onclick="event.stopPropagation(); handleDeletePost(${post.id})" title="Eliminar Publicación"><i class="fa-solid fa-trash-can"></i></button>` : ''}
    </div>
  ` : '';

  let tagsHtml = '';
  if (post.palabrasClave) {
    const tags = post.palabrasClave.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      tagsHtml = `<div class="post-tags" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.6rem;">` +
        tags.map(tag => `<span style="font-size:0.73rem; background:rgba(37,99,235,0.12); color:var(--primary); padding:2px 8px; border-radius:12px; font-weight:600;"><i class="fa-solid fa-hashtag" style="font-size:0.65rem; opacity:0.8;"></i>${escapeHtml(tag)}</span>`).join('') +
        `</div>`;
    }
  }

  return `
    <article class="post-card" onclick="openDetailModal(${post.id})">
      ${actionsHtml}
      <div class="post-cover">
        ${coverHtml}
      </div>
      <div class="post-body">
        <h3 class="post-title">${escapeHtml(post.titulo)}</h3>
        <p class="post-summary">${escapeHtml(post.resumen || post.contenido)}</p>
        ${tagsHtml}
        <div class="post-meta">
          <div class="author-info">
            <div class="avatar-sm">${escapeHtml(post.usuarioNombre.charAt(0).toUpperCase())}</div>
            <span>${escapeHtml(post.usuarioNombre)}</span>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center;">
            ${attachCount > 0 ? `<span class="post-attachments-count"><i class="fa-solid fa-paperclip"></i> ${attachCount}</span>` : ''}
            <span style="white-space:nowrap;">${dateStr}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}


function filterByModule(moduloId, btnElement) {
  currentModuloId = moduloId;
  updateModulePillActiveState();
  if (moduloId) {
    navigateTo(`/modulo/${moduloId}`);
  } else if (currentCategoriaPadre) {
    navigateTo(`/area/${encodeURIComponent(currentCategoriaPadre)}`);
  } else {
    navigateTo('/dashboard');
  }
}

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentSearch = document.getElementById('searchInput').value.trim();
    loadPosts(1);
  }, 350);
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  selectedFiles = [...selectedFiles, ...files];
  autoSelectDefaultImageCover();
  renderFilePreviews();
}

function autoSelectDefaultImageCover() {
  if (selectedFiles.length === 0) {
    coverIndex = -1;
    return;
  }
  if (coverIndex >= 0 && coverIndex < selectedFiles.length) {
    const currentMeta = getFileMeta(selectedFiles[coverIndex].name, selectedFiles[coverIndex].type);
    if (currentMeta.isImage) return;
  }
  coverIndex = selectedFiles.findIndex(f => getFileMeta(f.name, f.type).isImage);
}

function getFileMeta(fileName, mimeType = '') {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return { isImage: true, icon: 'fa-solid fa-file-image', color: '#3b82f6', label: 'Imagen' };
  } else if (mime.includes('pdf') || ext === 'pdf') {
    return { isImage: false, icon: 'fa-solid fa-file-pdf', color: '#ef4444', label: 'PDF' };
  } else if (['doc', 'docx'].includes(ext) || mime.includes('word')) {
    return { isImage: false, icon: 'fa-solid fa-file-word', color: '#2563eb', label: 'Word' };
  } else if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) {
    return { isImage: false, icon: 'fa-solid fa-file-excel', color: '#16a34a', label: 'Excel' };
  } else if (['ppt', 'pptx'].includes(ext) || mime.includes('powerpoint') || mime.includes('presentation')) {
    return { isImage: false, icon: 'fa-solid fa-file-powerpoint', color: '#ea580c', label: 'PowerPoint' };
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    return { isImage: false, icon: 'fa-solid fa-file-zipper', color: '#eab308', label: 'Archivo ZIP' };
  }
  return { isImage: false, icon: 'fa-solid fa-file-lines', color: '#a855f7', label: 'Documento' };
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function renderFilePreviews() {
  const container = document.getElementById('filePreviews');
  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedFiles.map((file, idx) => {
    const meta = getFileMeta(file.name, file.type);
    const sizeStr = formatBytes(file.size);

    let contentHtml = '';
    if (meta.isImage) {
      const previewUrl = URL.createObjectURL(file);
      contentHtml = `<img src="${previewUrl}" alt="${escapeHtml(file.name)}">`;
    } else {
      contentHtml = `
        <div class="file-preview-icon-box">
          <i class="${meta.icon} fa-2x" style="color:${meta.color}; margin-bottom:4px;"></i>
          <span class="file-preview-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-preview-size">${sizeStr}</span>
        </div>
      `;
    }

    const coverRadioHtml = meta.isImage ? `
      <label class="cover-radio">
        <input type="radio" name="portadaRadio" ${coverIndex === idx ? 'checked' : ''} onchange="coverIndex = ${idx}"> Portada
      </label>
    ` : '';

    return `
      <div class="file-preview-card" title="${escapeHtml(file.name)} (${sizeStr})">
        ${contentHtml}
        <button type="button" onclick="removeSelectedFile(${idx})" style="position:absolute; top:4px; right:4px; z-index:5; background:rgba(239,68,68,0.85); color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">&times;</button>
        ${coverRadioHtml}
      </div>
    `;
  }).join('');
}

function removeSelectedFile(index) {
  selectedFiles.splice(index, 1);
  autoSelectDefaultImageCover();
  renderFilePreviews();
}


// Enviar creación de publicación
async function handleCreatePost(event) {
  event.preventDefault();

  if (!currentUser) {
    getPrixmaSwal().fire({
      icon: 'info',
      title: 'Autenticación Requerida',
      text: 'Por favor inicia sesión con tu usuario de Directorio Activo antes de publicar.'
    });
    showAuthGate();
    return;
  }

  const btn = document.getElementById('btnSubmitPost');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    const formData = new FormData();
    formData.append('UsuarioId', currentUser.id);
    formData.append('ModuloId', document.getElementById('selectModulo').value);
    formData.append('TipoId', document.getElementById('selectTipo').value);
    const tcIdVal = document.getElementById('selectTipoConocimiento').value;
    if (tcIdVal) formData.append('TipoConocimientoId', tcIdVal);
    formData.append('PalabrasClave', document.getElementById('postPalabrasClave').value.trim());
    formData.append('Titulo', document.getElementById('postTitulo').value);
    formData.append('Resumen', document.getElementById('postResumen').value);
    formData.append('Contenido', document.getElementById('postContenido').value);
    formData.append('Estado', 'publicado');
    formData.append('PortadaIndex', coverIndex);

    selectedFiles.forEach(file => {
      formData.append('Archivos', file);
    });

    const res = await apiFetch('/api/posts', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error al guardar la publicación.');
    }

    closeModal('createModal');
    const form = document.getElementById('createPostForm');
    if (form) form.reset();
    selectedFiles = [];
    renderFilePreviews();

    navigateTo('/dashboard');
    await loadPosts(1);

    getPrixmaSwal().fire({
      icon: 'success',
      title: '¡Publicación Creada!',
      text: 'Tu artículo ha sido publicado correctamente.',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Publicación',
      text: err.message
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar Ahora';
  }
}

async function handleCreateModule(event) {
  event.preventDefault();
  const categoriaPadre = document.getElementById('moduloCategoriaPadre').value;
  const nombre = document.getElementById('moduloNombre').value;
  const descripcion = document.getElementById('moduloDesc').value;

  try {
    const res = await apiFetch('/api/modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, categoriaPadre, descripcion })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al crear el módulo.');
    }

    closeModal('moduleModal');
    document.getElementById('createModuleForm').reset();
    await loadModulos();

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

function openEditModuleModal(id) {
  setFormSkeletonState('editModuleModal', true);
  openModal('editModuleModal');
  populateAreaSelects();
  const modulo = (allModulosCache || []).find(m => m.id === id || m.id === parseInt(id, 10));
  if (modulo) {
    document.getElementById('editModuloId').value = modulo.id;
    document.getElementById('editModuloNombre').value = modulo.nombre || '';
    document.getElementById('editModuloDesc').value = modulo.descripcion || '';

    const catSelect = document.getElementById('editModuloCategoriaPadre');
    if (catSelect) {
      const catCode = modulo.categoriaPadre || (modulo.area ? modulo.area.codigo : 'apps');
      catSelect.value = catCode;
    }
  }
  setTimeout(() => setFormSkeletonState('editModuleModal', false), 250);
}

async function handleUpdateModule(event) {
  event.preventDefault();
  const id = document.getElementById('editModuloId').value;
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

    closeModal('editModuleModal');
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

async function handleInactivarModulo(id) {
  const modulo = (allModulosCache || []).find(m => m.id === id || m.id === parseInt(id));
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

    if (currentModuloId === id) filterByModule(null, null);
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

async function openDetailView(postId) {
  const titleEl = document.getElementById('detailTitle');
  const badgesEl = document.getElementById('detailBadges');
  const metaEl = document.getElementById('detailMeta');
  const contentEl = document.getElementById('detailContent');

  if (badgesEl) badgesEl.innerHTML = `<div class="skeleton-box" style="height:22px; width:180px; border-radius:12px;"></div>`;
  if (titleEl) titleEl.innerHTML = `<div class="skeleton-box" style="height:30px; width:70%; border-radius:6px; margin:0.4rem 0;"></div>`;
  if (metaEl) metaEl.innerHTML = `<div class="skeleton-box" style="height:16px; width:220px; border-radius:4px;"></div>`;
  if (contentEl) contentEl.innerHTML = `<div class="skeleton-box" style="height:18px; width:95%; margin-bottom:0.5rem; border-radius:4px;"></div><div class="skeleton-box" style="height:18px; width:80%; margin-bottom:0.5rem; border-radius:4px;"></div><div class="skeleton-box" style="height:18px; width:60%; border-radius:4px;"></div>`;

  try {
    const res = await apiFetch(`/api/posts/${postId}`);
    if (!res.ok) {
      navigateTo('/dashboard');
      return;
    }
    const post = await res.json();

    const catBadge = post.moduloCategoriaPadre === 'infraestructura'
      ? `<span class="badge badge-cat-infra" style="position:static;"><i class="fa-solid fa-server"></i> Infraestructura</span>`
      : `<span class="badge badge-cat-apps" style="position:static;"><i class="fa-solid fa-rocket"></i> Apps</span>`;

    const tcBadge = post.tipoConocimientoNombre
      ? `<span class="badge" style="position:static; margin-left:0.5rem; background:var(--accent-purple); color:#fff;"><i class="fa-solid fa-brain"></i> ${escapeHtml(post.tipoConocimientoNombre)}</span>`
      : '';

    document.getElementById('detailBadges').innerHTML = `
      ${catBadge}
      <span class="badge badge-module" style="position:static; margin-left:0.5rem;">${escapeHtml(post.moduloNombre)}</span>
      <span class="badge badge-type" style="position:static; margin-left:0.5rem;">${escapeHtml(post.tipoNombre)}</span>
      ${tcBadge}
    `;
    document.getElementById('detailTitle').innerText = post.titulo;

    const headerActions = document.getElementById('detailHeaderActions');
    if (headerActions) {
      let actHtml = '';
      if (hasPermission('posts.edit')) {
        actHtml += `<button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="navigateTo('/posts/edit/${post.id}')"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`;
      }
      if (hasPermission('posts.delete')) {
        actHtml += `<button class="btn btn-danger" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="handleDeletePost(${post.id})"><i class="fa-solid fa-trash-can"></i> Eliminar</button>`;
      }
      headerActions.innerHTML = actHtml;
    }

    const dateStr = formatDate(post.creadoEn);
    document.getElementById('detailMeta').innerHTML = `
      <span><i class="fa-regular fa-user"></i> ${escapeHtml(post.usuarioNombre)}</span>
      <span style="white-space:nowrap;"><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
    `;

    const coverContainer = document.getElementById('detailCoverContainer');
    if (coverContainer) {
      coverContainer.innerHTML = '';
    }

    let detailTagsHtml = '';
    if (post.palabrasClave) {
      const tags = post.palabrasClave.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        detailTagsHtml = `<div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:1.5rem;">` +
          tags.map(tag => `<span style="font-size:0.8rem; background:rgba(37,99,235,0.12); color:var(--primary); padding:3px 10px; border-radius:14px; font-weight:600;"><i class="fa-solid fa-hashtag" style="font-size:0.7rem;"></i>${escapeHtml(tag)}</span>`).join('') +
          `</div>`;
      }
    }

    document.getElementById('detailContent').innerText = post.contenido;
    if (detailTagsHtml) {
      document.getElementById('detailContent').insertAdjacentHTML('afterend', detailTagsHtml);
    }

    const attachContainer = document.getElementById('detailAttachments');
    if (post.adjuntos && post.adjuntos.length > 0) {
      let galleryHtml = `<h4 style="color:var(--text-main); font-size:1.1rem; margin-bottom:0.75rem;"><i class="fa-solid fa-paperclip"></i> Archivos y Documentos Adjuntos (${post.adjuntos.length})</h4><div class="attachments-grid">`;
      post.adjuntos.forEach(att => {
        const meta = getFileMeta(att.archivoNombreOriginal, att.mimeType);
        const sizeStr = formatBytes(att.tamanioBytes);

        const filePreviewContent = meta.isImage
          ? `<a href="${att.archivoUrl}" target="_blank" title="Ver imagen en tamaño completo"><img src="${att.archivoUrl}" alt="${escapeHtml(att.archivoNombreOriginal)}"></a>`
          : `<div style="height:110px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.25rem; background:rgba(15,23,42,0.6); padding:0.5rem;">
               <i class="${meta.icon} fa-3x" style="color:${meta.color};"></i>
               <span style="font-size:0.72rem; color:var(--accent-cyan); font-weight:600; text-align:center; max-width:90%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(meta.label)}</span>
             </div>`;

        galleryHtml += `
          <div class="attachment-item" style="position:relative; background:var(--bg-dark); border:1px solid var(--bg-card-border); border-radius:8px; overflow:hidden;">
            ${filePreviewContent}
            <div class="attachment-info" style="padding:0.6rem;">
              <a href="${att.archivoUrl}" target="_blank" style="color:var(--accent-cyan); text-decoration:none; font-weight:600; font-size:0.85rem; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(att.archivoNombreOriginal)}">
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75rem;"></i> ${escapeHtml(att.archivoNombreOriginal)}
              </a>
              <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${sizeStr} ${(meta.isImage && att.esPortada) ? '• 🌟 Portada' : ''}</div>
            </div>
          </div>
        `;
      });
      galleryHtml += '</div>';
      attachContainer.innerHTML = galleryHtml;
    } else {
      attachContainer.innerHTML = '';
    }
  } catch (err) {
    console.error('Error al abrir detalle:', err);
    navigateTo('/dashboard');
  }
}

async function openDetailModal(postId) {
  navigateTo('/post/' + postId);
}

async function handleDeleteAttachment(adjuntoId, postId, isFromEdit = false) {
  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar archivo adjunto?',
    text: 'El archivo adjunto será removido de esta publicación.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  try {
    const res = await apiFetch(`/api/posts/adjuntos/${adjuntoId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'No fue posible eliminar el archivo adjunto.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Adjunto Eliminado',
      text: 'El archivo adjunto ha sido eliminado correctamente.',
      timer: 1800,
      showConfirmButton: false
    });

    if (postId) {
      if (isFromEdit) {
        openEditView(postId);
      } else {
        openDetailView(postId);
      }
    }
    loadPosts(currentPage);
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Inactivación',
      text: err.message
    });
  }
}

function openCreateModal() { navigateTo('/posts/create'); }
function openModuleModal() { navigateTo('/modulos'); }
function openAreaModal() { navigateTo('/areas'); }
function openPostTiposModal() { navigateTo('/tipos'); }
function openRbacModal() { navigateTo('/rbac'); }
function openModal(id) { navigateTo('/dashboard'); }
function closeModal(id) { navigateTo('/dashboard'); }

function populateModuloAreaSelect() {
  const select = document.getElementById('moduloCategoriaPadre');
  if (!select) return;
  const areas = getAllAreas();
  select.innerHTML = areas.map(a => `<option value="${escapeHtml(a.code)}">${escapeHtml(a.name)}</option>`).join('');
}

function toggleNewAreaForm() {
  const form = document.getElementById('newAreaForm');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function toggleNewModuleForm() {
  const form = document.getElementById('newModuleForm');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

let areasCurrentPage = 1;
const areasPageSize = 5;

async function loadAreasList() {
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
            <th style="padding:0.75rem;">Área Corporativa</th>
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

function changeAreasPage(delta) {
  areasCurrentPage += delta;
  loadAreasList();
}

let modulesCurrentPage = 1;
const modulesPageSize = 5;

async function loadModulesList() {
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

function changeModulesPage(delta) {
  modulesCurrentPage += delta;
  loadModulesList();
}

async function handleEditAreaInline(id, currentName, currentDesc) {
  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Área Corporativa',
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

async function handleEditModuloInline(id, currentName, currentCat, currentDesc) {
  const areas = getAllAreas();
  const areaOptionsHtml = areas.map(a => `<option value="${escapeHtml(a.code)}" ${a.code === currentCat ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');

  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Módulo Temático',
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

async function handleCreateArea(event) {
  event.preventDefault();
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
    navigateTo('/areas');

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

function openEditAreaModal(id) {
  const areas = getAllAreas();
  const area = areas.find(a => a.id === id || a.id === parseInt(id));
  if (!area) return;

  document.getElementById('editAreaId').value = area.id;
  document.getElementById('editAreaNombre').value = area.name || '';
  document.getElementById('editAreaDesc').value = area.desc || '';
  openModal('editAreaModal');
}

async function handleUpdateArea(event) {
  event.preventDefault();
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

    closeModal('editAreaModal');
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

async function handleInactivarArea(id) {
  const areas = getAllAreas();
  const area = areas.find(a => a.id === id || a.id === parseInt(id));
  const nombre = area ? area.name : 'esta área';

  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar área corporativa?',
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

    if (currentCategoriaPadre) switchMainCategory(null, null);
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

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  const modalEl = document.getElementById(id);
  if (modalEl) modalEl.classList.remove('active');
  if (id === 'rbacModal' && (window.location.hash === '#/rbac' || window.location.pathname === '/rbac')) {
    navigateTo('/dashboard');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// RBAC Management Modal Logic
function openRbacModal() {
  if (!hasPermission('roles.manage')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permiso para acceder a la gestión de roles.'
    });
    return;
  }
  openModal('rbacModal');
  loadRbacUsers();
  loadRbacRolesList();
  loadRbacMatrix();
}

function switchRbacSubTab(tab) {
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

// Estado global para la paginación y búsqueda del módulo de RBAC Usuarios y Roles
let rbacAllUsersCache = [];
let rbacAllRolesCache = [];
let rbacUserSearchTerm = '';
let rbacUsersCurrentPage = 1;
const rbacUsersPageSize = 6;
let rbacRolesCurrentPage = 1;
const rbacRolesPageSize = 5;

async function loadRbacUsers() {
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

function onRbacUserSearchInput() {
  const searchInput = document.getElementById('rbacUserSearchInput');
  rbacUserSearchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
  rbacUsersCurrentPage = 1;
  renderRbacUsersTable();
}

function renderRbacUsersTable() {
  const tbody = document.getElementById('usersRolesTableBody');
  const paginationContainer = document.getElementById('rbacUsersPagination');
  if (!tbody) return;

  // Filtrado por búsqueda (Nombre, Correo o Rol)
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
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No se encontraron usuarios que coincidan con la búsqueda.</td></tr>';
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  // Paginación (Máximo 6 por página)
  const startIndex = (rbacUsersCurrentPage - 1) * rbacUsersPageSize;
  const pageUsers = filtered.slice(startIndex, startIndex + rbacUsersPageSize);

  tbody.innerHTML = pageUsers.map(u => {
    let roleOptions = rbacAllRolesCache.map(r => `<option value="${r.id}" ${r.id === u.rolId ? 'selected' : ''}>${escapeHtml(r.nombre)}</option>`).join('');

    return `
      <tr>
        <td style="font-weight:600; color:var(--text-main);">${escapeHtml(u.nombre)}</td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(u.correo)}</td>
        <td><span class="badge badge-type" style="position:static;">${escapeHtml(u.rolNombre)}</span></td>
        <td style="text-align:right;">
          <div style="display:flex; gap:0.5rem; justify-content:flex-end; align-items:center;">
            <select id="userRoleSelect_${u.id}" class="form-control" style="width:auto; padding:0.35rem 0.6rem; font-size:0.85rem;">
              ${roleOptions}
            </select>
            <button class="btn btn-primary" onclick="handleAssignUserRole(${u.id})" style="padding:0.35rem 0.65rem; font-size:0.8rem; display:inline-flex; align-items:center; gap:0.35rem;" title="Guardar cambios de rol">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Controles de Paginación cuando hay más de 6 usuarios
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

function changeRbacUsersPage(newPage) {
  rbacUsersCurrentPage = newPage;
  renderRbacUsersTable();
}

async function handleAssignUserRole(usuarioId, explicitRolId = null) {
  let rolId = explicitRolId;
  if (!rolId) {
    const select = document.getElementById(`userRoleSelect_${usuarioId}`);
    if (select) rolId = select.value;
  }
  if (!rolId) return;

  try {
    const res = await apiFetch('/api/roles/asignar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuarioId: parseInt(usuarioId), rolId: parseInt(rolId) })
    });

    if (!res.ok) throw new Error('Error al asignar el rol.');

    // Actualizar cache local para refresco instantáneo sin perder la página o filtro actual
    const targetUser = rbacAllUsersCache.find(u => u.id === parseInt(usuarioId));
    const targetRole = rbacAllRolesCache.find(r => r.id === parseInt(rolId));
    if (targetUser && targetRole) {
      targetUser.rolId = targetRole.id;
      targetUser.rolNombre = targetRole.nombre;
    }

    renderRbacUsersTable();

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Rol Asignado',
      text: `El rol de "${targetUser ? targetUser.nombre : 'usuario'}" ha sido actualizado a "${targetRole ? targetRole.nombre : ''}".`,
      timer: 1800,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Asignación',
      text: err.message
    });
  }
}

async function loadRbacMatrix() {
  const container = document.getElementById('rolesMatrixContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando matriz de permisos...</div>';

  try {
    const [resRoles, resPermisos] = await Promise.all([
      apiFetch('/api/roles'),
      apiFetch('/api/roles/permisos')
    ]);

    if (!resRoles.ok || !resPermisos.ok) throw new Error('Error al cargar permisos.');

    const roles = await resRoles.json();
    const permisos = await resPermisos.json();

    container.innerHTML = roles.map(r => {
      const activePermIds = new Set((r.permisos || []).map(p => p.id));
      const isSystemRole = (r.id === 1 || r.nombre === 'Administrador');

      const checkboxesHtml = permisos.map(p => {
        const isChecked = activePermIds.has(p.id);
        return `
          <label class="perm-label">
            <input type="checkbox" class="role-perm-cb-${r.id}" value="${p.id}" ${isChecked ? 'checked' : ''}>
            <span><strong>${escapeHtml(p.nombre)}</strong> <small style="color:var(--text-muted); display:block; font-size:0.75rem;">${escapeHtml(p.codigo)}</small></span>
          </label>
        `;
      }).join('');

      const deleteBtnHtml = isSystemRole ? '' : `
        <button class="btn btn-secondary" onclick="handleDeleteRole(${r.id}, '${escapeHtml(r.nombre)}')" style="padding:0.4rem 0.8rem; font-size:0.8rem; color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" title="Eliminar Rol">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      `;

      return `
        <div class="role-card">
          <div class="role-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong style="font-size:1.1rem; color:var(--text-main);">${escapeHtml(r.nombre)}</strong>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(r.descripcion || '')}</p>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-secondary" onclick="handleSaveRolePermisos(${r.id})" style="padding:0.4rem 0.8rem; font-size:0.8rem;">
                <i class="fa-solid fa-floppy-disk"></i> Guardar Permisos
              </button>
              ${deleteBtnHtml}
            </div>
          </div>
          <div class="perm-checkbox-group">
            ${checkboxesHtml}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--accent-rose); text-align:center;">${escapeHtml(err.message)}</div>`;
  }
}

async function handleSaveRolePermisos(rolId) {
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

function toggleNewRoleForm() {
  const form = document.getElementById('newRoleForm');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function handleCreateRole() {
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
    document.getElementById('newRoleNombre').value = '';
    document.getElementById('newRoleDesc').value = '';
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

async function loadRbacRolesList() {
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

function renderRbacRolesTable() {
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

function changeRbacRolesPage(delta) {
  rbacRolesCurrentPage += delta;
  renderRbacRolesTable();
}

async function handleEditRoleDetails(rolId, currentNombre, currentDesc) {
  const { value: formValues } = await getPrixmaSwal().fire({
    title: 'Editar Rol',
    html: `
      <div style="text-align:left; display:flex; flex-direction:column; gap:0.75rem;">
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Nombre del Rol</label>
          <input id="swal-input-rol-nombre" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentNombre)}">
        </div>
        <div>
          <label style="font-size:0.85rem; color:var(--text-muted); display:block; margin-bottom:4px;">Descripción</label>
          <input id="swal-input-rol-desc" class="swal2-input" style="width:100%; margin:0;" value="${escapeHtml(currentDesc)}">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('swal-input-rol-nombre').value.trim();
      const descripcion = document.getElementById('swal-input-rol-desc').value.trim();
      if (!nombre) {
        getPrixmaSwal().showValidationMessage('El nombre del rol es requerido');
        return false;
      }
      return { nombre, descripcion };
    }
  });

  if (!formValues) return;

  try {
    const res = await apiFetch(`/api/roles/${rolId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al actualizar el rol.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Rol Actualizado',
      text: 'Los datos del rol han sido modificados correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    await loadRbacRolesList();
    await loadRbacMatrix();
    await loadRbacUsers();
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
}

async function handleDeleteRole(rolId, rolNombre) {
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

    await loadRbacRolesList();
    await loadRbacMatrix();
    await loadRbacUsers();
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar Rol',
      text: err.message || 'Error al eliminar el rol.'
    });
    return false;
  }
}

// --- FUNCIONALIDADES DE EDICIÓN Y ELIMINACIÓN DE PUBLICACIONES ---

let selectedEditFiles = [];
let currentEditingPost = null;

async function openEditView(postId) {
  setFormSkeletonState('editPostForm', true);
  if (!hasPermission('posts.edit')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permisos para editar esta publicación.'
    });
    navigateTo('/dashboard');
    return;
  }

  try {
    const res = await apiFetch(`/api/posts/${postId}`);
    if (!res.ok) throw new Error('No se pudo obtener la publicación.');
    const post = await res.json();
    currentEditingPost = post;

    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitulo').value = post.titulo;
    document.getElementById('editPostResumen').value = post.resumen || '';
    document.getElementById('editPostContenido').value = post.contenido;

    if (!allModulosCache || allModulosCache.length === 0) {
      await loadModulos();
    }
    populateAreaSelects();

    const catSelect = document.getElementById('editSelectCategoriaPadre');
    if (catSelect) {
      catSelect.value = post.moduloCategoriaPadre || 'apps';
      updateEditPostSubmoduloSelect(catSelect.value, post.moduloId);
    }

    await loadEditPostTipos(post.tipoId);

    const tcSelect = document.getElementById('editSelectTipoConocimiento');
    if (tcSelect) {
      tcSelect.value = post.tipoConocimientoId || '';
    }
    const tagsInput = document.getElementById('editPostPalabrasClave');
    if (tagsInput) {
      tagsInput.value = post.palabrasClave || '';
    }

    const existingContainer = document.getElementById('editExistingAdjuntos');
    if (existingContainer) {
      if (post.adjuntos && post.adjuntos.length > 0) {
        existingContainer.innerHTML = post.adjuntos.map(att => {
          const meta = getFileMeta(att.archivoNombreOriginal, att.mimeType);
          const sizeStr = formatBytes(att.tamanioBytes);

          let contentHtml = '';
          if (meta.isImage) {
            contentHtml = `<a href="${att.archivoUrl}" target="_blank"><img src="${att.archivoUrl}" style="width:100%; height:100%; object-fit:cover;"></a>`;
          } else {
            contentHtml = `
              <div class="file-preview-icon-box">
                <i class="${meta.icon} fa-2x" style="color:${meta.color}; margin-bottom:4px;"></i>
                <span class="file-preview-name" title="${escapeHtml(att.archivoNombreOriginal)}">${escapeHtml(att.archivoNombreOriginal)}</span>
                <span class="file-preview-size">${sizeStr}</span>
              </div>
            `;
          }

          const coverRadioHtml = meta.isImage ? `
            <label class="cover-radio">
              <input type="radio" name="existingPortadaRadio" ${att.esPortada ? 'checked' : ''} onchange="handleSetPortada(${att.id}, ${post.id})"> Portada
            </label>
          ` : '';

          return `
            <div class="file-preview-card" style="position:relative; width:120px; aspect-ratio:1;" title="${escapeHtml(att.archivoNombreOriginal)} (${sizeStr})">
              <button type="button" onclick="event.stopPropagation(); handleDeleteAttachment(${att.id}, ${post.id}, true)" title="Eliminar Adjunto" style="position:absolute; top:4px; right:4px; z-index:10; background:rgba(239, 68, 68, 0.9); color:white; width:22px; height:22px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold;">&times;</button>
              ${contentHtml}
              ${coverRadioHtml}
            </div>
          `;
        }).join('');
      } else {
        existingContainer.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">Sin archivos adjuntos actualmente.</span>';
      }
    }

    selectedEditFiles = [];
    renderEditFilePreviews();

    const btnDelete = document.getElementById('btnDeletePostInEdit');
    if (btnDelete) btnDelete.style.display = hasPermission('posts.delete') ? 'inline-flex' : 'none';

  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Lectura',
      text: err.message
    });
    navigateTo('/dashboard');
  } finally {
    setTimeout(() => setFormSkeletonState('editPostForm', false), 250);
  }
}

async function handleSetPortada(adjuntoId, postId) {
  try {
    startTopProgressBar();
    const res = await apiFetch(`/api/posts/adjuntos/${adjuntoId}/portada`, {
      method: 'PUT'
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'No se pudo actualizar la portada.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Portada Actualizada',
      text: 'La imagen de portada ha sido asignada correctamente.',
      timer: 1500,
      showConfirmButton: false
    });

    if (postId) {
      await openEditView(postId);
    }
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Portada',
      text: err.message
    });
  } finally {
    finishTopProgressBar();
  }
}


async function openEditModal(postId) {
  navigateTo('/posts/edit/' + postId);
}

function onEditPostCategoriaChange(cat) {
  updateEditPostSubmoduloSelect(cat);
}

function updateEditPostSubmoduloSelect(cat, selectedModuloId = null) {
  const selectModulo = document.getElementById('editSelectModulo');
  if (!selectModulo) return;

  const targetCat = (cat || '').toLowerCase().trim();
  const filtered = allModulosCache.filter(m => {
    if (!targetCat) return true;
    const mCat = (m.categoriaPadre || '').toLowerCase().trim();
    const mAreaCode = (m.area ? m.area.codigo : '').toLowerCase().trim();
    return mCat === targetCat || mAreaCode === targetCat;
  });

  let selectHtml = '<option value="">Selecciona un Módulo</option>';
  filtered.forEach(m => {
    const isSel = selectedModuloId && m.id === selectedModuloId ? 'selected' : '';
    selectHtml += `<option value="${m.id}" ${isSel}>${escapeHtml(m.nombre)}</option>`;
  });
  selectModulo.innerHTML = selectHtml;
}

let postTiposCurrentPage = 1;
const postTiposPageSize = 5;

async function loadPostTiposList() {
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

function changePostTiposPage(delta) {
  postTiposCurrentPage += delta;
  loadPostTiposList();
}

async function handleCreatePostTipo() {
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
    toggleNewPostTipoForm();

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

async function handleEditPostTipo(id, currentNombre, currentDesc) {
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

async function handleDeletePostTipo(id, nombre) {
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

function switchTiposSubTab(tab) {
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

function changeTiposConocimientoPage(delta) {
  tiposConocimientoCurrentPage += delta;
  loadTiposConocimientoList();
}

async function loadTiposConocimientoList() {
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

async function handleCreateTipoConocimientoInline() {
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

async function handleEditTipoConocimientoInline(id, currentNombre, currentDesc) {
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

async function handleDeleteTipoConocimiento(id, nombre) {
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

async function loadEditPostTipos(selectedTipoId = null) {
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

function handleEditFileSelect(event) {
  const files = Array.from(event.target.files);
  selectedEditFiles = selectedEditFiles.concat(files);
  renderEditFilePreviews();
}

function renderEditFilePreviews() {
  const container = document.getElementById('editFilePreviews');
  if (!container) return;

  if (selectedEditFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedEditFiles.map((file, idx) => {
    const meta = getFileMeta(file.name, file.type);
    const sizeStr = formatBytes(file.size);

    let contentHtml = '';
    if (meta.isImage) {
      const previewUrl = URL.createObjectURL(file);
      contentHtml = `<img src="${previewUrl}" alt="${escapeHtml(file.name)}">`;
    } else {
      contentHtml = `
        <div class="file-preview-icon-box">
          <i class="${meta.icon} fa-2x" style="color:${meta.color}; margin-bottom:4px;"></i>
          <span class="file-preview-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          <span class="file-preview-size">${sizeStr}</span>
        </div>
      `;
    }

    return `
      <div class="file-preview-card" title="${escapeHtml(file.name)} (${sizeStr})">
        ${contentHtml}
        <button type="button" onclick="removeEditFile(${idx})" style="position:absolute; top:4px; right:4px; z-index:5; background:rgba(239,68,68,0.85); color:white; border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:bold;">&times;</button>
      </div>
    `;
  }).join('');
}

function removeEditFile(index) {
  selectedEditFiles.splice(index, 1);
  renderEditFilePreviews();
}

async function handleSaveEditPost(event) {
  event.preventDefault();
  const postId = document.getElementById('editPostId').value;
  const btn = document.getElementById('btnSubmitEditPost');

  const updateDto = {
    moduloId: parseInt(document.getElementById('editSelectModulo').value),
    tipoId: parseInt(document.getElementById('editSelectTipo').value),
    tipoConocimientoId: parseInt(document.getElementById('editSelectTipoConocimiento').value) || null,
    palabrasClave: document.getElementById('editPostPalabrasClave').value.trim(),
    titulo: document.getElementById('editPostTitulo').value.trim(),
    resumen: document.getElementById('editPostResumen').value.trim(),
    contenido: document.getElementById('editPostContenido').value.trim(),
    estado: 'publicado'
  };

  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: `¿Deseas guardar los cambios realizados en la publicación "${updateDto.titulo}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-floppy-disk"></i> Sí, guardar',
    cancelButtonText: 'Cancelar'
  });

  if (!confirmResult.isConfirmed) return;

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    const res = await apiFetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateDto)
    });

    if (!res.ok) throw new Error('Error al actualizar la publicación.');

    // Subir nuevos adjuntos si los hay
    if (selectedEditFiles.length > 0) {
      for (const file of selectedEditFiles) {
        const formData = new FormData();
        formData.append('file', file);
        await apiFetch(`/api/posts/${postId}/adjuntos`, {
          method: 'POST',
          body: formData
        });
      }
    }

    closeModal('editModal');
    navigateTo('/dashboard');
    await loadPosts(1);

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Publicación Actualizada',
      text: 'Los cambios han sido guardados correctamente.',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Actualización',
      text: err.message
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
  }
}

async function handleDeletePost(postId) {
  if (!hasPermission('posts.delete')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permisos para eliminar publicaciones.'
    });
    return false;
  }

  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar publicación?',
    text: 'Esta publicación se eliminará y dejará de mostrarse en el portal.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return false;

  try {
    const res = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('No se pudo eliminar la publicación.');

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Publicación Eliminada',
      text: 'La publicación ha sido eliminada correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    loadPosts(currentPage);
    return true;
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar Publicación',
      text: err.message
    });
    return false;
  }
}

async function handleDeletePostFromModal() {
  const postId = document.getElementById('editPostId').value;
  if (postId) {
    const success = await handleDeletePost(postId);
    if (success) {
      navigateTo('/dashboard');
    }
  }
}

// --- MANIPULADORES DEDICADOS PARA VISTAS DE RECURSOS (Áreas, Módulos, Tipos, Roles) ---

// 1. ÁREAS
let editAreaInitialValues = { nombre: '', descripcion: '' };

async function loadAreaForShow(id) {
  switchAppView('viewAreaEdit');
  await loadAreaForEdit(id);
  setFormReadOnlyMode('editAreaForm', true, 'Detalles del Área Corporativa', 'fa-eye');
}

async function loadAreaForEdit(id) {
  setFormReadOnlyMode('editAreaForm', false);
  setFormSkeletonState('editAreaForm', true);
  try {
    const areas = getAllAreas();
    let area = areas.find(a => a.id === parseInt(id, 10));
    if (!area) {
      const res = await apiFetch(`/api/areas/${id}`);
      if (res.ok) area = await res.json();
    }

    if (area) {
      const idEl = document.getElementById('editAreaId');
      const nombreEl = document.getElementById('editAreaNombre');
      const descEl = document.getElementById('editAreaDesc');

      const nameVal = area.name || area.nombre || '';
      const descVal = area.desc || area.descripcion || '';

      if (idEl) idEl.value = area.id;
      if (nombreEl) nombreEl.value = nameVal;
      if (descEl) descEl.value = descVal;

      editAreaInitialValues = {
        nombre: nameVal.trim(),
        descripcion: descVal.trim()
      };
    }
  } catch (e) {
    console.error('Error cargando área para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editAreaForm', false), 250);
  }
}

function hasAreaEditChanged() {
  if (document.getElementById('editAreaForm')?.dataset.readOnly === 'true') return false;
  const currentNombre = (document.getElementById('editAreaNombre')?.value || '').trim();
  const currentDesc = (document.getElementById('editAreaDesc')?.value || '').trim();
  return currentNombre !== editAreaInitialValues.nombre || currentDesc !== editAreaInitialValues.descripcion;
}

async function handleSaveEditArea(event) {
  if (event) event.preventDefault();

  const id = document.getElementById('editAreaId').value;
  const nombre = document.getElementById('editAreaNombre').value.trim();
  const descripcion = document.getElementById('editAreaDesc').value.trim();
  if (!id || !nombre) return;

  const hasChanged = hasAreaEditChanged();

  // Preguntar confirmación antes de guardar los cambios
  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en el área "${nombre}"?`
      : `¿Deseas guardar la información del área "${nombre}"?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
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
      text: 'Los cambios fueron guardados correctamente.',
      timer: 1800,
      showConfirmButton: false
    });
    navigateTo('/areas');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleCancelEditArea(event) {
  if (event) event.preventDefault();

  if (hasAreaEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones en esta área. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });

    if (!confirmResult.isConfirmed) return;
  }

  navigateTo('/areas');
}

async function handleDeleteAreaFromForm() {
  const id = document.getElementById('editAreaId').value;
  if (id) {
    const success = await handleInactivarArea(id);
    if (success) {
      navigateTo('/areas');
    }
  }
}

// 2. MÓDULOS
let editModuleInitialValues = { categoriaPadre: '', nombre: '', descripcion: '' };

async function loadModuleForShow(id) {
  switchAppView('viewModuleEdit');
  populateModuloAreaSelect();
  await loadModuleForEdit(id);
  setFormReadOnlyMode('editModuleForm', true, 'Detalles del Módulo Temático', 'fa-eye');
}

async function loadModuleForEdit(id) {
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

function hasModuleEditChanged() {
  if (document.getElementById('editModuleForm')?.dataset.readOnly === 'true') return false;
  const cat = (document.getElementById('editModuloCategoriaPadre')?.value || '').trim();
  const nombre = (document.getElementById('editModuloNombre')?.value || '').trim();
  const desc = (document.getElementById('editModuloDesc')?.value || '').trim();
  return cat !== editModuleInitialValues.categoriaPadre ||
         nombre !== editModuleInitialValues.nombre ||
         desc !== editModuleInitialValues.descripcion;
}

async function handleCreateModule(event) {
  event.preventDefault();
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
    if (!res.ok) throw new Error('Error al crear el módulo.');
    await loadModulos();
    getPrixmaSwal().fire({ icon: 'success', title: 'Módulo Creado', text: 'El módulo fue registrado correctamente.', timer: 1800, showConfirmButton: false });
    navigateTo('/modulos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleSaveEditModule(event) {
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
    navigateTo('/modulos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleCancelEditModule(event) {
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

  navigateTo('/modulos');
}

async function handleDeleteModuleFromForm() {
  const id = document.getElementById('editModuleId').value;
  if (id) {
    const success = await handleInactivarModulo(id);
    if (success) {
      navigateTo('/modulos');
    }
  }
}

// 3. TIPOS DE PUBLICACIÓN
let editPostTipoInitialValues = { nombre: '', descripcion: '', rolId: '' };

async function populateRolesSelect(selectId, selectedRolId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;
  try {
    const res = await apiFetch('/api/roles');
    if (!res.ok) return;
    const roles = await res.json();
    let html = '<option value="">-- Todos los Roles / Ninguno --</option>';
    roles.forEach(r => {
      const selected = selectedRolId && (r.id === parseInt(selectedRolId, 10) || r.id === selectedRolId) ? 'selected' : '';
      html += `<option value="${r.id}" ${selected}>${escapeHtml(r.nombre)}</option>`;
    });
    select.innerHTML = html;
  } catch (e) {
    console.error('Error poblando roles:', e);
  }
}

async function loadPostTipoForShow(id) {
  switchAppView('viewPostTiposEdit');
  await loadPostTipoForEdit(id);
  setFormReadOnlyMode('editPostTipoForm', true, 'Detalles del Tipo de Publicación', 'fa-eye');
}

async function loadPostTipoForEdit(id) {
  setFormReadOnlyMode('editPostTipoForm', false);
  setFormSkeletonState('editPostTipoForm', true);
  try {
    const res = await apiFetch('/api/modulos/tipos');
    if (res.ok) {
      const tipos = await res.json();
      const t = tipos.find(x => x.id === parseInt(id, 10));
      if (t) {
        const idEl = document.getElementById('editPostTipoId');
        const nombreEl = document.getElementById('editPostTipoNombre');
        const descEl = document.getElementById('editPostTipoDesc');
        const rId = t.rolId || (t.rol ? t.rol.id : '');

        if (idEl) idEl.value = t.id;
        if (nombreEl) nombreEl.value = t.nombre || '';
        if (descEl) descEl.value = t.descripcion || '';
        await populateRolesSelect('editPostTipoRolId', rId);

        editPostTipoInitialValues = {
          nombre: (t.nombre || '').trim(),
          descripcion: (t.descripcion || '').trim(),
          rolId: String(rId || '')
        };
      }
    }
  } catch (e) {
    console.error('Error cargando tipo para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editPostTipoForm', false), 250);
  }
}

function hasPostTipoEditChanged() {
  if (document.getElementById('editPostTipoForm')?.dataset.readOnly === 'true') return false;
  const nombre = (document.getElementById('editPostTipoNombre')?.value || '').trim();
  const desc = (document.getElementById('editPostTipoDesc')?.value || '').trim();
  const rolId = (document.getElementById('editPostTipoRolId')?.value || '').trim();
  return nombre !== editPostTipoInitialValues.nombre ||
         desc !== editPostTipoInitialValues.descripcion ||
         rolId !== editPostTipoInitialValues.rolId;
}

async function prepareCreatePostTipoForm() {
  await populateRolesSelect('newPostTipoRolId');
}

async function handleSaveCreatePostTipo(event) {
  event.preventDefault();
  const nombre = document.getElementById('newPostTipoNombre').value.trim();
  const descripcion = document.getElementById('newPostTipoDesc').value.trim();
  const rolIdVal = document.getElementById('newPostTipoRolId') ? document.getElementById('newPostTipoRolId').value : '';
  const rolId = rolIdVal ? parseInt(rolIdVal, 10) : null;
  if (!nombre) return;

  try {
    const res = await apiFetch('/api/modulos/tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, rolId })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al crear el tipo de publicación.');
    }
    await loadPostTiposList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Creado', text: 'El tipo fue creado correctamente.', timer: 1800, showConfirmButton: false });
    navigateTo('/tipos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleSaveEditPostTipo(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editPostTipoId').value;
  const nombre = document.getElementById('editPostTipoNombre').value.trim();
  const descripcion = document.getElementById('editPostTipoDesc').value.trim();
  const rolIdVal = document.getElementById('editPostTipoRolId') ? document.getElementById('editPostTipoRolId').value : '';
  const rolId = rolIdVal ? parseInt(rolIdVal, 10) : null;
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
      body: JSON.stringify({ nombre, descripcion, rolId })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al actualizar el tipo.');
    }
    await loadPostTiposList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    navigateTo('/tipos');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleCancelEditPostTipo(event) {
  if (event) event.preventDefault();

  if (hasPostTipoEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones en este tipo de publicación. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });

    if (!confirmResult.isConfirmed) return;
  }

  navigateTo('/tipos');
}

async function handleDeleteTipoFromForm() {
  const id = document.getElementById('editPostTipoId').value;
  const nombre = document.getElementById('editPostTipoNombre') ? document.getElementById('editPostTipoNombre').value : '';
  if (id) {
    const success = await handleDeletePostTipo(id, nombre);
    if (success) {
      navigateTo('/tipos');
    }
  }
}

// 3.5 TIPOS DE CONOCIMIENTO
let editTipoConocimientoInitialValues = { nombre: '', descripcion: '' };

async function loadTipoConocimientoForShow(id) {
  switchAppView('viewTipoConocimientoEdit');
  await loadTipoConocimientoForEdit(id);
  setFormReadOnlyMode('editTipoConocimientoForm', true, 'Detalles del Tipo de Conocimiento', 'fa-eye');
}

async function loadTipoConocimientoForEdit(id) {
  setFormReadOnlyMode('editTipoConocimientoForm', false);
  setFormSkeletonState('editTipoConocimientoForm', true);
  try {
    const res = await apiFetch('/api/modulos/tipos-conocimiento');
    if (res.ok) {
      const tipos = await res.json();
      const t = tipos.find(x => x.id === parseInt(id, 10));
      if (t) {
        const idEl = document.getElementById('editTipoConocimientoId');
        const nombreEl = document.getElementById('editTipoConocimientoNombre');
        const descEl = document.getElementById('editTipoConocimientoDesc');

        if (idEl) idEl.value = t.id;
        if (nombreEl) nombreEl.value = t.nombre || '';
        if (descEl) descEl.value = t.descripcion || '';

        editTipoConocimientoInitialValues = {
          nombre: (t.nombre || '').trim(),
          descripcion: (t.descripcion || '').trim()
        };
      }
    }
  } catch (e) {
    console.error('Error cargando tipo de conocimiento para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editTipoConocimientoForm', false), 250);
  }
}

function hasTipoConocimientoEditChanged() {
  if (document.getElementById('editTipoConocimientoForm')?.dataset.readOnly === 'true') return false;
  const nombre = (document.getElementById('editTipoConocimientoNombre')?.value || '').trim();
  const desc = (document.getElementById('editTipoConocimientoDesc')?.value || '').trim();
  return nombre !== editTipoConocimientoInitialValues.nombre || desc !== editTipoConocimientoInitialValues.descripcion;
}

async function handleSaveCreateTipoConocimiento(event) {
  event.preventDefault();
  const nombre = document.getElementById('newTipoConocimientoNombre').value.trim();
  const descripcion = document.getElementById('newTipoConocimientoDesc').value.trim();
  if (!nombre) return;

  try {
    const res = await apiFetch('/api/modulos/tipos-conocimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al crear el tipo de conocimiento.');
    }
    await loadTiposConocimientoList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Creado', text: 'El tipo de conocimiento se creó correctamente.', timer: 1800, showConfirmButton: false });
    window.lastTiposSubTab = 'conocimiento';
    navigateTo('/tipos-conocimiento');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleSaveEditTipoConocimiento(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editTipoConocimientoId').value;
  const nombre = document.getElementById('editTipoConocimientoNombre').value.trim();
  const descripcion = document.getElementById('editTipoConocimientoDesc').value.trim();
  if (!id || !nombre) return;

  const hasChanged = hasTipoConocimientoEditChanged();

  const confirmResult = await getPrixmaSwal().fire({
    title: '¿Guardar cambios?',
    text: hasChanged
      ? `¿Deseas guardar las modificaciones realizadas en el tipo de conocimiento "${nombre}"?`
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
      body: JSON.stringify({ id: parseInt(id, 10), nombre, descripcion })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Error al actualizar el tipo de conocimiento.');
    }
    await loadTiposConocimientoList();
    getPrixmaSwal().fire({ icon: 'success', title: 'Tipo Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    window.lastTiposSubTab = 'conocimiento';
    navigateTo('/tipos-conocimiento');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleCancelEditTipoConocimiento(event) {
  if (event) event.preventDefault();

  if (hasTipoConocimientoEditChanged()) {
    const confirmResult = await getPrixmaSwal().fire({
      title: '¿Descartar cambios?',
      text: 'Has realizado modificaciones en este tipo de conocimiento. ¿Estás seguro de que deseas salir sin guardar?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> Sí, descartar',
      cancelButtonText: 'Continuar editando'
    });

    if (!confirmResult.isConfirmed) return;
  }

  window.lastTiposSubTab = 'conocimiento';
  navigateTo('/tipos-conocimiento');
}

async function handleDeleteTipoConocimientoFromForm() {
  const id = document.getElementById('editTipoConocimientoId').value;
  const nombre = document.getElementById('editTipoConocimientoNombre') ? document.getElementById('editTipoConocimientoNombre').value : '';
  if (id) {
    const success = await handleDeleteTipoConocimiento(id, nombre);
    if (success) {
      window.lastTiposSubTab = 'conocimiento';
      navigateTo('/tipos-conocimiento');
    }
  }
}

// 4. ROLES Y PERMISOS
let editRoleInitialValues = { nombre: '', descripcion: '' };

async function loadRoleForShow(id) {
  switchAppView('viewRoleEdit');
  await loadRoleForEdit(id);
  setFormReadOnlyMode('editRoleForm', true, 'Detalles del Rol y Permisos', 'fa-eye');
}

async function loadRoleForEdit(id) {
  setFormReadOnlyMode('editRoleForm', false);
  setFormSkeletonState('editRoleForm', true);
  try {
    const res = await apiFetch('/api/roles');
    if (res.ok) {
      const roles = await res.json();
      const r = roles.find(x => x.id === parseInt(id, 10));
      if (r) {
        const idEl = document.getElementById('editRoleId');
        const nombreEl = document.getElementById('editRoleNombre');
        const descEl = document.getElementById('editRoleDesc');

        if (idEl) idEl.value = r.id;
        if (nombreEl) nombreEl.value = r.nombre || '';
        if (descEl) descEl.value = r.descripcion || '';

        editRoleInitialValues = {
          nombre: (r.nombre || '').trim(),
          descripcion: (r.descripcion || '').trim()
        };
      }
    }
  } catch (e) {
    console.error('Error cargando rol para edición:', e);
  } finally {
    setTimeout(() => setFormSkeletonState('editRoleForm', false), 250);
  }
}

function hasRoleEditChanged() {
  if (document.getElementById('editRoleForm')?.dataset.readOnly === 'true') return false;
  const nombre = (document.getElementById('editRoleNombre')?.value || '').trim();
  const desc = (document.getElementById('editRoleDesc')?.value || '').trim();
  return nombre !== editRoleInitialValues.nombre || desc !== editRoleInitialValues.descripcion;
}

async function handleSaveCreateRole(event) {
  event.preventDefault();
  const nombre = document.getElementById('newRoleNombre').value.trim();
  const descripcion = document.getElementById('newRoleDesc').value.trim();
  if (!nombre) return;

  try {
    const res = await apiFetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, permisosIds: [] })
    });
    if (!res.ok) throw new Error('Error al crear el rol.');
    getPrixmaSwal().fire({ icon: 'success', title: 'Rol Creado', text: 'El rol ha sido registrado correctamente.', timer: 1800, showConfirmButton: false });
    navigateTo('/rbac');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleSaveEditRole(event) {
  if (event) event.preventDefault();
  const id = document.getElementById('editRoleId').value;
  const nombre = document.getElementById('editRoleNombre').value.trim();
  const descripcion = document.getElementById('editRoleDesc').value.trim();
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
    if (!res.ok) throw new Error('Error al actualizar el rol.');
    getPrixmaSwal().fire({ icon: 'success', title: 'Rol Actualizado', text: 'Los cambios fueron guardados correctamente.', timer: 1800, showConfirmButton: false });
    navigateTo('/rbac');
  } catch (err) {
    getPrixmaSwal().fire({ icon: 'error', title: 'Error', text: err.message });
  }
}

async function handleCancelEditRole(event) {
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

  navigateTo('/rbac');
}

async function handleDeleteRoleFromForm() {
  const id = document.getElementById('editRoleId').value;
  const nombre = document.getElementById('editRoleNombre') ? document.getElementById('editRoleNombre').value : '';
  if (id) {
    const success = await handleDeleteRole(id, nombre);
    if (success) {
      navigateTo('/rbac');
    }
  }
}


