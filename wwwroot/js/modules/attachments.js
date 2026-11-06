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

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
  'zip', 'rar', '7z'
]);

const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi', 'dll', 'com', 'scr', 'pif'
]);

export function validateSelectedFiles(incomingFiles, currentFiles = []) {
  const validFiles = [];
  const rejectedReasons = [];

  let currentTotalSize = (currentFiles || []).reduce((acc, f) => acc + (f.size || 0), 0);

  for (const file of incomingFiles) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (!ext) {
      rejectedReasons.push(`"${file.name}": no posee una extensión de archivo válida.`);
      continue;
    }

    if (BLOCKED_EXTENSIONS.has(ext)) {
      rejectedReasons.push(`"${file.name}": por políticas de seguridad corporativa no se admiten scripts o ejecutables (.${ext}).`);
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      rejectedReasons.push(`"${file.name}": tipo de archivo no permitido (.${ext}).`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejectedReasons.push(`"${file.name}": supera el límite permitido de 25 MB.`);
      continue;
    }

    if (currentTotalSize + file.size > MAX_TOTAL_SIZE_BYTES) {
      rejectedReasons.push(`"${file.name}": excede el cupo total acumulado de 100 MB para la publicación.`);
      continue;
    }

    currentTotalSize += file.size;
    validFiles.push(file);
  }

  if (rejectedReasons.length > 0) {
    getPrixmaSwal().fire({
      icon: 'warning',
      title: 'Archivos no admitidos',
      html: `<div style="text-align:left; font-size:0.9rem; max-height:220px; overflow-y:auto;">
              <p style="margin-bottom:0.5rem;">Se omitieron los siguientes archivos:</p>
              <ul style="padding-left:1.2rem; margin:0;">
                ${rejectedReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
              </ul>
             </div>`,
      confirmButtonText: 'Entendido'
    });
  }

  return validFiles;
}

export function handleFileSelect(event) {
  const files = Array.from(event.target.files || []);
  const validFiles = validateSelectedFiles(files, state.selectedFiles);
  if (validFiles.length > 0) {
    state.selectedFiles = [...state.selectedFiles, ...validFiles];
    autoSelectDefaultImageCover();
    renderFilePreviews();
  }
  if (event.target) event.target.value = '';
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
