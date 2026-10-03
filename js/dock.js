/* ==========================================================================
   Dock — magnificação estilo macOS / Plank (otimizada)

   Efeito: a escala de cada ícone depende da distância entre o cursor e o
   centro do ícone NO EIXO DA DOCK, com interpolação suave (lerp) via rAF.
   O loop rAF PARA sozinho quando tudo estabiliza (CPU zero em repouso).

   Orientação (Dock.setPosition):
   - "bottom"        → eixo X: cursor esquerda/direita amplia vizinhos;
     margens dinâmicas laterais + transform-origin: bottom center.
   - "left"/"right"  → eixo Y: cursor cima/baixo amplia vizinhos;
     margens dinâmicas verticais + transform-origin: left/right center
     (definido no CSS via body.dock-left / body.dock-right).

   Espaçamento: além do `transform: scale()`, cada item recebe margens
   dinâmicas de (escala-1)*BASE/2 no eixo da dock. A "pegada" de layout
   cresce junto com a escala, então os vizinhos se afastam e os ícones
   ampliados não se sobrepõem — sem aumentar o gap fixo no estado normal.

   Desempenho (sem layout thrashing):
   - os centros dos ícones NÃO são lidos do DOM a cada pointermove;
     como a dock é um flex de itens fixos, os centros são calculados
     analiticamente: PAD + Σ(BASE + 2*margem + GAP);
   - uma única leitura de rect (left/top do container) por movimento;
   - o frame() só escreve estilo quando o valor realmente mudou.
   ========================================================================== */

const Dock = (() => {
  "use strict";

  const BASE = 52;          // tamanho base do ícone (px)  — .dock-item
  const GAP = 10;           // gap do flex (px)             — .glass-dock
  const PAD_X = 14;         // padding horizontal (px)      — .glass-dock
  const PAD_Y = 10;         // padding vertical (px)        — .glass-dock
  const MAX_BOOST = 0.62;   // escala extra máxima no cursor (52 → ~84px)
  const RANGE = 110;        // alcance do efeito (px)
  const LERP = 0.22;        // suavização (0..1 por frame)

  let dockEl = null;
  let icons = [];           // elementos .dock-item
  let scales = [];          // escala atual de cada ícone
  let targets = [];         // escala alvo de cada ícone
  let lastMargin = [];      // última margem escrita (evita write redundante)
  let rafId = null;
  let hoverPos = null;      // posição do cursor no eixo da dock (null = fora)
  let vertical = false;     // false = bottom (eixo X) · true = laterais (eixo Y)

  function collect() {
    icons = Array.from(dockEl.querySelectorAll(".dock-item"));
    scales = icons.map((_, i) => scales[i] || 1);
    targets = icons.map((_, i) => targets[i] || 1);
    lastMargin = icons.map((_, i) => lastMargin[i] ?? -1);
  }

  /* Curva de falloff: 1 no centro, decai suavemente com a distância */
  function falloff(dist) {
    const d = dist / RANGE;
    if (d >= 1) return 0;
    return 0.5 * (1 + Math.cos(Math.PI * d)); // cosseno suavizado
  }

  function updateTargets() {
    if (hoverPos === null) {
      targets.fill(1);
      return;
    }
    // única leitura de DOM por movimento: origem do content-box da dock
    const rect = dockEl.getBoundingClientRect();
    let c = (vertical ? rect.top + PAD_Y : rect.left + PAD_X);
    for (let i = 0; i < icons.length; i++) {
      const mi = (scales[i] - 1) * BASE * 0.5; // margem atual do item (por lado)
      const center = c + mi + BASE / 2;
      targets[i] = 1 + MAX_BOOST * falloff(Math.abs(hoverPos - center));
      c += BASE + 2 * mi + GAP; // próximo item considera a margem atual
    }
  }

  function frame() {
    let settled = true;
    for (let i = 0; i < icons.length; i++) {
      const t = targets[i];
      let s = scales[i];
      if (s !== t) {
        s += (t - s) * LERP;
        if (Math.abs(t - s) < 0.002) s = t;
        else settled = false;
        scales[i] = s;
        icons[i].style.transform = `scale(${s.toFixed(3)})`;
        icons[i].style.zIndex = String(Math.round(s * 100));
      }
      // margem dinâmica NO EIXO DA DOCK — só escreve quando o valor mudou
      const m = Math.round((s - 1) * BASE * 5) / 10; // passos de 0.1px
      if (m !== lastMargin[i]) {
        lastMargin[i] = m;
        if (vertical) {
          icons[i].style.marginTop = m + "px";
          icons[i].style.marginBottom = m + "px";
        } else {
          icons[i].style.marginLeft = m + "px";
          icons[i].style.marginRight = m + "px";
        }
      }
    }
    rafId = settled ? null : requestAnimationFrame(frame);
  }

  function kick() {
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  function onMove(e) {
    hoverPos = vertical ? e.clientY : e.clientX;
    updateTargets();
    kick();
  }

  function onLeave() {
    hoverPos = null;
    targets.fill(1);
    kick();
  }

  /* Área de hover um pouco maior que a dock: inclui o espaço que os ícones
     ocupam ao ampliar, evitando flicker ao perseguir a "onda".
     - bottom: cresce para cima   → padding-top do wrap
     - left:   cresce p/ direita  → padding-right do wrap
     - right:  cresce p/ esquerda → padding-left do wrap */
  function applyWrapPadding(pos) {
    const wrap = document.getElementById("dock-wrap");
    const boost = MAX_BOOST * BASE + 20 + "px";
    wrap.style.paddingTop = pos === "bottom" ? boost : "";
    wrap.style.paddingRight = pos === "left" ? boost : "";
    wrap.style.paddingLeft = pos === "right" ? boost : "";
  }

  function bind() {
    const wrap = document.getElementById("dock-wrap");
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", () => { updateTargets(); kick(); });
  }

  return {
    init(el) {
      dockEl = el;
      collect();
      bind();
    },
    refresh() {
      if (!dockEl) return; // pode ser chamado antes de init() (renderDock no boot)
      collect(); updateTargets(); kick();
    },

    /* pos: "bottom" | "left" | "right" — alterna o eixo da magnificação */
    setPosition(pos) {
      vertical = pos !== "bottom";
      hoverPos = null;
      if (!dockEl) { applyWrapPadding(pos); return; }
      // zera estados e remove margens/transforms do eixo anterior
      collect();
      scales.fill(1);
      targets.fill(1);
      lastMargin.fill(0);
      icons.forEach((el) => {
        el.style.transform = "";
        el.style.zIndex = "";
        el.style.marginLeft = el.style.marginRight = "";
        el.style.marginTop = el.style.marginBottom = "";
      });
      applyWrapPadding(pos);
    }
  };
})();
