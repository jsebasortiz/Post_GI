let currentModuloId = null;
let currentSearch = '';
let selectedFiles = [];
let coverIndex = 0;
let searchDebounceTimer = null;
let currentUser = null;

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

function renderUserNavArea() {
  const container = document.getElementById('userNavArea');
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <div class="avatar-sm" style="width:34px; height:34px; font-size:0.9rem;">${escapeHtml(currentUser.nombre.charAt(0).toUpperCase())}</div>
        <div style="font-size:0.85rem; line-height:1.2;">
          <strong style="color:white; display:block;">${escapeHtml(currentUser.nombre)}</strong>
          <span style="font-size:0.72rem; color:var(--accent-cyan);"><i class="fa-solid fa-shield-halved"></i> AD Autenticado</span>
        </div>
        <button class="btn btn-secondary" onclick="handleLogout()" style="padding:0.4rem 0.75rem; margin-left:0.5rem; font-size:0.8rem;" title="Cerrar Sesión">
          <i class="fa-solid fa-right-from-bracket"></i> Salir
        </button>
      </div>
    `;
  } else {
    container.innerHTML = '';
  }
}

// Autenticación con Directorio Activo via REST API
async function handleLogin(event) {
  event.preventDefault();
  const errorMsg = document.getElementById('loginErrorMsg');
  const btn = document.getElementById('btnLoginSubmit');

  errorMsg.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando a AD...';

  const correo = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  try {
    const res = await fetch('/api/usuarios/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, password })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Credenciales de Directorio Activo incorrectas o el usuario no existe en AD.');
    }

    const user = await res.json();
    currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));

    const form = document.getElementById('gateLoginForm');
    if (form) form.reset();

    showMainApp();
  } catch (err) {
    errorMsg.innerText = err.message;
    errorMsg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Autenticar y Entrar';
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  showAuthGate();
}

// Carga los módulos para los filtros y selectores
async function loadModulos() {
  try {
    const res = await fetch('/api/modulos');
    if (!res.ok) return;
    const modulos = await res.json();

    const filterContainer = document.getElementById('modulesFilter');
    let filterHtml = `<button class="module-pill ${currentModuloId === null ? 'active' : ''}" onclick="filterByModule(null, this)">Todos</button>`;
    modulos.forEach(m => {
      filterHtml += `<button class="module-pill ${currentModuloId === m.id ? 'active' : ''}" onclick="filterByModule(${m.id}, this)">${escapeHtml(m.nombre)}</button>`;
    });
    filterContainer.innerHTML = filterHtml;

    const selectModulo = document.getElementById('selectModulo');
    let selectHtml = '<option value="">-- Selecciona un Módulo --</option>';
    modulos.forEach(m => {
      selectHtml += `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`;
    });
    selectModulo.innerHTML = selectHtml;
  } catch (err) {
    console.error('Error cargando módulos:', err);
  }
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

// Cargar posts con filtros opcionales
async function loadPosts() {
  const grid = document.getElementById('postsGrid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p style="margin-top: 1rem;">Cargando publicaciones...</p>
    </div>
  `;

  try {
    let url = '/api/posts?estado=publicado';
    if (currentModuloId) url += `&moduloId=${currentModuloId}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudieron obtener las publicaciones.');

    const posts = await res.json();

    if (!posts || posts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem 1rem;">
          <i class="fa-solid fa-folder-open fa-3x" style="margin-bottom: 1rem; color: var(--primary);"></i>
          <h3>No se encontraron publicaciones</h3>
          <p style="font-size:0.9rem; margin-top:0.5rem;">Intenta seleccionar otro módulo o crea una nueva publicación.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = posts.map(post => renderPostCard(post)).join('');
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--accent-rose); padding: 3rem;">
        <i class="fa-solid fa-triangle-exclamation fa-2x"></i>
        <p style="margin-top: 0.5rem;">${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function renderPostCard(post) {
  const coverUrl = post.portadaUrl || (post.adjuntos && post.adjuntos.length > 0 ? post.adjuntos[0].archivoUrl : null);
  const coverHtml = coverUrl
    ? `<img src="${coverUrl}" alt="${escapeHtml(post.titulo)}" loading="lazy">`
    : `<div class="post-cover-placeholder"><i class="fa-solid fa-newspaper"></i></div>`;

  const dateStr = new Date(post.creadoEn).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const attachCount = post.adjuntos ? post.adjuntos.length : 0;

  return `
    <article class="post-card" onclick="openDetailModal(${post.id})">
      <div class="post-cover">
        <div class="badge-group">
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
  loadPosts();
}

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentSearch = document.getElementById('searchInput').value.trim();
    loadPosts();
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
    alert('Por favor inicia sesión con tu usuario de Directorio Activo antes de publicar.');
    openLoginModal();
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
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar Ahora';
  }
}

async function handleCreateModule(event) {
  event.preventDefault();
  const nombre = document.getElementById('moduloNombre').value;
  const descripcion = document.getElementById('moduloDesc').value;

  try {
    const res = await fetch('/api/modulos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion })
    });

    if (!res.ok) throw new Error('Error al crear el módulo.');

    closeModal('moduleModal');
    document.getElementById('createModuleForm').reset();
    loadModulos();
  } catch (err) {
    alert(err.message);
  }
}

async function openDetailModal(postId) {
  try {
    const res = await fetch(`/api/posts/${postId}`);
    if (!res.ok) return;
    const post = await res.json();

    document.getElementById('detailBadges').innerHTML = `
      <span class="badge badge-module" style="position:static;">${escapeHtml(post.moduloNombre)}</span>
      <span class="badge badge-type" style="position:static; margin-left:0.5rem;">${escapeHtml(post.tipoNombre)}</span>
    `;
    document.getElementById('detailTitle').innerText = post.titulo;

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
      let galleryHtml = `<h4 style="color:white; font-size:1.1rem; margin-bottom:0.75rem;"><i class="fa-solid fa-paperclip"></i> Archivos y Fotos Adjuntas (${post.adjuntos.length})</h4><div class="attachments-grid">`;
      post.adjuntos.forEach(att => {
        const isImage = att.mimeType.startsWith('image/');
        galleryHtml += `
          <div class="attachment-item">
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
