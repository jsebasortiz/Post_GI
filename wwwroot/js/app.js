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

// SweetAlert2 Prixma Custom Dark Helper
function getPrixmaSwal() {
  if (typeof Swal !== 'undefined') {
    return Swal.mixin({
      background: '#131927',
      color: '#f8fafc',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#f43f5e',
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

document.addEventListener('DOMContentLoaded', () => {
  initUserSession();
});

// Inicializar la sesión del usuario guardada en localStorage
function initUserSession() {
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
    } catch (e) {
      currentUser = null;
      localStorage.removeItem('currentUser');
    }
  }

  if (currentUser) {
    showMainApp();
  } else {
    showAuthGate();
  }
}

function showMainApp() {
  const authGate = document.getElementById('authGateScreen');
  const mainApp = document.getElementById('appMainArea');
  if (authGate) authGate.classList.add('view-hidden');
  if (mainApp) mainApp.classList.remove('view-hidden');

  renderUserNavArea();
  loadModulos();
  loadPostTipos();
  loadPosts();
}

function showAuthGate() {
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
  const btnRbac = document.getElementById('btnOpenRbacModal');

  if (btnPost) btnPost.style.display = hasPermission('posts.create') ? 'inline-flex' : 'none';
  if (btnModule) btnModule.style.display = hasPermission('modulos.create') ? 'inline-flex' : 'none';
  if (btnRbac) btnRbac.style.display = hasPermission('roles.manage') ? 'inline-flex' : 'none';
}

function renderUserNavArea() {
  const container = document.getElementById('userNavArea');
  if (!container) return;

  if (currentUser) {
    const rolBadge = currentUser.rolNombre || 'Lector';
    container.innerHTML = `
      <div class="user-nav-profile">
        <div class="avatar-sm" style="width:32px; height:32px; font-size:0.85rem; flex-shrink:0;">${escapeHtml(currentUser.nombre.charAt(0).toUpperCase())}</div>
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

    const user = await res.json();
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));

    const form = document.getElementById('gateLoginForm');
    if (form) form.reset();

    showMainApp();
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


function handleLogout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  showAuthGate();
}

function switchMainCategory(categoriaPadre, tabBtnElement) {
  currentCategoriaPadre = categoriaPadre;
  currentModuloId = null;
  document.querySelectorAll('.category-tab').forEach(el => el.classList.remove('active'));
  if (tabBtnElement) tabBtnElement.classList.add('active');

  loadModulos();
  loadPosts(1);
}

// Carga los módulos para los filtros y selectores
async function loadModulos() {
  try {
    const res = await fetch('/api/modulos');
    if (!res.ok) return;
    allModulosCache = await res.json();

    let modulosToRender = allModulosCache;
    if (currentCategoriaPadre) {
      modulosToRender = allModulosCache.filter(m => m.categoriaPadre && m.categoriaPadre.toLowerCase() === currentCategoriaPadre.toLowerCase());
    }

    const filterContainer = document.getElementById('modulesFilter');
    let filterHtml = `<button class="module-pill ${currentModuloId === null ? 'active' : ''}" onclick="filterByModule(null, this)">Todos los Módulos</button>`;
    modulosToRender.forEach(m => {
      filterHtml += `<button class="module-pill ${currentModuloId === m.id ? 'active' : ''}" onclick="filterByModule(${m.id}, this)">${escapeHtml(m.nombre)}</button>`;
    });
    filterContainer.innerHTML = filterHtml;

    const modalCatSelect = document.getElementById('selectCategoriaPadre');
    const selectedCategory = modalCatSelect ? modalCatSelect.value : 'apps';
    updatePostSubmoduloSelect(selectedCategory);
  } catch (err) {
    console.error('Error cargando módulos:', err);
  }
}

function onPostCategoriaChange(cat) {
  updatePostSubmoduloSelect(cat);
}

function updatePostSubmoduloSelect(cat) {
  const selectModulo = document.getElementById('selectModulo');
  if (!selectModulo) return;

  const filtered = allModulosCache.filter(m => !cat || (m.categoriaPadre && m.categoriaPadre.toLowerCase() === cat.toLowerCase()));
  let selectHtml = '<option value="">-- Selecciona un Módulo --</option>';
  filtered.forEach(m => {
    selectHtml += `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`;
  });
  selectModulo.innerHTML = selectHtml;
}

// Carga los tipos de posts para el selector
async function loadPostTipos() {
  try {
    const res = await fetch('/api/modulos/tipos');
    if (!res.ok) return;
    const tipos = await res.json();

    const selectTipo = document.getElementById('selectTipo');
    let selectHtml = '<option value="">-- Tipo de Publicación --</option>';
    tipos.forEach(t => {
      selectHtml += `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`;
    });
    selectTipo.innerHTML = selectHtml;
  } catch (err) {
    console.error('Error cargando tipos de posts:', err);
  }
}

// Cargar posts con filtros opcionales y paginación
async function loadPosts(page = 1) {
  currentPage = page;
  const grid = document.getElementById('postsGrid');
  const pagination = document.getElementById('paginationContainer');

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p style="margin-top: 1rem;">Cargando publicaciones...</p>
    </div>
  `;

  try {
    let url = `/api/posts?estado=publicado&page=${currentPage}&pageSize=${pageSize}`;
    if (currentCategoriaPadre) url += `&categoriaPadre=${encodeURIComponent(currentCategoriaPadre)}`;
    if (currentModuloId) url += `&moduloId=${currentModuloId}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    const res = await fetch(url);
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

function renderPostCard(post) {
  const coverUrl = post.portadaUrl || (post.adjuntos && post.adjuntos.length > 0 ? post.adjuntos[0].archivoUrl : null);
  const coverHtml = coverUrl
    ? `<img src="${coverUrl}" alt="${escapeHtml(post.titulo)}" loading="lazy">`
    : `<div class="post-cover-placeholder"><i class="fa-solid fa-newspaper"></i></div>`;

  const dateStr = new Date(post.creadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const attachCount = post.adjuntos ? post.adjuntos.length : 0;

  const catBadge = post.moduloCategoriaPadre === 'infraestructura'
    ? `<span class="badge badge-cat-infra"><i class="fa-solid fa-server"></i> Infraestructura</span>`
    : `<span class="badge badge-cat-apps"><i class="fa-solid fa-rocket"></i> Apps</span>`;

  const canEdit = hasPermission('posts.edit');
  const canDelete = hasPermission('posts.delete');

  const actionsHtml = (canEdit || canDelete) ? `
    <div class="post-card-actions">
      ${canEdit ? `<button class="btn-card-action" onclick="event.stopPropagation(); openEditModal(${post.id})" title="Editar Publicación"><i class="fa-solid fa-pen-to-square"></i></button>` : ''}
      ${canDelete ? `<button class="btn-card-action btn-card-delete" onclick="event.stopPropagation(); handleDeletePost(${post.id})" title="Eliminar Publicación"><i class="fa-solid fa-trash-can"></i></button>` : ''}
    </div>
  ` : '';

  return `
    <article class="post-card" onclick="openDetailModal(${post.id})">
      ${actionsHtml}
      <div class="post-cover">
        <div class="badge-group">
          ${catBadge}
          <span class="badge badge-module">${escapeHtml(post.moduloNombre)}</span>
          <span class="badge badge-type">${escapeHtml(post.tipoNombre)}</span>
        </div>
        ${coverHtml}
      </div>
      <div class="post-body">
        <h3 class="post-title">${escapeHtml(post.titulo)}</h3>
        <p class="post-summary">${escapeHtml(post.resumen || post.contenido)}</p>
        <div class="post-meta">
          <div class="author-info">
            <div class="avatar-sm">${escapeHtml(post.usuarioNombre.charAt(0).toUpperCase())}</div>
            <span>${escapeHtml(post.usuarioNombre)}</span>
          </div>
          <div style="display:flex; gap:0.75rem; align-items:center;">
            <span><i class="fa-regular fa-eye"></i> ${post.visitas}</span>
            ${attachCount > 0 ? `<span class="post-attachments-count"><i class="fa-solid fa-paperclip"></i> ${attachCount}</span>` : ''}
            <span>${dateStr}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function filterByModule(moduloId, btnElement) {
  currentModuloId = moduloId;
  document.querySelectorAll('.module-pill').forEach(el => el.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  loadPosts(1);
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
  renderFilePreviews();
}

function renderFilePreviews() {
  const container = document.getElementById('filePreviews');
  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedFiles.map((file, idx) => {
    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : null;
    
    return `
      <div class="file-preview-card">
        ${isImage ? `<img src="${previewUrl}">` : `<div style="height:100%; display:flex; align-items:center; justify-content:center; background:#0f172a;"><i class="fa-regular fa-file-pdf fa-2x" style="color:var(--accent-rose);"></i></div>`}
        <button type="button" onclick="removeSelectedFile(${idx})" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;">&times;</button>
        <label class="cover-radio">
          <input type="radio" name="portadaRadio" ${coverIndex === idx ? 'checked' : ''} onchange="coverIndex = ${idx}"> Portada
        </label>
      </div>
    `;
  }).join('');
}

function removeSelectedFile(index) {
  selectedFiles.splice(index, 1);
  if (coverIndex >= selectedFiles.length) coverIndex = Math.max(0, selectedFiles.length - 1);
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
    formData.append('Titulo', document.getElementById('postTitulo').value);
    formData.append('Resumen', document.getElementById('postResumen').value);
    formData.append('Contenido', document.getElementById('postContenido').value);
    formData.append('Estado', 'publicado');
    formData.append('PortadaIndex', coverIndex);

    selectedFiles.forEach(file => {
      formData.append('Archivos', file);
    });

    const res = await fetch('/api/posts', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error al guardar la publicación.');
    }

    closeModal('createModal');
    document.getElementById('createPostForm').reset();
    selectedFiles = [];
    renderFilePreviews();
    loadPosts();

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
    const res = await fetch('/api/modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, categoriaPadre, descripcion })
    });

    if (!res.ok) throw new Error('Error al crear el módulo.');

    closeModal('moduleModal');
    document.getElementById('createModuleForm').reset();
    loadModulos();

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

async function openDetailModal(postId) {
  try {
    const res = await fetch(`/api/posts/${postId}`);
    if (!res.ok) return;
    const post = await res.json();

    const catBadge = post.moduloCategoriaPadre === 'infraestructura'
      ? `<span class="badge badge-cat-infra" style="position:static;"><i class="fa-solid fa-server"></i> Infraestructura</span>`
      : `<span class="badge badge-cat-apps" style="position:static;"><i class="fa-solid fa-rocket"></i> Apps</span>`;

    document.getElementById('detailBadges').innerHTML = `
      ${catBadge}
      <span class="badge badge-module" style="position:static; margin-left:0.5rem;">${escapeHtml(post.moduloNombre)}</span>
      <span class="badge badge-type" style="position:static; margin-left:0.5rem;">${escapeHtml(post.tipoNombre)}</span>
    `;
    document.getElementById('detailTitle').innerText = post.titulo;

    // Render detail header actions (Editar / Eliminar)
    const headerActions = document.getElementById('detailHeaderActions');
    if (headerActions) {
      let actHtml = '';
      if (hasPermission('posts.edit')) {
        actHtml += `<button class="btn btn-secondary" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="closeModal('detailModal'); openEditModal(${post.id});"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`;
      }
      if (hasPermission('posts.delete')) {
        actHtml += `<button class="btn btn-danger" style="padding:0.35rem 0.75rem; font-size:0.85rem;" onclick="closeModal('detailModal'); handleDeletePost(${post.id});"><i class="fa-solid fa-trash-can"></i> Eliminar</button>`;
      }
      headerActions.innerHTML = actHtml;
    }

    const dateStr = new Date(post.creadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('detailMeta').innerHTML = `
      <span><i class="fa-regular fa-user"></i> ${escapeHtml(post.usuarioNombre)}</span>
      <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
      <span><i class="fa-regular fa-eye"></i> ${post.visitas} visitas</span>
    `;

    const coverUrl = post.portadaUrl || (post.adjuntos && post.adjuntos.length > 0 ? post.adjuntos[0].archivoUrl : null);
    const coverContainer = document.getElementById('detailCoverContainer');
    if (coverUrl) {
      coverContainer.innerHTML = `<img src="${coverUrl}" class="post-detail-cover" alt="Portada">`;
    } else {
      coverContainer.innerHTML = '';
    }

    document.getElementById('detailContent').innerText = post.contenido;

    const attachContainer = document.getElementById('detailAttachments');
    if (post.adjuntos && post.adjuntos.length > 0) {
      const canManageAdj = hasPermission('posts.edit') || hasPermission('posts.delete');
      let galleryHtml = `<h4 style="color:white; font-size:1.1rem; margin-bottom:0.75rem;"><i class="fa-solid fa-paperclip"></i> Archivos y Fotos Adjuntas (${post.adjuntos.length})</h4><div class="attachments-grid">`;
      post.adjuntos.forEach(att => {
        const isImage = att.mimeType.startsWith('image/');
        const deleteBtn = canManageAdj ? `
          <button type="button" onclick="event.stopPropagation(); handleDeleteAttachment(${att.id}, ${post.id})" title="Desactivar Adjunto" style="position:absolute; top:6px; right:6px; z-index:10; background:rgba(239, 68, 68, 0.85); color:white; width:28px; height:28px; border-radius:50%; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:transform 0.2s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
            <i class="fa-solid fa-trash-can" style="font-size:0.75rem;"></i>
          </button>
        ` : '';

        galleryHtml += `
          <div class="attachment-item" style="position:relative;">
            ${deleteBtn}
            ${isImage ? `<a href="${att.archivoUrl}" target="_blank"><img src="${att.archivoUrl}" alt="${escapeHtml(att.archivoNombreOriginal)}"></a>` : `<div style="height:110px; display:flex; align-items:center; justify-content:center;"><i class="fa-regular fa-file-pdf fa-3x" style="color:var(--accent-rose);"></i></div>`}
            <div class="attachment-info">
              <a href="${att.archivoUrl}" target="_blank" style="color:var(--accent-cyan); text-decoration:none;">${escapeHtml(att.archivoNombreOriginal)}</a>
              <div style="font-size:0.7rem; color:var(--text-muted);">${(att.tamanioBytes / 1024).toFixed(1)} KB ${att.esPortada ? '• 🌟 Portada' : ''}</div>
            </div>
          </div>
        `;
      });
      galleryHtml += '</div>';
      attachContainer.innerHTML = galleryHtml;
    } else {
      attachContainer.innerHTML = '';
    }

    openModal('detailModal');
  } catch (err) {
    console.error('Error al abrir detalle:', err);
  }
}

async function handleDeleteAttachment(adjuntoId, postId) {
  const result = await getPrixmaSwal().fire({
    title: '¿Inactivar archivo adjunto?',
    text: 'El archivo cambiará a estado inactivo (borrado lógico) y dejará de mostrarse en la publicación.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, inactivar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`/api/posts/adjuntos/${adjuntoId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'No fue posible inactivar el archivo adjunto.');
    }

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Adjunto Inactivado',
      text: 'El archivo adjunto pasó a estado inactivo correctamente.',
      timer: 1800,
      showConfirmButton: false
    });

    if (postId) {
      openDetailModal(postId);
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

function openCreateModal() {
  if (!currentUser) {
    showAuthGate();
    return;
  }
  openModal('createModal');
}

function openModuleModal() { openModal('moduleModal'); }

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
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
  loadRbacMatrix();
}

function switchRbacSubTab(tab) {
  const tabUsers = document.getElementById('rbacTabUsers');
  const tabMatrix = document.getElementById('rbacTabMatrix');
  const btnUsers = document.getElementById('tabBtnUsersRole');
  const btnMatrix = document.getElementById('tabBtnRolesMatrix');

  if (tab === 'users') {
    tabUsers.classList.remove('view-hidden');
    tabMatrix.classList.add('view-hidden');
    btnUsers.classList.add('active-rbac-tab');
    btnMatrix.classList.remove('active-rbac-tab');
  } else {
    tabUsers.classList.add('view-hidden');
    tabMatrix.classList.remove('view-hidden');
    btnUsers.classList.remove('active-rbac-tab');
    btnMatrix.classList.add('active-rbac-tab');
  }
}

// Estado global para la paginación y búsqueda del módulo de RBAC Usuarios
let rbacAllUsersCache = [];
let rbacAllRolesCache = [];
let rbacUserSearchTerm = '';
let rbacUsersCurrentPage = 1;
const rbacUsersPageSize = 6;

async function loadRbacUsers() {
  const tbody = document.getElementById('usersRolesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando usuarios...</td></tr>';

  try {
    const [resUsers, resRoles] = await Promise.all([
      fetch('/api/roles/usuarios'),
      fetch('/api/roles')
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
        <td style="font-weight:600; color:white;">${escapeHtml(u.nombre)}</td>
        <td style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(u.correo)}</td>
        <td><span class="badge badge-type" style="position:static;">${escapeHtml(u.rolNombre)}</span></td>
        <td style="text-align:right;">
          <select style="width:auto; padding:0.35rem 0.6rem; font-size:0.85rem;" onchange="handleAssignUserRole(${u.id}, this.value)">
            ${roleOptions}
          </select>
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

async function handleAssignUserRole(usuarioId, rolId) {
  try {
    const res = await fetch('/api/roles/asignar-usuario', {
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
      fetch('/api/roles'),
      fetch('/api/roles/permisos')
    ]);

    if (!resRoles.ok || !resPermisos.ok) throw new Error('Error al cargar permisos.');

    const roles = await resRoles.json();
    const permisos = await resPermisos.json();

    container.innerHTML = roles.map(r => {
      const activePermIds = new Set((r.permisos || []).map(p => p.id));

      const checkboxesHtml = permisos.map(p => {
        const isChecked = activePermIds.has(p.id);
        return `
          <label class="perm-label">
            <input type="checkbox" class="role-perm-cb-${r.id}" value="${p.id}" ${isChecked ? 'checked' : ''}>
            <span><strong>${escapeHtml(p.nombre)}</strong> <small style="color:var(--text-muted); display:block; font-size:0.75rem;">${escapeHtml(p.codigo)}</small></span>
          </label>
        `;
      }).join('');

      return `
        <div class="role-card">
          <div class="role-header">
            <div>
              <strong style="font-size:1.1rem; color:white;">${escapeHtml(r.nombre)}</strong>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(r.descripcion || '')}</p>
            </div>
            <button class="btn btn-secondary" onclick="handleSaveRolePermisos(${r.id})" style="padding:0.4rem 0.8rem; font-size:0.8rem;">
              <i class="fa-solid fa-floppy-disk"></i> Guardar Permisos
            </button>
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
    const res = await fetch(`/api/roles/${rolId}/permisos`, {
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
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, permisosIds: [] })
    });

    if (!res.ok) throw new Error('Error al crear el rol.');
    toggleNewRoleForm();
    document.getElementById('newRoleNombre').value = '';
    document.getElementById('newRoleDesc').value = '';
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

// --- FUNCIONALIDADES DE EDICIÓN Y ELIMINACIÓN DE PUBLICACIONES ---

let selectedEditFiles = [];
let currentEditingPost = null;

async function openEditModal(postId) {
  if (!hasPermission('posts.edit')) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes permisos para editar esta publicación.'
    });
    return;
  }

  try {
    const res = await fetch(`/api/posts/${postId}`);
    if (!res.ok) throw new Error('No se pudo obtener la publicación.');
    const post = await res.json();
    currentEditingPost = post;

    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitulo').value = post.titulo;
    document.getElementById('editPostResumen').value = post.resumen || '';
    document.getElementById('editPostContenido').value = post.contenido;

    const catSelect = document.getElementById('editSelectCategoriaPadre');
    if (catSelect) {
      catSelect.value = post.moduloCategoriaPadre || 'apps';
      updateEditPostSubmoduloSelect(catSelect.value, post.moduloId);
    }

    // Cargar tipos de post
    await loadEditPostTipos(post.tipoId);

    // Cargar adjuntos existentes
    const existingContainer = document.getElementById('editExistingAdjuntos');
    if (existingContainer) {
      if (post.adjuntos && post.adjuntos.length > 0) {
        existingContainer.innerHTML = post.adjuntos.map(att => `
          <div class="file-preview-item">
            <span><i class="fa-solid fa-paperclip"></i> ${escapeHtml(att.archivoNombreOriginal)}</span>
            <a href="${att.archivoUrl}" target="_blank" style="color:var(--accent-cyan); font-size:0.75rem; text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Ver</a>
          </div>
        `).join('');
      } else {
        existingContainer.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">Sin archivos adjuntos actualmente.</span>';
      }
    }

    // Limpiar archivos nuevos en cola
    selectedEditFiles = [];
    renderEditFilePreviews();

    // Mostrar u ocultar botón eliminar según permisos
    const btnDelete = document.getElementById('btnDeletePostInEdit');
    if (btnDelete) btnDelete.style.display = hasPermission('posts.delete') ? 'inline-flex' : 'none';

    openModal('editModal');
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Lectura',
      text: err.message
    });
  }
}

function onEditPostCategoriaChange(cat) {
  updateEditPostSubmoduloSelect(cat);
}

function updateEditPostSubmoduloSelect(cat, selectedModuloId = null) {
  const selectModulo = document.getElementById('editSelectModulo');
  if (!selectModulo) return;

  const filtered = allModulosCache.filter(m => !cat || (m.categoriaPadre && m.categoriaPadre.toLowerCase() === cat.toLowerCase()));
  let selectHtml = '<option value="">-- Selecciona un Módulo --</option>';
  filtered.forEach(m => {
    const isSel = selectedModuloId && m.id === selectedModuloId ? 'selected' : '';
    selectHtml += `<option value="${m.id}" ${isSel}>${escapeHtml(m.nombre)}</option>`;
  });
  selectModulo.innerHTML = selectHtml;
}

async function loadEditPostTipos(selectedTipoId = null) {
  try {
    const res = await fetch('/api/modulos/tipos');
    if (!res.ok) return;
    const tipos = await res.json();

    const selectTipo = document.getElementById('editSelectTipo');
    if (!selectTipo) return;

    let selectHtml = '<option value="">-- Tipo de Publicación --</option>';
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

  container.innerHTML = selectedEditFiles.map((file, idx) => `
    <div class="file-preview-item">
      <span><i class="fa-regular fa-file"></i> ${escapeHtml(file.name)}</span>
      <button type="button" class="remove-file-btn" onclick="removeEditFile(${idx})">&times;</button>
    </div>
  `).join('');
}

function removeEditFile(index) {
  selectedEditFiles.splice(index, 1);
  renderEditFilePreviews();
}

async function handleSaveEditPost(event) {
  event.preventDefault();
  const postId = document.getElementById('editPostId').value;
  const btn = document.getElementById('btnSubmitEditPost');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  const updateDto = {
    moduloId: parseInt(document.getElementById('editSelectModulo').value),
    tipoId: parseInt(document.getElementById('editSelectTipo').value),
    titulo: document.getElementById('editPostTitulo').value.trim(),
    resumen: document.getElementById('editPostResumen').value.trim(),
    contenido: document.getElementById('editPostContenido').value.trim(),
    estado: 'publicado'
  };

  try {
    const res = await fetch(`/api/posts/${postId}`, {
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
        await fetch(`/api/posts/${postId}/adjuntos`, {
          method: 'POST',
          body: formData
        });
      }
    }

    closeModal('editModal');
    loadPosts(currentPage);

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
    return;
  }

  const result = await getPrixmaSwal().fire({
    title: '¿Eliminar publicación?',
    text: 'Esta acción eliminará el artículo y sus adjuntos de forma permanente.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '<i class="fa-solid fa-trash-can"></i> Sí, eliminar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    customClass: {
      confirmButton: 'btn btn-danger',
      cancelButton: 'btn btn-secondary'
    }
  });

  if (!result.isConfirmed) return;

  try {
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('No se pudo eliminar la publicación.');

    getPrixmaSwal().fire({
      icon: 'success',
      title: 'Publicación Eliminada',
      text: 'La publicación ha sido eliminada correctamente.',
      timer: 2000,
      showConfirmButton: false
    });

    loadPosts(currentPage);
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error al Eliminar',
      text: err.message
    });
  }
}

function handleDeletePostFromModal() {
  const postId = document.getElementById('editPostId').value;
  if (postId) {
    closeModal('editModal');
    handleDeletePost(postId);
  }
}


