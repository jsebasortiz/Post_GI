import { getPrixmaSwal } from './ui-helpers.js';
// ==========================================================================
// Rich Text WYSIWYG HTML Editor & Sanitizer
// ==========================================================================

/**
 * Limpia y sanitiza cualquier código HTML para evitar inyecciones,
 * eliminando etiquetas de documento (<head>, <html>, <title>, <meta>, <style>, <script>, <body>)
 * y dejando un fragmento HTML limpio y seguro.
 */
export function cleanAndSanitizeHtml(inputHtml) {
  if (!inputHtml) return '';
  let html = String(inputHtml).trim();

  // 1. Eliminar etiquetas estructurales de página completa
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
  html = html.replace(/<html[^>]*>/gi, '').replace(/<\/html>/gi, '');
  html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  html = html.replace(/<meta[^>]*>/gi, '');
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<body[^>]*>/gi, '').replace(/<\/body>/gi, '');

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Quitar elementos no seguros
    const dangerous = doc.querySelectorAll('script, iframe, object, embed, form, button, input, textarea, select, link, style, meta, base');
    dangerous.forEach(el => el.remove());

    const allowedTags = new Set([
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr',
      'span', 'div', 'font', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
    ]);

    const allowedStyles = new Set([
      'font-family', 'font-size', 'color', 'background-color',
      'text-align', 'font-weight', 'font-style', 'text-decoration',
      'line-height', 'margin', 'padding', 'width', 'max-width'
    ]);

    const allEls = doc.body.querySelectorAll('*');
    allEls.forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (!allowedTags.has(tag)) {
        const parent = el.parentNode;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }

      const attrs = Array.from(el.attributes);
      attrs.forEach(attr => {
        const name = attr.name.toLowerCase();
        const val = attr.value;

        // Quitar manejadores on*
        if (name.startsWith('on')) {
          el.removeAttribute(name);
          return;
        }

        if (name === 'href' || name === 'src') {
          const lowerVal = val.trim().toLowerCase();
          if (lowerVal.startsWith('javascript:') || lowerVal.startsWith('vbscript:')) {
            el.removeAttribute(name);
          }
          if (tag === 'a') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        } else if (name === 'style') {
          const cleaned = val.split(';')
            .map(s => s.trim())
            .filter(s => {
              if (!s) return false;
              const parts = s.split(':');
              if (parts.length < 2) return false;
              const prop = parts[0].trim().toLowerCase();
              const propVal = parts.slice(1).join(':').trim().toLowerCase();
              if (propVal.includes('url(') || propVal.includes('javascript') || propVal.includes('expression')) return false;
              return allowedStyles.has(prop);
            })
            .join('; ');
          if (cleaned) {
            el.setAttribute('style', cleaned);
          } else {
            el.removeAttribute('style');
          }
        } else if (name === 'face' || name === 'size' || name === 'color' || name === 'align' || name === 'class' || name === 'alt' || name === 'title') {
          // Atributos seguros permitidos
        } else {
          el.removeAttribute(name);
        }
      });
    });

    html = doc.body.innerHTML.trim();
  }

  // Si queda un nodo vacío residual
  if (html === '<p><br></p>' || html === '<p></p>' || html === '<br>' || html === '<div><br></div>') {
    return '';
  }

  return html;
}

/**
 * Ejecuta un comando en el editor de texto enriquecido activo.
 */
export function execEditorCommand(command, value = null) {
  document.execCommand(command, false, value);
}

/**
 * Inserta un enlace en el texto seleccionado del editor activo.
 */
