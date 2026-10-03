/* ==========================================================================
   Layout — sistema unificado de DRAG + RESIZE + GRID + STORAGE.

   Um único módulo usado por: input de busca, widgets (notas/tarefas/etc.)
   e atalhos da área principal. Posições são salvas em px e re-limitadas
   ao viewport ao carregar / redimensionar a janela.
   ========================================================================== */

const Layout = (() => {
  "use strict";

  const GRID = 24; // tamanho da célula do grid (px)

  const snap = (v) => Math.round(v / GRID) * GRID;

  /* ---------- Overlay do grid (visível só durante arraste/resize) ---------- */
  let overlay = null;
  let activeCount = 0;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "grid-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const size = `background-size:${GRID}px ${GRID}px;`;
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:4;pointer-events:none;opacity:0;" +
      "transition:opacity .18s ease;" +
      "background-image:linear-gradient(rgba(255,255,255,.28) 1px,transparent 1px)," +
      "linear-gradient(90deg,rgba(255,255,255,.28) 1px,transparent 1px);" + size;
    document.body.appendChild(overlay);
    return overlay;
  }

  function showOverlay() {
    activeCount++;
    const o = ensureOverlay();
    o.style.opacity = "1";
  }

  function hideOverlay() {
    activeCount = Math.max(0, activeCount - 1);
    if (activeCount === 0 && overlay) overlay.style.opacity = "0";
  }

  /* ---------- Utilidades de geometria ---------- */
  function clampRect(x, y, w, h) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    w = Math.min(w, vw);
    h = Math.min(h, vh);
    x = Math.min(Math.max(x, 0), Math.max(0, vw - w));
    y = Math.min(Math.max(y, 0), Math.max(0, vh - h));
    return { x, y, w, h };
  }

  function applyRect(el, r) {
    el.style.right = "auto";
    el.style.left = Math.round(r.x) + "px";
    el.style.top = Math.round(r.y) + "px";
    if (r.w != null) el.style.width = Math.round(r.w) + "px";
    if (r.h != null) el.style.height = Math.round(r.h) + "px";
  }

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height)
    };
  }

  /* ---------- Torna um elemento movível/redimensionável ----------
     opts:
       resizable   — cria a alça de resize (canto inferior direito)
       minW/minH   — tamanhos mínimos
       noSnap      — não alinha ao grid (ex.: busca pode querer largura livre)
       onSave(rect)— chamado ao soltar; responsável por persistir
     Arraste/resize só acontecem com body.editing ativo. */
  function manage(el, opts) {
    opts = opts || {};
    let handle = null;
    if (opts.resizable) {
      handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.setAttribute("aria-hidden", "true");
      el.appendChild(handle);
    }

    let mode = null; // 'move' | 'resize'
    let sx, sy, ox, oy, ow, oh;
    let moved = false;

    /* Suprime o click que o navegador dispara logo após soltar um arraste:
       evita alternar checkbox/apagar tarefa/abrir algo ao terminar um drag. */
    function suppressNextClick() {
      const stop = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener("click", stop, true);
      setTimeout(() => el.removeEventListener("click", stop, true), 100);
    }

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (!document.body.classList.contains("editing")) return;

      if (handle && e.target === handle) {
        mode = "resize";
      } else if (
        /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) ||
        e.target.closest(".no-drag")
      ) {
        return; // áreas interativas não iniciam arraste
      } else {
        mode = "move";
      }

      const r = el.getBoundingClientRect();
      ox = r.left; oy = r.top; ow = r.width; oh = r.height;
      sx = e.clientX; sy = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      moved = false;
      el.classList.add("dragging");
      showOverlay();
      e.preventDefault();
    });

    el.addEventListener("pointermove", (e) => {
      if (!mode) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 3) moved = true;
      if (mode === "resize") {
        let w = opts.noSnap ? ow + dx : snap(ow + dx);
        let h = opts.noSnap ? oh + dy : snap(oh + dy);
        w = Math.max(opts.minW || 120, w);
        h = Math.max(opts.minH || 60, h);
        const c = clampRect(ox, oy, w, h);
        applyRect(el, { x: ox, y: oy, w: c.w, h: c.h });
      } else {
        const x = opts.noSnap ? ox + dx : snap(ox + dx);
        const y = opts.noSnap ? oy + dy : snap(oy + dy);
        const c = clampRect(x, y, ow, oh);
        applyRect(el, { x: c.x, y: c.y, w: ow, h: oh });
      }
    });

    const end = () => {
      if (!mode) return;
      mode = null;
      el.classList.remove("dragging");
      hideOverlay();
      if (moved) suppressNextClick();
      if (typeof opts.onSave === "function") opts.onSave(rectOf(el));
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  return { GRID, snap, clampRect, applyRect, rectOf, manage };
})();
