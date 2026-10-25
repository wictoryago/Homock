/* ==========================================================================
   App — nova aba: busca (Brave Search), dock com magnificação real,
   widgets (tarefas/notas/hábitos/calendário), atalhos na área principal,
   wallpaper e tema. Persistência 100% local via chrome.storage.local.
   ========================================================================== */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  /* ============================ Store local ============================ */
  const DEFAULTS = {
    wallpaper: "assets/wallpapers/1.jpg", // caminho local, URL ou dataURL
    theme: "auto",
    clockFont: "modern",                  // fonte do relógio (ver CLOCK_FONTS)
    widgets: { clock: true, todo: true, notes: true, habits: false, calendar: true, countdown: true, daybar: true },
    layout: {},                           // { id: {x, y, w, h} } em px
    dock: [
      { name: "YouTube", url: "https://www.youtube.com",  icon: "" },
      { name: "Gmail",   url: "https://mail.google.com",  icon: "" },
      { name: "GitHub",  url: "https://github.com",       icon: "" },
      { name: "ChatGPT", url: "https://chat.openai.com",  icon: "" },
      { name: "Reddit",  url: "https://www.reddit.com",   icon: "" }
    ],
    dockPosition: "bottom",               // "bottom" | "left" | "right"
    shortcuts: [],                        // { id, name, url, icon, x, y }
    todos: [],
    notes: "",
    habits: [],
    countdown: null                         // { name, date: "AAAA-MM-DD" }
  };

  const Store = {
    data: null,
    async load() {
      let raw = {};
      try {
        raw = await chrome.storage.local.get("newtabState");
        raw = raw.newtabState || {};
      } catch (e) {
        // fallback (ex.: abrir o HTML direto do disco)
        try { raw = JSON.parse(localStorage.getItem("newtabState") || "{}"); } catch (_) {}
      }
      this.data = Object.assign({}, DEFAULTS, raw);
      this.data.widgets = Object.assign({}, DEFAULTS.widgets, raw.widgets || {});
      this.data.layout = Object.assign({}, raw.layout || {});
      this.data.dock = Array.isArray(raw.dock) && raw.dock.length ? raw.dock : DEFAULTS.dock.map(d => ({ ...d }));
      this.data.shortcuts = Array.isArray(raw.shortcuts) ? raw.shortcuts : [];
      // migração: 3.png foi otimizado para 3.jpg
      if (this.data.wallpaper === "assets/wallpapers/3.png")
        this.data.wallpaper = "assets/wallpapers/3.jpg";
      return this.data;
    },
    save() {
      try {
        const p = chrome.storage.local.set({ newtabState: this.data });
        if (p && p.catch) p.catch(() => {}); // evita promise rejeitada (ex.: cota)
      }
      catch (e) {
        try { localStorage.setItem("newtabState", JSON.stringify(this.data)); }
        catch (_) {}
      }
    }
  };

  const saveLayout = (id) => (rect) => {
    Store.data.layout[id] = rect;
    Store.save();
  };

  /* ============================ Tema ============================ */
  function applyTheme() {
    if (!Store.data) return; // listener pode disparar antes do Store.load()
    const t = Store.data.theme;
    const dark = t === "dark" ||
      (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("theme-dark", dark);
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  /* ============================ Relógio ============================ */
  // formatter criado UMA vez (antes era instanciado a cada tick — a cada 5s)
  const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  let lastClockText = "";
  function tickClock() {
    // relógio desativado: não gasta CPU atualizando DOM oculto
    if (Store.data && Store.data.widgets.clock === false) return;
    const now = new Date();
    const hhmm =
      String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    if (hhmm === lastClockText) return; // só escreve no DOM quando o minuto muda
    lastClockText = hhmm;
    $("#clock").textContent = hhmm;
    $("#date").textContent = dateFmt.format(now);
  }
  tickClock(); // pintura imediata (não espera o primeiro intervalo)
  setInterval(tickClock, 2000);

  /* ---- Relógio como componente movível/redimensionável ---- */
  function defaultClockRect() {
    const vw = window.innerWidth;
    const w = Layout.snap(560);
    return Layout.clampRect((vw - w) / 2, Math.round(window.innerHeight * 0.09), w, 144);
  }

  function initClock() {
    const el = $("#hero");
    const visible = Store.data.widgets.clock !== false;
    el.style.display = visible ? "" : "none";
    if (!visible) return;
    const saved = Store.data.layout.clock;
    const r = saved || defaultClockRect();
    const rect = Layout.clampRect(r.x, r.y, r.w, r.h);
    Layout.applyRect(el, rect);
    el.style.marginLeft = "0"; // posição passa a ser controlada por left/top
  }

  Layout.manage($("#hero"), {
    resizable: true,
    minW: 216,
    minH: 72,
    onSave: saveLayout("clock")
  });

  /* ---- Fonte do relógio ---- */
  const CLOCK_FONTS = [
    { id: "modern", name: "Moderno",      cls: "hf-modern" },
    { id: "thin",   name: "Fino",         cls: "hf-thin" },
    { id: "serif",  name: "Elegante",     cls: "hf-serif" },
    { id: "mono",   name: "Monoespaçada", cls: "hf-mono" },
    { id: "bold",   name: "Pesada",       cls: "hf-bold" },
    { id: "cond",   name: "Condensada",   cls: "hf-cond" }
  ];

  function applyClockFont() {
    const hero = $("#hero");
    const cur = Store.data.clockFont || "modern";
    CLOCK_FONTS.forEach((f) => hero.classList.remove(f.cls));
    const sel = CLOCK_FONTS.find((f) => f.id === cur) || CLOCK_FONTS[0];
    hero.classList.add(sel.cls);
  }

  function buildClockFontRow() {
    const row = $("#clock-font-row");
    row.innerHTML = "";
    const cur = Store.data.clockFont || "modern";
    CLOCK_FONTS.forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "font-opt fs-" + f.id + (f.id === cur ? " selected" : "");
      b.innerHTML = `<span class="sample">12:34</span><span class="fname"></span>`;
      b.querySelector(".fname").textContent = f.name;
      b.onclick = () => {
        Store.data.clockFont = f.id;
        Store.save();
        applyClockFont();
        buildClockFontRow();
      };
      row.appendChild(b);
    });
  }

  /* ============================ Busca — Brave ============================
     Caminho mínimo: Enter → ler valor → montar URL → navegar.
     Sem storage, timers ou processamento pesado antes da navegação. */
  const BRAVE_SEARCH = "https://search.brave.com/search?q=";
  const searchInput = $("#search-input"); // referência cacheada
  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;
    const isUrl = /^https?:\/\/\S+$/.test(q) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q);
    const target = isUrl ? (q.startsWith("http") ? q : "https://" + q)
                         : BRAVE_SEARCH + encodeURIComponent(q);
    window.location.href = target;
  });

  /* foco no campo ao pressionar qualquer tecla "digitável" fora de inputs */
  document.addEventListener("keydown", (e) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) &&
        !document.querySelector(".modal-overlay:not(.hidden)")) { // não rouba foco de modais abertos
      searchInput.focus();
    }
  });

  function defaultSearchRect() {
    const vw = window.innerWidth;
    const w = Layout.snap(Math.min(620, vw * 0.86));
    const clockH = Math.min(Math.max(110, vw * 0.13), 170);
    const y = Layout.snap(Math.round(window.innerHeight * 0.09 + clockH));
    return Layout.clampRect((vw - w) / 2, y, w, 52);
  }

  function initSearch() {
    const el = $("#search-section");
    const saved = Store.data.layout.search;
    const r = saved || defaultSearchRect();
    const rect = Layout.clampRect(r.x, r.y, r.w, r.h);
    Layout.applyRect(el, rect);
    Layout.manage(el, {
      resizable: true,
      minW: 280,
      minH: 48,
      onSave: saveLayout("search")
    });
  }

  /* ============================ Imagens → dataURL (crop/cover) =========== */
  function imageFileToDataURL(file, size, mime, quality) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = reject;
      rd.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          if (size) {
            // corte quadrado central (cover) — ícones
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext("2d");
            const s = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
            resolve(canvas.toDataURL("image/png"));
          } else {
            // wallpaper: limita largura p/ não estourar o storage
            const maxW = 1920;
            const esc = Math.min(1, maxW / img.width);
            canvas.width = Math.round(img.width * esc);
            canvas.height = Math.round(img.height * esc);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL(mime || "image/jpeg", quality || 0.85));
          }
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

  function pickImageFile(cb) {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
    inp.click();
  }

  /* ============================ Wallpaper ============================ */
  const LOCAL_WALLPAPERS = ["1.jpg","2.jpg","3.jpg","4.jpg","5.jpg","6.jpg","7.jpg","8.jpg","9.jpg"]
    .map((f) => "assets/wallpapers/" + f);

  function applyWallpaper() {
    const wp = Store.data.wallpaper;
    const el = $("#wallpaper");
    if (wp && wp !== "none") el.style.backgroundImage = `url("${wp}")`;
    else el.style.backgroundImage = "none";
  }

  function buildWallpaperGrid() {
    const grid = $("#wallpaper-grid");
    grid.innerHTML = "";

    const none = document.createElement("div");
    none.className = "wp-thumb custom";
    none.textContent = "∅";
    none.title = "Sem imagem";
    none.onclick = () => pickWallpaper("none");
    grid.appendChild(none);

    LOCAL_WALLPAPERS.forEach((src) => {
      const t = document.createElement("div");
      t.className = "wp-thumb";
      t.style.backgroundImage = `url("${src}")`;
      t.onclick = () => pickWallpaper(src);
      grid.appendChild(t);
    });

    const custom = document.createElement("div");
    custom.className = "wp-thumb custom";
    custom.textContent = "+";
    custom.title = "Enviar imagem do computador";
    custom.onclick = () => {
      pickImageFile(async (f) => {
        pickWallpaper(await imageFileToDataURL(f));
      });
    };
    grid.appendChild(custom);
    markSelectedWallpaper();
  }

  function pickWallpaper(src) {
    Store.data.wallpaper = src;
    Store.save();
    applyWallpaper();
    markSelectedWallpaper();
  }

  function markSelectedWallpaper() {
    const cur = Store.data.wallpaper;
    document.querySelectorAll(".wp-thumb").forEach((t, i) => {
      let src;
      if (i === 0) src = "none";
      else if (i <= LOCAL_WALLPAPERS.length) src = LOCAL_WALLPAPERS[i - 1];
      else src = "data:";
      t.classList.toggle("selected", cur === src || (src === "data:" && cur.startsWith("data:")));
    });
  }

  /* ============================ Ícones da dock ============================ */
  const TILE_COLORS = ["#0a84ff","#bf5af2","#ff375f","#ff9f0a","#30d158","#64d2ff","#ffd60a","#ac8e68"];

  function faviconUrl(url) {
    try {
      return chrome.runtime.getURL("/_favicon/?pageUrl=" + encodeURIComponent(url) + "&size=64");
    } catch (e) { return null; }
  }

  function tileColor(name) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TILE_COLORS[h % TILE_COLORS.length];
  }

  /* Monta o conteúdo visual de um "tile" de ícone (dock ou atalho) */
  function fillIcon(iconEl, site) {
    iconEl.textContent = "";
    iconEl.style.backgroundImage = "";
    if (site.icon) {
      const img = document.createElement("img");
      img.className = "icon-img";
      img.src = site.icon;
      img.alt = "";
      img.draggable = false;
      img.decoding = "async"; // decodificação fora do caminho crítico de render
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        site.icon = "";
        iconEl.style.background = ""; // limpa o fundo branco antes do fallback
        fillIcon(iconEl, site);
      };
      iconEl.style.background = "rgba(255,255,255,0.92)";
      iconEl.appendChild(img);
      return;
    }
    const fv = faviconUrl(site.url);
    if (fv) {
      const img = document.createElement("img");
      img.src = fv;
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.onerror = () => {
        // fallback final: tile colorido com a inicial (evita letra branca sobre fundo claro)
        img.remove();
        iconEl.style.background = tileColor(site.name);
        iconEl.textContent = site.name.charAt(0).toUpperCase();
      };
      iconEl.style.background = "rgba(255,255,255,0.92)";
      iconEl.appendChild(img);
    } else {
      iconEl.style.background = tileColor(site.name);
      iconEl.textContent = site.name.charAt(0).toUpperCase();
    }
  }

  /* ============================ Dock ============================ */
  let suppressDockClick = false;

  /* Aplica a posição da dock ("bottom" | "left" | "right"):
     - alterna as classes body.dock-bottom / dock-left / dock-right
       (CSS muda posição fixa e flex-direction para vertical nas laterais);
     - avisa o Dock (js/dock.js) para trocar o eixo da magnificação. */
  function applyDockPosition() {
    const pos = Store.data.dockPosition || "bottom";
    document.body.classList.remove("dock-bottom", "dock-left", "dock-right");
    document.body.classList.add("dock-" + pos);
    // Dock é um binding léxico global (const em dock.js), NÃO window.Dock
    if (typeof Dock !== "undefined") Dock.setPosition(pos);
  }

  function syncDockPosRadios() {
    const cur = Store.data.dockPosition || "bottom";
    document.querySelectorAll('input[name="dock-pos"]').forEach((r) => {
      r.checked = r.value === cur;
    });
  }

  function renderDock() {
    const dock = $("#dock");
    dock.innerHTML = "";
    Store.data.dock.forEach((site, i) => {
      const item = document.createElement("button");
      item.className = "dock-item";
      item.dataset.idx = i;
      item.setAttribute("aria-label", site.name);

      const icon = document.createElement("div");
      icon.className = "icon";
      fillIcon(icon, site);

      // O nome NÃO é exibido ao passar o mouse (sem tooltip na dock).
      // Ele continua salvo em Store.data.dock e aparece no modal de edição.
      item.appendChild(icon);
      item.addEventListener("click", () => {
        if (suppressDockClick) return;
        if (document.body.classList.contains("editing")) openDockModal(i);
        else window.location.href = site.url;
      });
      item.addEventListener("pointerdown", (e) => dockPointerDown(e, i, item));
      dock.appendChild(item);
    });

    const add = document.createElement("button");
    add.className = "dock-add";
    add.textContent = "+";
    add.title = "Adicionar atalho";
    add.onclick = () => openDockModal(-1);
    dock.appendChild(add);

    if (typeof Dock !== "undefined") Dock.refresh();
  }

  /* Arrastar na dock:
     - modo edição + movimento horizontal → reordena ao vivo;
     - sair da dock para cima → cria atalho na área principal;
     - sem movimento → clique normal (abrir site / abrir modal). */
  function dockPointerDown(e, index, item) {
    if (e.button !== 0) return;
    const editing = document.body.classList.contains("editing");
    const startX = e.clientX;
    const startY = e.clientY;
    let mode = null; // null | 'reorder' | 'spawn'
    let ghost = null;

    const site = () => Store.data.dock[Number(item.dataset.idx)];
    // lido UMA vez por arraste: o rect do wrap é estável durante o gesto
    // (antes eram 2 getBoundingClientRect por pointermove)
    const wrapRect = $("#dock-wrap").getBoundingClientRect();
    // orientação da dock: bottom → reordena no eixo X / spawns p/ cima;
    // laterais → reordena no eixo Y / spawns "para dentro" da tela
    const pos = Store.data.dockPosition || "bottom";
    const vert = pos !== "bottom";
    const outside = (ev) =>
      pos === "bottom" ? ev.clientY < wrapRect.top - 8 :
      pos === "left"   ? ev.clientX > wrapRect.right + 8 :
                         ev.clientX < wrapRect.left - 8;

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!mode) {
        if (Math.hypot(dx, dy) < 7) return;
        if (outside(ev)) mode = "spawn";
        else mode = editing ? "reorder" : "spawn";
      }

      if (mode === "spawn" && outside(ev)) {
        if (!ghost) {
          ghost = document.createElement("div");
          ghost.className = "spawn-ghost";
          const ic = document.createElement("div");
          ic.className = "icon";
          fillIcon(ic, site());
          ghost.appendChild(ic);
          document.body.appendChild(ghost);
        }
        ghost.style.left = ev.clientX - 28 + "px";
        ghost.style.top = ev.clientY - 28 + "px";
      } else if (mode === "reorder") {
        // reordenação ao lado dos irmãos com base na posição do cursor
        const dock = $("#dock");
        const sibs = Array.from(dock.querySelectorAll(".dock-item"));
        const others = sibs.filter((s) => s !== item);
        let ref = null;
        const coord = vert ? ev.clientY : ev.clientX;
        for (const s of others) {
          const r = s.getBoundingClientRect();
          const mid = vert ? r.top + r.height / 2 : r.left + r.width / 2;
          if (coord < mid) { ref = s; break; }
        }
        // só toca no DOM quando a posição realmente muda (evita refresh por pixel)
        const anchor = ref || dock.querySelector(".dock-add");
        if (anchor && item.nextElementSibling !== anchor) {
          dock.insertBefore(item, anchor);
          Dock.refresh();
        }
        item.classList.add("reordering");
      } else if (ghost) {
        ghost.remove();
        ghost = null;
        mode = editing ? "reorder" : null;
      }
    }

    function finish(ev, cancelled) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      item.classList.remove("reordering");

      if (!mode) return; // clique normal segue o handler de click

      suppressDockClick = true;
      setTimeout(() => { suppressDockClick = false; }, 120);

      if (mode === "spawn" && !cancelled && ghost) {
        // cria atalho na área principal; item original permanece na dock
        const ghostRect = ghost.getBoundingClientRect();
        const c = Layout.clampRect(
          Layout.snap(ghostRect.left),
          Layout.snap(ghostRect.top),
          76, 76
        );
        const s = site();
        Store.data.shortcuts.push({
          id: "sc" + Date.now(),
          name: s.name,
          url: s.url,
          icon: s.icon || "",
          x: c.x, y: c.y
        });
        Store.save();
        renderShortcuts();
      }
      if (ghost) { ghost.remove(); ghost = null; }

      if (mode === "reorder" || (mode === "spawn" && editing)) {
        // persiste a nova ordem lendo o DOM
        const dock = $("#dock");
        const order = Array.from(dock.querySelectorAll(".dock-item"))
          .map((el) => Store.data.dock[Number(el.dataset.idx)]);
        Store.data.dock = order;
        Store.save();
      }
      renderDock();
    }

    const onUp = (ev) => finish(ev, false);
    const onCancel = (ev) => finish(ev, true);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  /* ---- modal de atalho da dock ---- */
  let editingIndex = -1;
  let editingIcon = ""; // URL ou dataURL do ícone escolhido no modal

  function updateIconPreview() {
    const pv = $("#dock-icon-preview");
    pv.textContent = "";
    if (editingIcon) {
      const img = document.createElement("img");
      img.src = editingIcon;
      img.alt = "";
      pv.appendChild(img);
    } else {
      pv.textContent = "?";
    }
  }

  function openDockModal(index) {
    editingIndex = index;
    const isNew = index < 0;
    $("#dock-modal-title").textContent = isNew ? "Adicionar atalho" : "Editar atalho";
    $("#dock-delete").classList.toggle("hidden", isNew);
    $("#dock-name").value = isNew ? "" : Store.data.dock[index].name;
    $("#dock-url").value = isNew ? "" : Store.data.dock[index].url;
    $("#dock-icon-url").value = isNew ? "" : (Store.data.dock[index].icon || "");
    editingIcon = isNew ? "" : (Store.data.dock[index].icon || "");
    updateIconPreview();
    $("#dock-modal").classList.remove("hidden");
    $("#dock-name").focus();
  }
  function closeDockModal() { $("#dock-modal").classList.add("hidden"); }

  $("#dock-cancel").onclick = closeDockModal;
  $("#dock-icon-url").addEventListener("input", (e) => {
    editingIcon = e.target.value.trim();
    updateIconPreview();
  });
  $("#dock-icon-file").onclick = () => {
    pickImageFile(async (f) => {
      editingIcon = await imageFileToDataURL(f, 128);
      $("#dock-icon-url").value = ""; // dataURL ganha do campo de URL
      updateIconPreview();
    });
  };
  $("#dock-save").onclick = () => {
    const name = $("#dock-name").value.trim();
    let url = $("#dock-url").value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    const icon = editingIcon || "";
    if (editingIndex < 0) Store.data.dock.push({ name, url, icon });
    else Store.data.dock[editingIndex] = { name, url, icon };
    Store.save(); renderDock(); closeDockModal();
  };
  $("#dock-delete").onclick = () => {
    Store.data.dock.splice(editingIndex, 1);
    Store.save(); renderDock(); closeDockModal();
  };
  $("#dock-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeDockModal();
  });

  /* ============================ Atalhos na área principal ============================ */
  function renderShortcuts() {
    document.querySelectorAll(".shortcut").forEach((s) => s.remove());
    Store.data.shortcuts.forEach((sc) => {
      const el = document.createElement("div");
      el.className = "shortcut";
      el.dataset.id = sc.id;

      const icon = document.createElement("div");
      icon.className = "icon";
      fillIcon(icon, sc);

      const label = document.createElement("span");
      label.className = "shortcut-label";
      label.textContent = sc.name;

      const rm = document.createElement("button");
      rm.className = "shortcut-remove no-drag";
      rm.textContent = "×";
      rm.title = "Remover atalho";
      rm.onclick = () => {
        Store.data.shortcuts = Store.data.shortcuts.filter((s) => s.id !== sc.id);
        Store.save();
        renderShortcuts();
      };

      el.appendChild(icon);
      el.appendChild(label);
      el.appendChild(rm);
      Layout.applyRect(el, Layout.clampRect(sc.x, sc.y, 76, 80));

      el.addEventListener("click", () => {
        if (document.body.classList.contains("editing")) return;
        window.location.href = sc.url;
      });

      Layout.manage(el, {
        resizable: false,
        onSave: (rect) => { sc.x = rect.x; sc.y = rect.y; Store.save(); }
      });

      $("#widget-canvas").appendChild(el);
    });
  }

  /* ============================ Widgets ============================ */
  function defaultWidgetRect(def) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = def.defaultPos.x * vw;
    let y = def.defaultPos.y * vh;
    const w = def.defaultSize.w;
    const h = def.defaultSize.h;
    if (def.defaultPos.right) x -= w; // posição ancorada à direita
    return Layout.clampRect(Layout.snap(x), Layout.snap(y), w, h);
  }

  function renderWidgets() {
    const canvas = $("#widget-canvas");
    canvas.querySelectorAll(".widget").forEach((w) => w.remove());
    const ctx = { data: Store.data, save: () => Store.save() };

    Widgets.DEFS.forEach((def) => {
      if (!Store.data.widgets[def.id]) return;
      const el = document.createElement("div");
      el.className = "widget glass-card-widget";
      el.dataset.widgetId = def.id;

      const saved = Store.data.layout["widget:" + def.id];
      const rect = saved
        ? Layout.clampRect(saved.x, saved.y, saved.w, saved.h)
        : defaultWidgetRect(def);
      Layout.applyRect(el, rect);

      def.render(el, ctx);
      Layout.manage(el, {
        resizable: true,
        minW: def.minW || 200,
        minH: def.minH || 120,
        onSave: saveLayout("widget:" + def.id)
      });
      canvas.appendChild(el);
    });
  }

  /* Ícones SVG simples do painel (stroke currentColor) */
  const WT_ICONS = {
    clock:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>',
    todo:     '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    notes:    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    habits:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    countdown:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2h12M6 22h12M8 2c0 4 8 6 8 10s-8 6-8 10M16 2c0 4-8 6-8 10s8 6 8 10"/></svg>',
    daybar:   '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="15" y2="12"/><line x1="4" y1="17" x2="18" y2="17"/></svg>'
  };

  function buildWidgetToggles() {
    const box = $("#widget-toggles");
    box.innerHTML = "";
    const defs = [
      { id: "clock", name: "Relógio", desc: "Hora e data" },
      ...Widgets.DEFS.map((d) => ({ id: d.id, name: d.name, desc: d.desc || "" }))
    ];
    defs.forEach((def) => {
      const card = document.createElement("label");
      card.className = "wt-card";
      card.innerHTML =
        `<span class="wt-icon">${WT_ICONS[def.id] || WT_ICONS.habits}</span>` +
        `<span class="wt-info"><span class="wt-name"></span>` +
        `<span class="wt-desc"></span></span>`;
      card.querySelector(".wt-name").textContent = def.name;
      card.querySelector(".wt-desc").textContent = def.desc;
      const sw = document.createElement("input");
      sw.type = "checkbox";
      sw.className = "wt-switch";
      sw.checked = Store.data.widgets[def.id] !== false;
      sw.onchange = () => {
        Store.data.widgets[def.id] = sw.checked;
        Store.save();
        if (def.id === "clock") initClock();
        else renderWidgets();
      };
      card.appendChild(sw);
      box.appendChild(card);
    });
  }

  /* ============================ Redimensionamento da janela ============================ */
  let rszT;
  window.addEventListener("resize", () => {
    clearTimeout(rszT);
    rszT = setTimeout(() => {
      // re-limita tudo ao novo viewport e persiste
      const search = $("#search-section");
      const r = Layout.clampRect(...(() => {
        const s = Layout.rectOf(search);
        return [s.x, s.y, s.w, s.h];
      })());
      Layout.applyRect(search, r);
      Store.data.layout.search = r;

      if (Store.data.widgets.clock !== false) {
        const hero = $("#hero");
        const hr = Layout.rectOf(hero);
        const hc = Layout.clampRect(hr.x, hr.y, hr.w, hr.h);
        Layout.applyRect(hero, hc);
        Store.data.layout.clock = hc;
      }

      document.querySelectorAll(".widget").forEach((el) => {
        const id = "widget:" + el.dataset.widgetId;
        const c = Layout.clampRect(...Object.values(Layout.rectOf(el)));
        Layout.applyRect(el, c);
        Store.data.layout[id] = c;
      });
      document.querySelectorAll(".shortcut").forEach((el) => {
        const sc = Store.data.shortcuts.find((s) => s.id === el.dataset.id);
        if (!sc) return;
        const c = Layout.clampRect(...Object.values(Layout.rectOf(el)));
        Layout.applyRect(el, c);
        sc.x = c.x; sc.y = c.y;
      });
      Store.save();
    }, 150);
  });

  /* ============================ Modo de edição / Settings ============================ */
  $("#btn-edit").onclick = () => {
    const on = document.body.classList.toggle("editing");
    $("#btn-edit").classList.toggle("active", on);
  };

  $("#btn-settings").onclick = () => {
    $("#theme-select").value = Store.data.theme;
    $("#wallpaper-url").value =
      /^https?:\/\//.test(Store.data.wallpaper || "") ? Store.data.wallpaper : "";
    buildWallpaperGrid();
    buildWidgetToggles();
    buildClockFontRow();
    syncDockPosRadios();
    $("#settings-modal").classList.remove("hidden");
  };
  $("#theme-select").addEventListener("change", (e) => {
    Store.data.theme = e.target.value;
    Store.save();
    applyTheme();
  });
  $("#wallpaper-url-apply").onclick = () => {
    const url = $("#wallpaper-url").value.trim();
    if (url) pickWallpaper(url);
  };
  /* Posição da dock: aplica imediatamente e persiste */
  document.querySelectorAll('input[name="dock-pos"]').forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      Store.data.dockPosition = r.value;
      Store.save();
      applyDockPosition();
    });
  });
  $("#settings-close").onclick = () => $("#settings-modal").classList.add("hidden");
  $("#settings-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.add("hidden");
  });

  /* ============================ Init ============================ */
  async function init() {
    await Store.load();
    applyTheme();
    applyWallpaper();
    applyClockFont();
    initClock();
    buildClockFontRow();
    initSearch();
    applyDockPosition();   // restaura a posição salva da dock
    renderDock();
    Dock.init($("#dock"));
    applyDockPosition();   // garante eixo/reset após os itens existirem
    renderWidgets();
    renderShortcuts();
    buildWallpaperGrid();
    buildWidgetToggles();
  }
  init();
})();

