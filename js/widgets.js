/* ==========================================================================
   Widgets — To-Do, Notas, Hábitos e Calendário.
   Todos os dados são persistidos localmente via Store (chrome.storage.local).
   ========================================================================== */

const Widgets = (() => {

  /* ---------------- To-Do ---------------- */
  function renderTodo(el, ctx) {
    el.innerHTML = `<h4>Tarefas</h4>
      <input class="todo-input" type="text" placeholder="Nova tarefa… (Enter)" maxlength="80">
      <ul class="todo-list"></ul>`;
    const list = el.querySelector(".todo-list");
    const input = el.querySelector(".todo-input");

    function draw() {
      list.innerHTML = "";
      ctx.data.todos.forEach((t, i) => {
        const li = document.createElement("li");
        if (t.done) li.className = "done";
        li.innerHTML = `<div class="tick no-drag"></div><span></span><button class="del" title="Remover">×</button>`;
        li.querySelector("span").textContent = t.text;
        // duplo clique edita o texto da tarefa (inline, sem sair do widget)
        li.querySelector("span").addEventListener("dblclick", () => {
          const span = li.querySelector("span");
          const ed = document.createElement("input");
          ed.className = "todo-edit";
          ed.type = "text";
          ed.value = t.text;
          ed.maxLength = 80;
          span.replaceWith(ed);
          ed.focus();
          ed.select();
          let done = false; // impede commit duplo (Enter → draw() → blur)
          const commit = () => {
            if (done) return;
            done = true;
            const v = ed.value.trim();
            if (v) t.text = v;
            ctx.save(); draw();
          };
          ed.addEventListener("keydown", (ke) => {
            if (ke.key === "Enter") commit();
            else if (ke.key === "Escape") { done = true; draw(); }
            ke.stopPropagation();
          });
          ed.addEventListener("blur", commit);
        });
        li.querySelector(".tick").onclick = () => {
          if (document.body.classList.contains("editing")) return; // não alterna durante edição/arraste
          t.done = !t.done; ctx.save(); draw();
        };
        li.querySelector(".del").onclick = () => { ctx.data.todos.splice(i, 1); ctx.save(); draw(); };
        list.appendChild(li);
      });
    }
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        ctx.data.todos.push({ text: input.value.trim(), done: false });
        input.value = "";
        ctx.save(); draw();
      }
      e.stopPropagation();
    });
    draw();
  }

  /* ---------------- Notas ---------------- */
  function renderNotes(el, ctx) {
    el.innerHTML = `<h4>Notas</h4><textarea class="notes-area" placeholder="Escreva algo…"></textarea>`;
    const area = el.querySelector(".notes-area");
    area.value = ctx.data.notes || "";
    let t;
    area.addEventListener("input", () => {
      ctx.data.notes = area.value;
      clearTimeout(t);
      t = setTimeout(() => ctx.save(), 300); // debounce
    });
    // salva imediatamente ao sair do campo (não perde os últimos ~300ms)
    area.addEventListener("blur", () => {
      clearTimeout(t);
      ctx.data.notes = area.value;
      ctx.save();
    });
    area.addEventListener("keydown", (e) => e.stopPropagation());
  }

  /* ---------------- Hábitos ----------------
     grade de 7 dias (segunda → domingo), semana corrente */
  function renderHabits(el, ctx) {
    el.innerHTML = `<h4>Hábitos</h4><div class="habit-body"></div><button class="habit-add">+ adicionar hábito</button>`;
    const body = el.querySelector(".habit-body");

    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // 0 = segunda
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);
    const weekKey = monday.toISOString().slice(0, 10);

    function draw() {
      body.innerHTML = "";
      ctx.data.habits.forEach((h, hi) => {
        const row = document.createElement("div");
        row.className = "habit-row";
        row.innerHTML = `<span class="hname"></span><div class="habit-dice"></div><button class="del" title="Remover">×</button>`;
        row.querySelector(".hname").textContent = h.name;
        const dice = row.querySelector(".habit-dice");
        for (let d = 0; d < 7; d++) {
          const b = document.createElement("button");
          if (d > dow) b.style.opacity = "0.3"; // dias futuros esmaecidos
          if (h.days && h.days[weekKey] && h.days[weekKey][d]) b.classList.add("on");
          b.onclick = () => {
            if (document.body.classList.contains("editing")) return;
            h.days = h.days || {};
            h.days[weekKey] = h.days[weekKey] || [false,false,false,false,false,false,false];
            h.days[weekKey][d] = !h.days[weekKey][d];
            ctx.save(); draw();
          };
          dice.appendChild(b);
        }
        row.querySelector(".del").onclick = () => { ctx.data.habits.splice(hi, 1); ctx.save(); draw(); };
        body.appendChild(row);
      });
    }
    el.querySelector(".habit-add").onclick = () => {
      const name = prompt("Nome do hábito:");
      if (name && name.trim()) {
        ctx.data.habits.push({ name: name.trim(), days: {} });
        ctx.save(); draw();
      }
    };
    draw();
  }

  /* ---------------- Calendário ---------------- */
  const renderCalendar = (() => {
    let cursor = new Date(); // mês em exibição
    return function (el) {
      const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
        "julho","agosto","setembro","outubro","novembro","dezembro"];
      function draw() {
        const y = cursor.getFullYear(), m = cursor.getMonth();
        const hoje = new Date();
        const first = new Date(y, m, 1);
        const startDow = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        el.innerHTML = `<h4>Calendário</h4>
          <div class="cal-header">
            <button data-nav="-1">‹</button>
            <span>${MESES[m]} ${y}</span>
            <button data-nav="1">›</button>
          </div>
          <div class="cal-grid"></div>`;
        const grid = el.querySelector(".cal-grid");
        ["S","T","Q","Q","S","S","D"].forEach(d => {
          const c = document.createElement("div"); c.className = "dow"; c.textContent = d;
          grid.appendChild(c);
        });
        for (let i = 0; i < startDow; i++) grid.appendChild(document.createElement("div"));
        for (let d = 1; d <= daysInMonth; d++) {
          const c = document.createElement("div");
          c.className = "day";
          c.textContent = d;
          if (d === hoje.getDate() && m === hoje.getMonth() && y === hoje.getFullYear())
            c.classList.add("today");
          grid.appendChild(c);
        }
        el.querySelectorAll("[data-nav]").forEach(b => {
          b.onclick = () => { cursor = new Date(y, m + Number(b.dataset.nav), 1); draw(); };
        });
      }
      draw();
    };
  })();

  /* ---------------- Contagem regressiva ----------------
     Alvo configurável (nome + data), 100% local. */
  function renderCountdown(el, ctx) {
    el.innerHTML = `<h4>Contagem regressiva</h4>
      <button class="countdown-edit no-drag" title="Configurar alvo">✎</button>
      <div class="countdown-body">
        <div class="countdown-days">–</div>
        <div class="countdown-label"></div>
      </div>`;
    const daysEl = el.querySelector(".countdown-days");
    const labelEl = el.querySelector(".countdown-label");

    function draw() {
      const cd = ctx.data.countdown;
      if (!cd || !cd.date) {
        daysEl.textContent = "–";
        labelEl.textContent = "Duplo clique para definir um alvo";
        return;
      }
      const target = new Date(cd.date + "T00:00:00");
      const diff = Math.ceil((target - new Date()) / 86400000);
      daysEl.textContent = Math.abs(diff);
      labelEl.textContent =
        (diff > 0 ? "dias até " : diff === 0 ? "hoje: " : "dias desde ") + (cd.name || cd.date);
    }

    function configure() {
      if (document.body.classList.contains("editing")) return; // evita abrir durante arraste
      const cur = ctx.data.countdown || {};
      const name = prompt("Nome do evento:", cur.name || "");
      if (name === null) return;
      const date = prompt("Data alvo (AAAA-MM-DD):", cur.date || "");
      if (date === null) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        if (date.trim()) alert("Formato inválido. Use AAAA-MM-DD.");
        return;
      }
      ctx.data.countdown = { name: name.trim(), date: date.trim() };
      ctx.save();
      draw();
    }

    el.querySelector(".countdown-edit").onclick = configure;
    el.querySelector(".countdown-body").addEventListener("dblclick", configure);
    draw();
  }

  /* ---------------- Progresso (dia / mês / ano) ---------------- */
  function renderDaybar(el) {
    el.innerHTML = `<h4>Progresso</h4>
      <div class="daybar-body">
        <div class="daybar-row" data-k="day"><span class="lbl">Dia</span><div class="daybar-track"><div class="daybar-fill"></div></div><span class="pct"></span></div>
        <div class="daybar-row" data-k="month"><span class="lbl">Mês</span><div class="daybar-track"><div class="daybar-fill"></div></div><span class="pct"></span></div>
        <div class="daybar-row" data-k="year"><span class="lbl">Ano</span><div class="daybar-track"><div class="daybar-fill"></div></div><span class="pct"></span></div>
      </div>`;

    function draw() {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
      const pcts = {
        day:   (now - dayStart) / 86400000,
        month: (now - monthStart) / (monthEnd - monthStart),
        year:  (now - yearStart) / (yearEnd - yearStart)
      };
      el.querySelectorAll(".daybar-row").forEach((row) => {
        const p = Math.min(1, Math.max(0, pcts[row.dataset.k]));
        row.querySelector(".daybar-fill").style.width = (p * 100).toFixed(1) + "%";
        row.querySelector(".pct").textContent = Math.floor(p * 100) + "%";
      });
    }
    draw();
    const t = setInterval(draw, 60000);
    // evita intervalo órfão quando o widget é re-renderizado/removido
    const obs = new MutationObserver(() => {
      if (!document.contains(el)) { clearInterval(t); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------------- Registro ---------------- */
  const DEFS = [
    { id: "todo",      name: "Tarefas",    desc: "Lista de tarefas com marcação",      defaultPos: { x: 0.04, y: 0.38 }, defaultSize: { w: 272, h: 216 }, minW: 200, minH: 140, render: renderTodo },
    { id: "notes",     name: "Notas",      desc: "Bloco de texto livre",               defaultPos: { x: 0.04, y: 0.62 }, defaultSize: { w: 272, h: 200 }, minW: 200, minH: 120, render: renderNotes },
    { id: "habits",    name: "Hábitos",    desc: "Grade semanal de hábitos",           defaultPos: { x: 0.94, y: 0.38, right: true }, defaultSize: { w: 320, h: 168 }, minW: 240, minH: 120, render: renderHabits },
    { id: "calendar",  name: "Calendário", desc: "Mês atual com navegação",            defaultPos: { x: 0.94, y: 0.14, right: true }, defaultSize: { w: 240, h: 264 }, minW: 220, minH: 200, render: renderCalendar },
    { id: "countdown", name: "Contagem",   desc: "Dias até uma data importante",       defaultPos: { x: 0.5, y: 0.82 }, defaultSize: { w: 240, h: 144 }, minW: 160, minH: 100, render: renderCountdown },
    { id: "daybar",    name: "Progresso",  desc: "% do dia, mês e ano decorridos",     defaultPos: { x: 0.94, y: 0.60, right: true }, defaultSize: { w: 320, h: 144 }, minW: 200, minH: 110, render: renderDaybar }
  ];

  return { DEFS };
})();
