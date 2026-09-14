let currentModuloId = null;
let currentSearch = '';
let selectedFiles = [];
let coverIndex = 0;
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  loadModulos();
  loadPostTipos();
  loadPosts();
});

// Carga los módulos para los filtros y selectores
async function loadModulos() {
  try {
    const res = await fetch('/api/modulos');
    if (!res.ok) return;
    const modulos = await res.json();

    // Renderizar Filtros
    const filterContainer = document.getElementById('modulesFilter');
    let filterHtml = `<button class="module-pill ${currentModuloId === null ? 'active' : ''}" onclick="filterByModule(null, this)">Todos</button>`;
    modulos.forEach(m => {
      filterHtml += `<button class="module-pill ${currentModuloId === m.id ? 'active' : ''}" onclick="filterByModule(${m.id}, this)">${escapeHtml(m.nombre)}</button>`;
    });
    filterContainer.innerHTML = filterHtml;

    // Renderizar Selector en Modal de Creación
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

// Filtro por módulo
function filterByModule(moduloId, btnElement) {
  currentModuloId = moduloId;
  document.querySelectorAll('.module-pill').forEach(el => el.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  loadPosts();
}

// Búsqueda en tiempo real
function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentSearch = document.getElementById('searchInput').value.trim();
    loadPosts();
  }, 350);
}

// Manejo de archivos seleccionados
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

// Enviar creación de publicación con FormData (Archivos + datos)
async function handleCreatePost(event) {
  event.preventDefault();

  const btn = document.getElementById('btnSubmitPost');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    const formData = new FormData();
    formData.append('UsuarioId', 1); // Usuario por defecto (Admin)
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

// Enviar creación de módulo
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

// Abrir detalle del post
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

    // Galería de adjuntos
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

// Helpers Modal
function openCreateModal() { openModal('createModal'); }
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