/* ==========================================================================
   Autocomplete & Google Lens (Drag and Drop)
   ========================================================================== */
(() => {
  const form = document.getElementById("search-form");
  const input = document.getElementById("search-input");
  const searchBox = document.getElementById("search-box"); // Referência à caixa visual
  
  // Container de sugestões
  const suggContainer = document.createElement("div");
  suggContainer.id = "search-suggestions";
  suggContainer.className = "hidden";
  form.appendChild(suggContainer);

  let debounceTimer;
  let currentFocus = -1;
  let originalQuery = "";

  // 1. Calcula o espaço para as Sugestões dinamicamente
  function updateSuggestionsLayout() {
    if (suggContainer.classList.contains("hidden")) return;
    
    const formRect = form.getBoundingClientRect();
    const wrap = document.getElementById("dock-wrap");
    const dockRect = wrap.getBoundingClientRect();
    const isDockBottom = document.body.classList.contains("dock-bottom");

    // Espaço padrão: barra de pesquisa até o fim da tela
    let availableHeight = window.innerHeight - formRect.bottom - 24; 
    
    // Se a dock estiver na base e acima do limite inferior da tela, respeita a dock
    if (isDockBottom && dockRect.top > formRect.bottom) {
      availableHeight = dockRect.top - formRect.bottom - 16;
    }

    // Altura mínima segura para evitar que o menu desapareça se a janela for muito baixa
    if (availableHeight < 110) availableHeight = 110;

    suggContainer.style.maxHeight = availableHeight + "px";
    suggContainer.style.overflowY = "auto";
  }

  // Recalcula se a janela ou a interface mudar de tamanho
  window.addEventListener("resize", updateSuggestionsLayout);

  async function fetchSuggestions(query) {
    try {
      const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      return data[1] || [];
    } catch (e) {
      return [];
    }
  }

  function closeSuggestions() {
    suggContainer.classList.add("hidden");
    currentFocus = -1;
  }

  function renderSuggestions(suggestions) {
    suggContainer.innerHTML = "";
    if (suggestions.length === 0) {
      closeSuggestions();
      return;
    }

    const iconSvg = `<span class="sugg-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>`;

    suggestions.forEach((sugg) => {
      const div = document.createElement("div");
      div.className = "sugg-item";
      div.innerHTML = `${iconSvg}<span>${sugg}</span>`;
      div.addEventListener("click", () => {
        input.value = sugg;
        closeSuggestions();
        document.getElementById("search-go").click();
      });
      suggContainer.appendChild(div);
    });
    
    suggContainer.classList.remove("hidden");
    updateSuggestionsLayout(); // Ajusta a altura após renderizar os novos itens
  }

  input.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    originalQuery = val;
    clearTimeout(debounceTimer);
    if (!val) { closeSuggestions(); return; }
    debounceTimer = setTimeout(async () => {
      renderSuggestions((await fetchSuggestions(val)).slice(0, 6));
    }, 150);
  });

  input.addEventListener("keydown", (e) => {
    const items = suggContainer.querySelectorAll(".sugg-item");
    if (items.length === 0 || suggContainer.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentFocus = (currentFocus + 1) % items.length;
      setActive(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentFocus = currentFocus - 1 < 0 ? items.length - 1 : currentFocus - 1;
      setActive(items);
    } else if (e.key === "Escape") {
      closeSuggestions();
    }
  });

  function setActive(items) {
    items.forEach(item => item.classList.remove("selected"));
    if (currentFocus > -1 && currentFocus < items.length) {
      items[currentFocus].classList.add("selected");
      input.value = items[currentFocus].innerText.trim();
    } else {
      input.value = originalQuery;
    }
  }

  document.addEventListener("click", (e) => {
    if (!form.contains(e.target)) closeSuggestions();
  });

  // 2. Google Lens — Eventos de Arraste e Upload
  searchBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      searchBox.classList.add("lens-drag-active");
    }
  });

  searchBox.addEventListener("dragleave", (e) => {
    e.preventDefault();
    searchBox.classList.remove("lens-drag-active");
  });

  searchBox.addEventListener("drop", (e) => {
    e.preventDefault();
    searchBox.classList.remove("lens-drag-active");

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    // Constrói um formulário fantasma em multipart/form-data (Padrão para envio de imagens web)
    const lensForm = document.createElement("form");
    lensForm.method = "POST";
    lensForm.action = "https://lens.google.com/upload";
    lensForm.enctype = "multipart/form-data";
    lensForm.target = "_blank"; // Abre o resultado em uma nova guia

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.name = "encoded_image"; // Endpoint do Lens exige este name

    // Passa o arquivo do DataTransfer do Drag&Drop para o Input file
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    lensForm.appendChild(fileInput);
    document.body.appendChild(lensForm);
    lensForm.submit();
    
    // Remove o formulário após enviar
    setTimeout(() => lensForm.remove(), 1000);
  });
})();