export async function formatEditorLink() {
  const sel = window.getSelection();
  const selectedText = sel ? sel.toString() : '';

  if (typeof Swal !== 'undefined') {
    const { value: url } = await getPrixmaSwal().fire({
      title: '<i class="fa-solid fa-link" style="color:var(--primary);"></i> Insertar Enlace',
      input: 'url',
      inputLabel: selectedText ? `Enlace para: "${selectedText}"` : 'Dirección Web (URL)',
      inputPlaceholder: 'https://ejemplo.com/recurso',
      showCancelButton: true,
      confirmButtonText: 'Insertar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b'
    });

    if (url) {
      if (selectedText) {
        execEditorCommand('createLink', url);
      } else {
        document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a> `);
      }
    }
  } else {
    const url = prompt('Ingresa la URL del enlace:');
    if (url) execEditorCommand('createLink', url);
  }
}

/**
 * Inserta o convierte en bloque de código directamente dentro del editor
 * sin ventanas de prompt emergentes.
 */
export function insertCodeBlock() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    execEditorCommand('formatBlock', '<pre>');
    return;
  }

  const range = sel.getRangeAt(0);

  // Si el usuario tiene texto seleccionado en el editor, envolverlo en <pre class="code-block"><code>...</code></pre>
  if (!sel.isCollapsed) {
    const selectedText = sel.toString();
    const escaped = selectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const codeHtml = `<pre class="code-block"><code>${escaped}</code></pre><p><br></p>`;
    document.execCommand('insertHTML', false, codeHtml);
    return;
  }

  // Si el cursor está en una posición vacía o dentro de una línea, insertar un bloque interactivo listo para escribir
  const pre = document.createElement('pre');
  pre.className = 'code-block';
  const code = document.createElement('code');
  code.innerHTML = '&#8203;'; // Zero-width space para colocar el cursor de inmediato
  pre.appendChild(code);

  range.deleteContents();
  range.insertNode(pre);

  // Añadir un párrafo después para permitir salir del bloque al continuar escribiendo
  const p = document.createElement('p');
  p.innerHTML = '<br>';
  if (pre.nextSibling) {
    pre.parentNode.insertBefore(p, pre.nextSibling);
  } else {
    pre.parentNode.appendChild(p);
  }

  // Colocar el foco/cursor dentro del bloque de código
  const newRange = document.createRange();
  newRange.selectNodeContents(code);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Aplica formato de código en línea directamente en el texto del editor.
 */
export function formatInlineCode() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);

  // Si hay texto seleccionado, transformarlo en <code>
  if (!sel.isCollapsed) {
    const selectedText = sel.toString();
    const escaped = selectedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    document.execCommand('insertHTML', false, `<code>${escaped}</code>`);
    return;
  }

  // Si no hay texto seleccionado, insertar una etiqueta <code> y poner el cursor dentro
  const code = document.createElement('code');
  code.innerHTML = '&#8203;';
  range.insertNode(code);

  const newRange = document.createRange();
  newRange.selectNodeContents(code);
  newRange.collapse(false);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Sincroniza el contenido del editor con el textarea oculto.
 */
export function syncEditorToTextarea(editorEl, textareaEl) {
  if (!editorEl || !textareaEl) return;
  const rawHtml = editorEl.innerHTML;
  const cleaned = cleanAndSanitizeHtml(rawHtml);
  textareaEl.value = cleaned;
}

/**
 * Carga contenido HTML en un editor editable y su respectivo textarea.
 */
export function setEditorContent(editorId, textareaId, content) {
  const editorEl = document.getElementById(editorId);
  const textareaEl = document.getElementById(textareaId);
  const cleaned = cleanAndSanitizeHtml(content || '');

  if (editorEl) {
    editorEl.innerHTML = cleaned;
  }
  if (textareaEl) {
    textareaEl.value = cleaned;
  }
}

/**
 * Inicializa un editor HTML WYSIWYG conectando el editor visual con el textarea.
 */
export function initHtmlEditor(editorId, textareaId) {
  const editorEl = document.getElementById(editorId);
  const textareaEl = document.getElementById(textareaId);
  if (!editorEl || !textareaEl) return;

  // Cargar valor inicial si el textarea ya tiene contenido
  if (textareaEl.value && !editorEl.innerHTML) {
    editorEl.innerHTML = cleanAndSanitizeHtml(textareaEl.value);
  }

  if (!editorEl.dataset.editorBound) {
    editorEl.dataset.editorBound = 'true';

    // Sincronización en tiempo real
    editorEl.addEventListener('input', () => {
      syncEditorToTextarea(editorEl, textareaEl);
      // Disparar evento change en el textarea para observadores
      textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
      textareaEl.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Manejo de pegado (Paste): limpiar HTML que venga de Word, páginas web, etc.
    editorEl.addEventListener('paste', (e) => {
      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const htmlData = clipboardData.getData('text/html');
      const textData = clipboardData.getData('text/plain');

      if (htmlData) {
        const cleaned = cleanAndSanitizeHtml(htmlData);
        document.execCommand('insertHTML', false, cleaned);
      } else if (textData) {
        document.execCommand('insertText', false, textData);
      }
      syncEditorToTextarea(editorEl, textareaEl);
    });
  }
}

