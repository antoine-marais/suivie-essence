(() => {
'use strict';
const KEY = 'fuellog.v1';
const FUELS = ['SP95', 'E10', 'SP98', 'Diesel', 'E85', 'GPL'];

const I18N = {
  fr: {
    dash: 'Bilan', add: 'Plein', hist: 'Historique', set: 'Réglages',
    budget: 'Budget du mois', spent: 'dépensé', of: 'sur', left: 'restant', over: 'dépassé de',
    noBudget: 'Aucun budget défini (Réglages)',
    avgCons: 'Conso moyenne', lastCons: 'Dernière conso', costKm: 'Coût au km', avgPrice: 'Prix moyen / L',
    totalKm: 'Km suivis', totalSpent: 'Total dépensé', fills: 'pleins',
    chCons: 'Consommation (L/100 km)', chMonth: 'Dépenses par mois',
    emptyDash: 'Ajoute ton premier plein pour voir tes statistiques.',
    needFull: 'La consommation apparaît après 2 pleins complets.',
    newFill: 'Nouveau plein', editFill: 'Modifier le plein',
    date: 'Date', odo: 'Km au compteur', liters: 'Litres', price: 'Prix / L', total: 'Total',
    full: 'Plein complet (réservoir rempli)', fuel: 'Carburant', note: 'Note (optionnel)',
    save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', del: 'Supprimer',
    confirmDel: 'Supprimer ce plein ?', saved: 'Enregistré ✓', deleted: 'Supprimé',
    errFields: 'Vérifie km, litres et total.', emptyHist: 'Aucun plein pour le moment.',
    vehicle: 'Nom du véhicule', monthBudget: 'Budget mensuel', currency: 'Devise',
    data: 'Données', exportJson: 'Exporter (JSON)', importJson: 'Importer (JSON)', exportCsv: 'Exporter (CSV)',
    reset: 'Tout effacer', confirmReset: 'Effacer toutes les données ? Cette action est irréversible.',
    imported: 'fusionnés', importErr: 'Fichier invalide',
    syncTitle: 'Téléphone + PC',
    syncText: 'Les données restent sur chaque appareil. Pour les partager : exporte en JSON sur un appareil, puis importe sur l’autre (les pleins sont fusionnés sans doublon).',
    km: 'km', perKm: '/km', other: 'Autre',
  },
  en: {
    dash: 'Summary', add: 'Fill-up', hist: 'History', set: 'Settings',
    budget: 'Monthly budget', spent: 'spent', of: 'of', left: 'left', over: 'over by',
    noBudget: 'No budget set (Settings)',
    avgCons: 'Avg consumption', lastCons: 'Last consumption', costKm: 'Cost per km', avgPrice: 'Avg price / L',
    totalKm: 'Km tracked', totalSpent: 'Total spent', fills: 'fill-ups',
    chCons: 'Consumption (L/100 km)', chMonth: 'Spending per month',
    emptyDash: 'Add your first fill-up to see your stats.',
    needFull: 'Consumption shows up after 2 full tanks.',
    newFill: 'New fill-up', editFill: 'Edit fill-up',
    date: 'Date', odo: 'Odometer (km)', liters: 'Liters', price: 'Price / L', total: 'Total',
    full: 'Full tank (filled to the top)', fuel: 'Fuel', note: 'Note (optional)',
    save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete',
    confirmDel: 'Delete this fill-up?', saved: 'Saved ✓', deleted: 'Deleted',
    errFields: 'Check odometer, liters and total.', emptyHist: 'No fill-ups yet.',
    vehicle: 'Vehicle name', monthBudget: 'Monthly budget', currency: 'Currency',
    data: 'Data', exportJson: 'Export (JSON)', importJson: 'Import (JSON)', exportCsv: 'Export (CSV)',
    reset: 'Erase everything', confirmReset: 'Erase all data? This cannot be undone.',
    imported: 'merged', importErr: 'Invalid file',
    syncTitle: 'Phone + PC',
    syncText: 'Data stays on each device. To share it: export JSON on one device, then import on the other (fill-ups are merged without duplicates).',
    km: 'km', perKm: '/km', other: 'Other',
  },
};

const defaults = () => ({
  settings: { lang: (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en', budget: 150, vehicle: '', currency: '€' },
  fills: [],
});
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.fills)) return { settings: { ...defaults().settings, ...r.settings }, fills: r.fills };
  } catch (e) {}
  return defaults();
}
let data = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

let tab = 'dash';
let editId = null;

