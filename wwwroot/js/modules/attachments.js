import { state } from '../core/state.js';
import { apiFetch } from '../core/api.js';
import { escapeHtml, formatBytes } from '../core/utils.js';
import { getPrixmaSwal } from '../core/ui-helpers.js';

export function getFileMeta(fileName, mimeType = '') {
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

export function autoSelectDefaultImageCover() {
  if (state.selectedFiles.length === 0) {
    state.coverIndex = -1;
    return;
  }
  if (state.coverIndex >= 0 && state.coverIndex < state.selectedFiles.length) {
    const currentMeta = getFileMeta(state.selectedFiles[state.coverIndex].name, state.selectedFiles[state.coverIndex].type);
    if (currentMeta.isImage) return;
  }
  state.coverIndex = state.selectedFiles.findIndex(f => getFileMeta(f.name, f.type).isImage);
}

export function renderFilePreviews() {
  const container = document.getElementById('filePreviews');
  if (!container) return;

  if (state.selectedFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = state.selectedFiles.map((file, idx) => {
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
        <input type="radio" name="portadaRadio" ${state.coverIndex === idx ? 'checked' : ''} onchange="window.setCoverIndex(${idx})"> Portada
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

export function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  state.selectedFiles = [...state.selectedFiles, ...files];
  autoSelectDefaultImageCover();
  renderFilePreviews();
}

export function removeSelectedFile(index) {
  state.selectedFiles.splice(index, 1);
  autoSelectDefaultImageCover();
  renderFilePreviews();
}

export async function handleDeleteAttachment(adjuntoId, postId, isFromEdit = false) {
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
        if (window.openEditView) window.openEditView(postId);
      } else {
        if (window.openDetailView) window.openDetailView(postId);
      }
    }
    if (window.loadPosts) window.loadPosts(state.currentPage);
  } catch (err) {
    getPrixmaSwal().fire({
      icon: 'error',
      title: 'Error de Inactivación',
      text: err.message
    });
  }
}


export function initDragAndDropZone(zoneElement, onFilesAdded) {
  if (!zoneElement) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    zoneElement.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    zoneElement.addEventListener(eventName, () => {
      zoneElement.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zoneElement.addEventListener(eventName, () => {
      zoneElement.classList.remove('dragover');
    }, false);
  });

  zoneElement.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      onFilesAdded(Array.from(dt.files));
    }
  }, false);
}
