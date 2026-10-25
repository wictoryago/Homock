/* ==========================================================================
   Dock — magnificação estilo macOS / Plank (otimizada)
   ========================================================================== */

const Dock = (() => {
  "use strict";

  const BASE = 52;          
  const GAP = 10;           
  const PAD_X = 14;         
  const PAD_Y = 10;         
  const MAX_BOOST = 0.62;   
  const RANGE = 110;        
  const LERP = 0.22;        

  let dockEl = null;
  let icons = [];
  let scales = [];
  let targets = [];
  let lastMargin = [];
  let rafId = null;
  let hoverPos = null;
  let vertical = false;

  function collect() {
    icons = Array.from(dockEl.querySelectorAll(".dock-item"));
    scales = icons.map((_, i) => scales[i] || 1);
    targets = icons.map((_, i) => targets[i] || 1);
    lastMargin = icons.map((_, i) => lastMargin[i] ?? -1);
  }

  function falloff(dist) {
    const d = dist / RANGE;
    if (d >= 1) return 0;
    return 0.5 * (1 + Math.cos(Math.PI * d));
  }

  function updateTargets() {
    if (hoverPos === null) {
      targets.fill(1);
      return;
    }
    const rect = dockEl.getBoundingClientRect();
    let c = (vertical ? rect.top + PAD_Y : rect.left + PAD_X);
    for (let i = 0; i < icons.length; i++) {
      const mi = (scales[i] - 1) * BASE * 0.5;
      const center = c + mi + BASE / 2;
      targets[i] = 1 + MAX_BOOST * falloff(Math.abs(hoverPos - center));
      c += BASE + 2 * mi + GAP;
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
        icons[i].style.transform = `scale(${s.toFixed(4)}) translateZ(0)`;
        icons[i].style.zIndex = String(Math.round(s * 100));
      }
      
      // Matemática contínua (sem Math.round) resolve o salto do layout
      const m = (s - 1) * BASE * 0.5;
      
      // Apenas reescreve no DOM se a mudança for significativa (> 0.005px)
      if (Math.abs(m - lastMargin[i]) > 0.005) {
        lastMargin[i] = m;
        const marginStr = m.toFixed(3) + "px";
        
        if (vertical) {
          icons[i].style.marginTop = marginStr;
          icons[i].style.marginBottom = marginStr;
        } else {
          icons[i].style.marginLeft = marginStr;
          icons[i].style.marginRight = marginStr;
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
      if (!dockEl) return;
      collect(); updateTargets(); kick();
    },

    setPosition(pos) {
      vertical = pos !== "bottom";
      hoverPos = null;
      if (!dockEl) { applyWrapPadding(pos); return; }
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