const $ = s => document.querySelector(s);
const view = $('#view');
const t = k => I18N[data.settings.lang][k] ?? k;
const locale = () => (data.settings.lang === 'fr' ? 'fr-FR' : 'en-GB');
const num = (n, d = 2) => Number(n).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const money = n => `${num(n, 2)} ${data.settings.currency}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = s => new Date(s + 'T12:00:00').toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
const parse = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 1800);
}

/* ---------- calculs ---------- */
function compute(fills) {
  const f = fills.map(x => ({ ...x })).sort((a, b) => a.odo - b.odo || a.date.localeCompare(b.date));
  let lastFull = -1, accL = 0, accC = 0;
  const segs = [];
  f.forEach((x, i) => {
    if (lastFull >= 0) {
      accL += x.liters; accC += x.total;
      if (x.full) {
        const km = x.odo - f[lastFull].odo;
        if (km > 0) { x.cons = accL / km * 100; segs.push({ km, liters: accL, cost: accC, cons: x.cons, date: x.date }); }
        accL = 0; accC = 0; lastFull = i;
      }
    } else if (x.full) { lastFull = i; accL = 0; accC = 0; }
  });
  const sKm = segs.reduce((a, s) => a + s.km, 0);
  const sL = segs.reduce((a, s) => a + s.liters, 0);
  const sC = segs.reduce((a, s) => a + s.cost, 0);
  const totalL = f.reduce((a, x) => a + x.liters, 0);
  const totalC = f.reduce((a, x) => a + x.total, 0);
  const months = {};
  f.forEach(x => { const m = x.date.slice(0, 7); months[m] = (months[m] || 0) + x.total; });
  return {
    list: f, segs,
    avgCons: sKm ? sL / sKm * 100 : null,
    lastCons: segs.length ? segs[segs.length - 1].cons : null,
    costKm: sKm ? sC / sKm : null,
    avgPrice: totalL ? totalC / totalL : null,
    totalKm: f.length > 1 ? f[f.length - 1].odo - f[0].odo : 0,
    totalC, months,
  };
}

/* ---------- graphiques SVG ---------- */
function lineChart(points) {
  const W = 320, H = 150, p = { l: 30, r: 10, t: 10, b: 22 };
  const ys = points.map(q => q.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const X = i => p.l + (points.length === 1 ? (W - p.l - p.r) / 2 : i * (W - p.l - p.r) / (points.length - 1));
  const Y = v => p.t + (1 - (v - min) / (max - min)) * (H - p.t - p.b);
  const grid = [0, 0.5, 1].map(k => { const v = min + k * (max - min); return `<line class="gl" x1="${p.l}" x2="${W - p.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${p.l - 4}" y="${Y(v) + 3}" text-anchor="end">${v.toFixed(1)}</text>`; }).join('');
  const line = points.map((q, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(q.y).toFixed(1)}`).join(' ');
  const dots = points.map((q, i) => `<circle class="dot" cx="${X(i).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="3"/>`).join('');
  const lab = [0, points.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => `<text x="${X(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'end'}">${esc(points[i].x)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}<path class="ln" d="${line}"/>${dots}${lab}</svg>`;
}
function barChart(items) {
  const W = 320, H = 150, p = { l: 10, r: 10, t: 16, b: 22 };
  const max = Math.max(...items.map(i => i.v), 1);
  const bw = (W - p.l - p.r) / items.length;
  const bars = items.map((it, i) => {
    const h = (it.v / max) * (H - p.t - p.b), x = p.l + i * bw + bw * 0.15, y = H - p.b - h;
    return `<rect class="br" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>` +
      `<text x="${(x + bw * 0.35).toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle">${Math.round(it.v)}</text>` +
      `<text x="${(x + bw * 0.35).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(it.l)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${bars}</svg>`;
}

/* ---------- vues ---------- */
function vDash() {
  if (!data.fills.length) return `<div class="empty">⛽<br>${t('emptyDash')}</div>`;
  const c = compute(data.fills);
  const month = today().slice(0, 7);
  const spent = c.months[month] || 0, b = Number(data.settings.budget) || 0;
  const pct = b > 0 ? spent / b * 100 : 0;
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  const budgetCard = `<div class="card"><h2>${t('budget')}</h2>
    <div class="big">${money(spent)}</div>
    ${b > 0 ? `<div class="bar ${cls}"><i style="width:${Math.min(pct, 100)}%"></i></div>
    <div class="mut">${t('of')} ${money(b)} · ${pct >= 100 ? `${t('over')} ${money(spent - b)}` : `${money(b - spent)} ${t('left')}`}</div>`
      : `<div class="mut">${t('noBudget')}</div>`}</div>`;
  const stat = (l, v) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`;
  const na = '—';
  const stats = `<div class="grid">
    ${stat(t('avgCons'), c.avgCons != null ? `${num(c.avgCons)} <small>L/100</small>` : na)}
    ${stat(t('lastCons'), c.lastCons != null ? `${num(c.lastCons)} <small>L/100</small>` : na)}
    ${stat(t('costKm'), c.costKm != null ? `${num(c.costKm, 3)} <small>${data.settings.currency}${t('perKm')}</small>` : na)}
    ${stat(t('avgPrice'), c.avgPrice != null ? `${num(c.avgPrice, 3)} <small>${data.settings.currency}</small>` : na)}
    ${stat(t('totalKm'), `${num(c.totalKm, 0)} <small>${t('km')}</small>`)}
    ${stat(t('totalSpent'), money(c.totalC))}
  </div>`;
  const pts = c.list.filter(x => x.cons != null).map(x => ({ x: fmtDate(x.date), y: x.cons }));
  const consCard = `<div class="card"><h2>${t('chCons')}</h2>${pts.length ? lineChart(pts) : `<div class="mut">${t('needFull')}</div>`}</div>`;
  const ms = Object.keys(c.months).sort().slice(-6).map(m => ({ l: new Date(m + '-15').toLocaleDateString(locale(), { month: 'short' }), v: c.months[m] }));
  const monthCard = `<div class="card"><h2>${t('chMonth')} (${data.settings.currency})</h2>${barChart(ms)}</div>`;
  return budgetCard + stats + consCard + monthCard;
}

function vAdd() {
  const e = editId ? data.fills.find(x => x.id === editId) : null;
  const last = compute(data.fills).list.slice(-1)[0];
  const v = e || { date: today(), odo: '', liters: '', price: '', total: '', full: true, fuel: last ? last.fuel : 'SP95', note: '' };
  const f = x => (x === '' || x == null ? '' : x);
  return `<form id="addForm" class="card" autocomplete="off">
    <h2>${e ? t('editFill') : t('newFill')}</h2>
    <label>${t('date')}</label><input type="date" name="date" value="${esc(v.date)}" required>
    <label>${t('odo')}</label><input name="odo" inputmode="numeric" value="${esc(f(v.odo))}" placeholder="${last ? esc(last.odo) : ''}" required>
    <div class="row">
      <div><label>${t('liters')}</label><input name="liters" inputmode="decimal" value="${esc(f(v.liters))}" required></div>
      <div><label>${t('price')} (${esc(data.settings.currency)})</label><input name="price" inputmode="decimal" value="${esc(f(v.price ? Number(v.price).toFixed(3) : ''))}"></div>
    </div>
    <label>${t('total')} (${esc(data.settings.currency)})</label><input name="total" inputmode="decimal" value="${esc(f(v.total))}" required>
    <label>${t('fuel')}</label><select name="fuel">${FUELS.map(x => `<option ${x === v.fuel ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" name="full" ${v.full ? 'checked' : ''}>${t('full')}</label>
    <label>${t('note')}</label><input name="note" value="${esc(v.note)}">
    <button class="pri" type="submit">${t('save')}</button>
    ${e ? `<button class="sec" type="button" data-act="cancel" style="margin-top:10px">${t('cancel')}</button>` : ''}
  </form>`;
}

function vHist() {
  if (!data.fills.length) return `<div class="empty">${t('emptyHist')}</div>`;
  const c = compute(data.fills);
  return `<div class="card">${[...c.list].reverse().map(x => `<div class="item">
    <div><b>${fmtDate(x.date)}</b>${x.cons != null ? `<span class="badge">${num(x.cons)} L/100</span>` : ''}
      <div class="mut">${num(x.odo, 0)} ${t('km')} · ${esc(x.fuel)}${x.full ? '' : ' · ½'}${x.note ? ' · ' + esc(x.note) : ''}</div>
      <div class="acts"><button data-act="edit" data-id="${x.id}">${t('edit')}</button><button class="d" data-act="del" data-id="${x.id}">${t('del')}</button></div></div>
    <div class="r"><b>${money(x.total)}</b><div class="mut">${num(x.liters)} L · ${num(x.total / x.liters, 3)}</div></div>
  </div>`).join('')}</div>`;
}

function vSet() {
  const s = data.settings;
  return `<div class="card"><h2>${t('set')}</h2>
    <label>${t('vehicle')}</label><input id="sVehicle" value="${esc(s.vehicle)}">
    <div class="row"><div><label>${t('monthBudget')}</label><input id="sBudget" inputmode="decimal" value="${esc(s.budget)}"></div>
    <div><label>${t('currency')}</label><input id="sCur" value="${esc(s.currency)}" maxlength="4"></div></div>
  </div>
  <div class="card"><h2>${t('data')}</h2>
    <button class="sec" data-act="expJson">${t('exportJson')}</button>
    <button class="sec" data-act="impJson">${t('importJson')}</button>
    <button class="sec" data-act="expCsv">${t('exportCsv')}</button>
    <button class="sec danger" data-act="reset">${t('reset')}</button>
    <input type="file" id="file" accept="application/json,.json" hidden>
  </div>
  <div class="card"><h2>${t('syncTitle')}</h2><div class="mut">${t('syncText')}</div></div>`;
}

const TABS = [['dash', '📊'], ['add', '➕'], ['hist', '📜'], ['set', '⚙️']];
function render() {
  document.documentElement.lang = data.settings.lang;
  $('#langBtn').textContent = data.settings.lang === 'fr' ? 'EN' : 'FR';
  $('#appTitle').textContent = '⛽ ' + (data.settings.vehicle || 'Fuel Log');
  $('#tabs').innerHTML = TABS.map(([k, ic]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}"><span>${ic}</span>${t(k)}</button>`).join('');
  view.innerHTML = { dash: vDash, add: vAdd, hist: vHist, set: vSet }[tab]();
}
function go(k) { tab = k; if (k !== 'add') editId = null; render(); window.scrollTo(0, 0); }

/* ---------- export / import ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function csvCell(v) { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

/* ---------- événements ---------- */
document.addEventListener('click', ev => {
  const tb = ev.target.closest('[data-tab]'); if (tb) return go(tb.dataset.tab);
  if (ev.target.closest('#langBtn')) { data.settings.lang = data.settings.lang === 'fr' ? 'en' : 'fr'; save(); return render(); }
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'edit': editId = id; tab = 'add'; render(); window.scrollTo(0, 0); break;
    case 'cancel': go('hist'); break;
    case 'del': if (confirm(t('confirmDel'))) { data.fills = data.fills.filter(x => x.id !== id); save(); render(); toast(t('deleted')); } break;
    case 'expJson': download(`fuel-log-${today()}.json`, JSON.stringify(data, null, 2), 'application/json'); break;
    case 'expCsv': {
      const rows = [['date', 'odometer', 'liters', 'price_per_liter', 'total', 'full', 'fuel', 'note']];
      compute(data.fills).list.forEach(x => rows.push([x.date, x.odo, x.liters, (x.total / x.liters).toFixed(3), x.total, x.full ? 1 : 0, x.fuel, x.note]));
      download(`fuel-log-${today()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv'); break;
    }
    case 'impJson': $('#file').click(); break;
    case 'reset': if (confirm(t('confirmReset'))) { data = defaults(); save(); render(); } break;
  }
});

document.addEventListener('change', ev => {
  if (ev.target.id === 'file') {
    const file = ev.target.files[0]; if (!file) return;
    file.text().then(txt => {
      try {
        const j = JSON.parse(txt);
        if (!j || !Array.isArray(j.fills)) throw 0;
        const ids = new Set(data.fills.map(x => x.id));
        let n = 0;
        j.fills.forEach(x => {
          if (x && x.id && x.date && isFinite(x.odo) && isFinite(x.liters) && isFinite(x.total) && !ids.has(x.id)) {
            data.fills.push({ id: String(x.id), date: String(x.date).slice(0, 10), odo: +x.odo, liters: +x.liters, total: +x.total, full: !!x.full, fuel: String(x.fuel || 'SP95'), note: String(x.note || '') });
            ids.add(x.id); n++;
          }
        });
        save(); render(); toast(`${n} ${t('imported')}`);
      } catch (e) { toast(t('importErr')); }
    });
    return;
  }
  const map = { sVehicle: 'vehicle', sBudget: 'budget', sCur: 'currency' };
  const k = map[ev.target.id];
  if (k) {
    data.settings[k] = k === 'budget' ? (parse(ev.target.value) || 0) : ev.target.value.trim() || (k === 'currency' ? '€' : '');
    save(); render(); toast(t('saved'));
  }
});

// calcul auto prix / litres / total
document.addEventListener('input', ev => {
  const form = ev.target.closest('#addForm'); if (!form) return;
  const n = ev.target.name, f = form.elements;
  const L = parse(f.liters.value), P = parse(f.price.value), T = parse(f.total.value);
  if ((n === 'liters' || n === 'price') && L > 0 && P > 0) f.total.value = (L * P).toFixed(2);
  else if (n === 'total' && T > 0 && L > 0) f.price.value = (T / L).toFixed(3);
  else if (n === 'total' && T > 0 && P > 0 && !(L > 0)) f.liters.value = (T / P).toFixed(2);
});

document.addEventListener('submit', ev => {
  if (ev.target.id !== 'addForm') return;
  ev.preventDefault();
  const f = ev.target.elements;
  const odo = parse(f.odo.value), liters = parse(f.liters.value), total = parse(f.total.value);
  if (!(odo >= 0) || !(liters > 0) || !(total > 0) || !f.date.value) return toast(t('errFields'));
  const rec = { id: editId || uid(), date: f.date.value, odo, liters, total, full: f.full.checked, fuel: f.fuel.value, note: f.note.value.trim() };
  if (editId) data.fills = data.fills.map(x => (x.id === editId ? rec : x)); else data.fills.push(rec);
  save(); editId = null; toast(t('saved')); go('dash');
});

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
