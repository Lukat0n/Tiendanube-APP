(() => {
  const CURRENT_SCRIPT = document.currentScript || (function () {
    const s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  const BASE = new URL(CURRENT_SCRIPT.src).origin;

  const CONFIG_URL = `${BASE}/api/bundle-config`;
  const MAP_URL = `${BASE}/api/variant-map`;


  function money(n, currency) {
    try {
      return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 0 }).format(n / 100);
    } catch { return `$${(n/100).toFixed(0)}`; }
  }

  async function waitForBuyButton() {
    return new Promise(resolve => {
      const tick = () => {
        for (const sel of SELECTORS) {
          const el = $(sel);
          if (el) return resolve(el);
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function createEl(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  async function addLine(variantId, qty) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/cart";
    form.style.display = "none";

    const id = document.createElement("input");
    id.name = "id"; id.value = String(variantId);
    const q = document.createElement("input");
    q.name = "quantity"; q.value = String(qty || 1);

    form.appendChild(id); form.appendChild(q);
    document.body.appendChild(form);
    const ok = await fetch(form.action, { method: "POST", body: new FormData(form), credentials: "include" }).then(r => r.ok);
    form.remove();
    return ok;
  }

  async function addMany(lines) {
    for (const l of lines) if (l.variantId && l.quantity) await addLine(l.variantId, l.quantity);
    location.href = "/cart";
  }

  async function main() {
    const btn = await waitForBuyButton();
    const cfg = await fetch(CONFIG_URL).then(r => r.json());
    const map = await fetch(MAP_URL).then(r => r.json());

    const mount = createEl(`<div id="bundle-widget" style="margin-bottom:12px;"></div>`);
    btn.parentElement.insertBefore(mount, btn);

    const state = {
      activeSize: cfg.visibleSizes?.[0] || 1,
      slots: [],
      comps: (cfg.complementary || []).map(c => ({ ...c, checked: false }))
    };

    function render() {
      const tiers = cfg.visibleSizes.map(s => ({
        size: s,
        label: s === 1 ? "Por unidad" : `Pack X${s}`,
        pct: cfg.discountBySize?.[s] || 0
      }));

      const theme = cfg.themeColor || "#ff3b7f";
      const currency = cfg.currency || "ARS";

      const slotHtml = Array.from({ length: state.activeSize }).map((_, i) => {
        const current = state.slots[i]?.variantId || "";
        const opts = (cfg.bundlePool || []).map(p => `
          <optgroup label="${p.title}">
            ${(p.variants||[]).map(v => `<option value="${v.id}" ${v.id==current?'selected':''}>${v.title}</option>`).join("")}
          </optgroup>`).join("");
        return `
          <div style="border:1px dashed #ddd;border-radius:10px;padding:8px;">
            <div style="font:600 14px/1.2 system-ui;margin:0 0 6px">#${i+1} — Elegí producto/variante</div>
            <select data-slot="${i}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;background:#fff">
              <option value="">— Elegí una variante —</option>
              ${opts}
            </select>
          </div>`;
      }).join("");

      const tiersHtml = tiers.map(t => `
        <button data-size="${t.size}" style="
          width:100%;text-align:left;border:${t.size===state.activeSize? '3px':'1px'} solid ${t.size===state.activeSize? theme:'#e5e7eb'};
          border-radius:12px;padding:10px;margin:6px 0;box-shadow:${t.size===state.activeSize?`0 0 0 4px ${theme}1f`:'none'};
          background:#fff">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div>
              <div style="font:700 15px/1.2 system-ui">${t.label}</div>
              <div style="color:#555;font:13px/1.2 system-ui">${t.size} ${t.size>1?'unidades':'unidad'}</div>
              ${t.pct? `<div style="margin-top:4px;font:13px/1.2 system-ui"><b>Ahorrás ${t.pct}%</b></div>`:''}
            </div>
            <div style="font:600 11px/1 system-ui;background:#f3f4f6;padding:4px 8px;border-radius:999px">Pack ${t.size}</div>
          </div>
        </button>`).join("");

      const compsHtml = (state.comps||[]).map((c, i) => `
        <label style="display:flex;align-items:center;justify-content:space-between;border:1px solid #eee;border-radius:10px;padding:8px;margin-top:6px">
          <span style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" data-comp="${i}" ${c.checked?'checked':''}/>
            <span style="font:14px system-ui">${c.title}</span>
          </span>
          <span style="font:600 14px system-ui">${money(c.price||0, currency)}</span>
        </label>`).join("");

      const baseSubtotal = state.slots.reduce((acc, s) => {
        if (!s?.variantId) return acc;
        const v = (cfg.bundlePool||[]).flatMap(p => p.variants||[]).find(v => v.id==s.variantId);
        return acc + (v?.price || 0);
      }, 0);
      const pct = cfg.discountBySize?.[state.activeSize] || 0;
      const discounted = Math.round(baseSubtotal * (1 - pct/100));
      const compsTotal = state.comps.filter(c => c.checked).reduce((a,c)=>a+(c.price||0),0);
      const grand = discounted + compsTotal;

      mount.innerHTML = `
        <div style="border:1px solid #eee;border-radius:12px;padding:14px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.04)">
          <div style="font:700 16px system-ui;margin-bottom:8px">LLEVÁ & AHORRÁ</div>

          ${tiersHtml}

          <div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px">
            ${slotHtml}
          </div>

          <div style="font:700 14px system-ui;margin-top:12px">Productos complementarios</div>
          ${compsHtml}

          <button id="bundle-add" style="margin-top:10px;width:100%;padding:12px 14px;border:none;border-radius:12px;background:${theme};color:#fff;font:700 14px system-ui">AGREGAR AL CARRITO</button>
          <div style="font:12px system-ui;color:#666;margin-top:6px">Total estimado: <b>${money(grand, currency)}</b> · El descuento se aplica al instante con variantes sombra.</div>
        </div>
      `;

      $$("#bundle-widget [data-size]").forEach(b => b.onclick = () => {
        state.activeSize = parseInt(b.getAttribute("data-size"),10);
        if (state.slots.length > state.activeSize) state.slots = state.slots.slice(0, state.activeSize);
        render();
      });

      $$("#bundle-widget select[data-slot]").forEach(sel => {
        sel.onchange = () => {
          const i = parseInt(sel.getAttribute("data-slot"),10);
          state.slots[i] = { variantId: sel.value ? Number(sel.value) : null };
        };
      });

      $$("#bundle-widget input[type=checkbox][data-comp]").forEach(chk => {
        chk.onchange = () => {
          const i = parseInt(chk.getAttribute("data-comp"),10);
          state.comps[i].checked = chk.checked;
        };
      });

      $("#bundle-add").onclick = async () => {
        if (state.slots.slice(0, state.activeSize).some(s => !s?.variantId)) {
          alert("Elegí una variante en cada posición del pack.");
          return;
        }
        const tierKey = state.activeSize===2?'x2':state.activeSize===3?'x3':state.activeSize===4?'x4':null;
        const lines = [];

        state.slots.slice(0, state.activeSize).forEach(s => {
          const baseId = s.variantId;
          const finalId = tierKey && map[String(baseId)]?.[tierKey] ? map[String(baseId)][tierKey] : baseId;
          lines.push({ variantId: finalId, quantity: 1 });
        });

        state.comps.filter(c => c.checked).forEach(c => {
          const baseId = c.variantId;
          const finalId = tierKey && map[String(baseId)]?.[tierKey] ? map[String(baseId)][tierKey] : baseId;
          lines.push({ variantId: finalId, quantity: 1 });
        });

        await addMany(lines);
      };
    }

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main);
  else main();
})();
