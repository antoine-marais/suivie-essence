(() => {
'use strict';
const S = window.Store;
const data = S.data;
const FUELS = ['SP95', 'E10', 'SP98', 'Diesel', 'E85', 'GPL'];
const FUEL_FIELD = { SP95: 'sp95_prix', E10: 'e10_prix', SP98: 'sp98_prix', Diesel: 'gazole_prix', E85: 'e85_prix', GPL: 'gplc_prix' };
const PRICE_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
const SQL = `create table if not exists fuel_sync (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table fuel_sync enable row level security;

create or replace function fuel_get(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if length(p_key) < 32 then raise exception 'key too short'; end if;
  return (select data from fuel_sync where key = p_key);
end $$;

create or replace function fuel_put(p_key text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(p_key) < 32 then raise exception 'key too short'; end if;
  insert into fuel_sync(key, data, updated_at) values (p_key, p_data, now())
  on conflict (key) do update set data = excluded.data, updated_at = now();
end $$;

revoke all on function fuel_get(text), fuel_put(text, jsonb) from public;
grant execute on function fuel_get(text), fuel_put(text, jsonb) to anon;`;

const I18N = {
  fr: {
    dash: 'Bilan', add: 'Ajouter', hist: 'Historique', tabPrice: 'Prix', set: 'Réglages',
    budget: 'Budget carburant du mois', spent: 'dépensé', of: 'sur', left: 'restant', over: 'dépassé de',
    noBudget: 'Aucun budget défini (Réglages)',
    avgCons: 'Conso moyenne', lastCons: 'Dernière conso', costKm: 'Carburant au km', avgPrice: 'Prix moyen / L',
    totalKm: 'Km suivis', totalSpent: 'Carburant total', otherMonth: 'Autres dépenses (mois)', realKm: 'Coût réel au km',
    chCons: 'Consommation (L/100 km)', chMonth: 'Dépenses par mois', fuelL: 'Carburant', otherL: 'Autres', chCat: 'Autres dépenses par catégorie',
    emptyDash: 'Ajoute ton premier plein ou ta première dépense pour voir tes statistiques.',
    needFull: 'La consommation apparaît après 2 pleins complets.',
    fill: 'Plein', expense: 'Dépense', newFill: 'Nouveau plein', editFill: 'Modifier le plein', newExp: 'Nouvelle dépense', editExp: 'Modifier la dépense',
    date: 'Date', odo: 'Km au compteur', odoOpt: 'Km au compteur (optionnel)', liters: 'Litres', price: 'Prix / L', total: 'Total', amount: 'Montant', category: 'Catégorie',
    full: 'Plein complet (réservoir rempli)', fuel: 'Carburant', note: 'Note (optionnel)',
    save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier', del: 'Supprimer',
    confirmDel: 'Supprimer cet élément ?', saved: 'Enregistré ✓', deleted: 'Supprimé',
    errFields: 'Vérifie les champs obligatoires.', emptyHist: 'Rien à afficher pour ces filtres.',
    fType: 'Type', fPeriod: 'Période', fFuel: 'Carburant', fCat: 'Catégorie', all: 'Tout', allF: 'Tous',
    tFills: 'Pleins', tExp: 'Dépenses',
    pAll: 'Toute la période', pMonth: 'Ce mois', pLast: 'Mois dernier', p3m: '3 derniers mois', pYear: 'Cette année', pLastYear: 'Année dernière',
    sumLine: 'élément(s)',
    cat_maintenance: 'Entretien', cat_repair: 'Réparation', cat_insurance: 'Assurance', cat_toll: 'Péage', cat_parking: 'Parking', cat_tires: 'Pneus', cat_tax: 'Taxes / amendes', cat_other: 'Autre',
    vehicles: 'Véhicules', vehicle: 'Nom du véhicule', monthBudget: 'Budget carburant mensuel', currency: 'Devise',
    addVehicle: 'Ajouter un véhicule', vehName: 'Nom du nouveau véhicule', use: 'Utiliser', active: 'actif', confirmDelVeh: 'Supprimer ce véhicule et tous ses pleins et dépenses ?',
    data: 'Données', exportJson: 'Exporter (JSON)', importJson: 'Importer (JSON)', exportCsv: 'Exporter (CSV)',
    reset: 'Tout effacer', confirmReset: 'Effacer toutes les données (et sur les autres appareils synchronisés) ? Irréversible.',
    imported: 'élément(s) fusionné(s)', importErr: 'Fichier invalide',
    syncT: 'Synchronisation téléphone + PC', syncIntro: 'Gratuit avec Supabase. Tes données restent chiffrées par une clé secrète que toi seul connais.',
    syncStep1: '1. Crée un projet gratuit sur supabase.com.', syncStep2: '2. Dans « SQL Editor », colle ce SQL et clique sur Run.',
    syncStep3: '3. Dans Project Settings, API : copie « Project URL » et la clé « anon public », puis colle-les ci-dessous.',
    syncStep4: '4. Génère une clé de synchro, puis copie le lien de configuration et ouvre-le sur l’autre appareil.',
    pasteLink: 'Déjà configuré sur un autre appareil ? Colle ici le lien de config',
    copySql: 'Copier le SQL', copied: 'Copié ✓', sUrl: 'Project URL', sAnon: 'Clé anon public', sKey: 'Clé de synchro (secrète)', genKey: 'Générer une clé', copyLink: 'Copier le lien de config', syncNow: 'Synchroniser maintenant',
    stOff: 'Non configurée', stSyncing: 'Synchronisation…', stOk: 'Synchronisé', stError: 'Erreur', last: 'dernière',
    applySync: 'Configurer la synchronisation avec ce lien ?', linkWarn: 'Ce lien contient ta clé secrète : ne le partage pas.',
    backupT: 'Sauvegarde automatique (fichier)', backupText: 'À chaque modification, l’appli écrit une copie dans un fichier de ton choix (Chrome ou Edge sur PC).',
    bChoose: 'Choisir le fichier', bReconnect: 'Réactiver la sauvegarde', bStop: 'Arrêter', bUnsupported: 'Non disponible sur ce navigateur (utilise la synchro ou l’export).',
    bOk: 'Active', bNeed: 'Autorisation à renouveler', bErr: 'Erreur d’écriture', bNone: 'Désactivée',
    priceT: 'Prix autour de moi', radius: 'Rayon', search: 'Chercher', locating: 'Localisation…', loading: 'Recherche…', noStation: 'Aucune station trouvée.', priceErr: 'Impossible de récupérer les prix (connexion ou localisation).',
    geoDenied: 'Autorise la localisation pour utiliser cette fonction.', priceSrc: 'Source : data.gouv.fr (prix des carburants en France).', map: 'Itinéraire', updated: 'maj',
    km: 'km', perKm: '/km',
  },
  en: {
    dash: 'Summary', add: 'Add', hist: 'History', tabPrice: 'Prices', set: 'Settings',
    budget: 'Fuel budget this month', spent: 'spent', of: 'of', left: 'left', over: 'over by',
    noBudget: 'No budget set (Settings)',
    avgCons: 'Avg consumption', lastCons: 'Last consumption', costKm: 'Fuel per km', avgPrice: 'Avg price / L',
    totalKm: 'Km tracked', totalSpent: 'Total fuel', otherMonth: 'Other expenses (month)', realKm: 'Real cost per km',
    chCons: 'Consumption (L/100 km)', chMonth: 'Spending per month', fuelL: 'Fuel', otherL: 'Other', chCat: 'Other expenses by category',
    emptyDash: 'Add your first fill-up or expense to see your stats.',
    needFull: 'Consumption shows up after 2 full tanks.',
    fill: 'Fill-up', expense: 'Expense', newFill: 'New fill-up', editFill: 'Edit fill-up', newExp: 'New expense', editExp: 'Edit expense',
    date: 'Date', odo: 'Odometer (km)', odoOpt: 'Odometer (optional)', liters: 'Liters', price: 'Price / L', total: 'Total', amount: 'Amount', category: 'Category',
    full: 'Full tank (filled to the top)', fuel: 'Fuel', note: 'Note (optional)',
    save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete',
    confirmDel: 'Delete this item?', saved: 'Saved ✓', deleted: 'Deleted',
    errFields: 'Check the required fields.', emptyHist: 'Nothing to show for these filters.',
    fType: 'Type', fPeriod: 'Period', fFuel: 'Fuel', fCat: 'Category', all: 'All', allF: 'All',
    tFills: 'Fill-ups', tExp: 'Expenses',
    pAll: 'All time', pMonth: 'This month', pLast: 'Last month', p3m: 'Last 3 months', pYear: 'This year', pLastYear: 'Last year',
    sumLine: 'item(s)',
    cat_maintenance: 'Maintenance', cat_repair: 'Repair', cat_insurance: 'Insurance', cat_toll: 'Toll', cat_parking: 'Parking', cat_tires: 'Tires', cat_tax: 'Taxes / fines', cat_other: 'Other',
    vehicles: 'Vehicles', vehicle: 'Vehicle name', monthBudget: 'Monthly fuel budget', currency: 'Currency',
    addVehicle: 'Add a vehicle', vehName: 'New vehicle name', use: 'Use', active: 'active', confirmDelVeh: 'Delete this vehicle with all its fill-ups and expenses?',
    data: 'Data', exportJson: 'Export (JSON)', importJson: 'Import (JSON)', exportCsv: 'Export (CSV)',
    reset: 'Erase everything', confirmReset: 'Erase all data (and on other synced devices)? This cannot be undone.',
    imported: 'item(s) merged', importErr: 'Invalid file',
    syncT: 'Phone + PC sync', syncIntro: 'Free with Supabase. Your data is protected by a secret key only you know.',
    syncStep1: '1. Create a free project on supabase.com.', syncStep2: '2. In “SQL Editor”, paste this SQL and click Run.',
    syncStep3: '3. In Project Settings, API: copy “Project URL” and the “anon public” key and paste them below.',
    syncStep4: '4. Generate a sync key, then copy the setup link and open it on your other device.',
    pasteLink: 'Already set up on another device? Paste the setup link here',
    copySql: 'Copy SQL', copied: 'Copied ✓', sUrl: 'Project URL', sAnon: 'Anon public key', sKey: 'Sync key (secret)', genKey: 'Generate a key', copyLink: 'Copy setup link', syncNow: 'Sync now',
    stOff: 'Not configured', stSyncing: 'Syncing…', stOk: 'Synced', stError: 'Error', last: 'last',
    applySync: 'Configure sync with this link?', linkWarn: 'This link contains your secret key: do not share it.',
    backupT: 'Automatic backup (file)', backupText: 'On every change the app writes a copy to a file of your choice (Chrome or Edge on desktop).',
    bChoose: 'Choose file', bReconnect: 'Re-enable backup', bStop: 'Stop', bUnsupported: 'Not available in this browser (use sync or export).',
    bOk: 'Active', bNeed: 'Permission needs renewing', bErr: 'Write error', bNone: 'Disabled',
    priceT: 'Prices near me', radius: 'Radius', search: 'Search', locating: 'Locating…', loading: 'Searching…', noStation: 'No station found.', priceErr: 'Could not fetch prices (connection or location).',
    geoDenied: 'Allow location access to use this feature.', priceSrc: 'Source: data.gouv.fr (fuel prices in France).', map: 'Directions', updated: 'upd.',
    km: 'km', perKm: '/km',
  },
};

/* ---------- état UI ---------- */
let tab = 'dash';
let addMode = 'fill';
let editing = null; // {kind:'fill'|'expense', id}
const filters = { type: 'all', period: 'all', fuel: 'all', cat: 'all' };
const prices = { state: 'idle', list: [], fuel: null, radius: 10, msg: '' };

const $ = s => document.querySelector(s);
const view = $('#view');
const lang = () => data.settings.lang;
const t = k => I18N[lang()][k] ?? k;
const locale = () => (lang() === 'fr' ? 'fr-FR' : 'en-GB');
const num = (n, d = 2) => Number(n).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const cur = () => data.settings.currency;
const money = n => `${num(n, 2)} ${cur()}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const today = () => iso(new Date());
const fmtDate = s => new Date(s + 'T12:00:00').toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
const parse = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };
const vid = () => data.settings.activeVehicle;
const vehicle = () => data.vehicles.find(v => v.id === vid() && !v.deleted);
const myFills = () => S.forVehicle('fill', vid());
const myExp = () => S.forVehicle('expense', vid());

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
        if (km > 0) { x.cons = accL / km * 100; segs.push({ km, liters: accL, cost: accC, cons: x.cons, from: f[lastFull].date, to: x.date }); }
        accL = 0; accC = 0; lastFull = i;
      }
    } else if (x.full) { lastFull = i; accL = 0; accC = 0; }
  });
  const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
  const sKm = sum(segs, 'km'), sL = sum(segs, 'liters'), sC = sum(segs, 'cost');
  const totalL = sum(f, 'liters'), totalC = sum(f, 'total');
  const months = {};
  f.forEach(x => { const m = x.date.slice(0, 7); months[m] = (months[m] || 0) + x.total; });
  return {
    list: f, segs, sKm, sC,
    avgCons: sKm ? sL / sKm * 100 : null,
    lastCons: segs.length ? segs[segs.length - 1].cons : null,
    costKm: sKm ? sC / sKm : null,
    avgPrice: totalL ? totalC / totalL : null,
    totalKm: f.length > 1 ? f[f.length - 1].odo - f[0].odo : 0,
    totalC, months, segFrom: segs.length ? segs[0].from : null, segTo: segs.length ? segs[segs.length - 1].to : null,
  };
}

/* ---------- graphiques ---------- */
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
  const max = Math.max(...items.map(i => i.a + i.b), 1);
  const bw = (W - p.l - p.r) / items.length, ch = H - p.t - p.b;
  const bars = items.map((it, i) => {
    const ha = it.a / max * ch, hb = it.b / max * ch, x = p.l + i * bw + bw * 0.15, w = bw * 0.7, cx = x + w / 2;
    const ya = H - p.b - ha, yb = ya - hb;
    return `<rect class="br" x="${x.toFixed(1)}" y="${ya.toFixed(1)}" width="${w.toFixed(1)}" height="${ha.toFixed(1)}" rx="3"/>` +
      (hb > 0 ? `<rect class="br2" x="${x.toFixed(1)}" y="${yb.toFixed(1)}" width="${w.toFixed(1)}" height="${hb.toFixed(1)}" rx="3"/>` : '') +
      `<text x="${cx.toFixed(1)}" y="${(yb - 3).toFixed(1)}" text-anchor="middle">${Math.round(it.a + it.b)}</text>` +
      `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(it.l)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${bars}</svg>`;
}

/* ---------- vues ---------- */
function vDash() {
  const fills = myFills(), exps = myExp();
  if (!fills.length && !exps.length) return `<div class="empty">⛽<br>${t('emptyDash')}</div>`;
  const c = compute(fills);
  const month = today().slice(0, 7);
  const spent = c.months[month] || 0, b = Number(vehicle().budget) || 0;
  const pct = b > 0 ? spent / b * 100 : 0;
  const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : '';
  const budgetCard = `<div class="card"><h2>${t('budget')}</h2>
    <div class="big">${money(spent)}</div>
    ${b > 0 ? `<div class="bar ${cls}"><i style="width:${Math.min(pct, 100)}%"></i></div>
    <div class="mut">${t('of')} ${money(b)} · ${pct >= 100 ? `${t('over')} ${money(spent - b)}` : `${money(b - spent)} ${t('left')}`}</div>`
      : `<div class="mut">${t('noBudget')}</div>`}</div>`;
  const expMonth = exps.filter(x => x.date.slice(0, 7) === month).reduce((a, x) => a + x.amount, 0);
  let real = null;
  if (c.sKm > 0) { const e = exps.filter(x => x.date >= c.segFrom && x.date <= c.segTo).reduce((a, x) => a + x.amount, 0); real = (c.sC + e) / c.sKm; }
  const stat = (l, v) => `<div class="stat"><small>${l}</small><b>${v}</b></div>`;
  const na = '—', cu = cur();
  const stats = `<div class="grid">
    ${stat(t('avgCons'), c.avgCons != null ? `${num(c.avgCons)} <small>L/100</small>` : na)}
    ${stat(t('lastCons'), c.lastCons != null ? `${num(c.lastCons)} <small>L/100</small>` : na)}
    ${stat(t('costKm'), c.costKm != null ? `${num(c.costKm, 3)} <small>${esc(cu)}${t('perKm')}</small>` : na)}
    ${stat(t('realKm'), real != null ? `${num(real, 3)} <small>${esc(cu)}${t('perKm')}</small>` : na)}
    ${stat(t('avgPrice'), c.avgPrice != null ? `${num(c.avgPrice, 3)} <small>${esc(cu)}</small>` : na)}
    ${stat(t('otherMonth'), money(expMonth))}
    ${stat(t('totalKm'), `${num(c.totalKm, 0)} <small>${t('km')}</small>`)}
    ${stat(t('totalSpent'), money(c.totalC))}
  </div>`;
  const pts = c.list.filter(x => x.cons != null).map(x => ({ x: fmtDate(x.date), y: x.cons }));
  const consCard = `<div class="card"><h2>${t('chCons')}</h2>${pts.length ? lineChart(pts) : `<div class="mut">${t('needFull')}</div>`}</div>`;
  const em = {}; exps.forEach(x => { const m = x.date.slice(0, 7); em[m] = (em[m] || 0) + x.amount; });
  const keys = [...new Set([...Object.keys(c.months), ...Object.keys(em)])].sort().slice(-6);
  const monthCard = `<div class="card"><h2>${t('chMonth')} (${esc(cu)})</h2>${barChart(keys.map(m => ({ l: new Date(m + '-15').toLocaleDateString(locale(), { month: 'short' }), a: c.months[m] || 0, b: em[m] || 0 })))}
    <div class="legend"><span><i class="k1"></i>${t('fuelL')}</span><span><i class="k2"></i>${t('otherL')}</span></div></div>`;
  let catCard = '';
  if (exps.length) {
    const byCat = {}; exps.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const mx = rows[0][1];
    catCard = `<div class="card"><h2>${t('chCat')}</h2>${rows.map(([k, v]) => `<div class="hb"><span>${t('cat_' + k)}</span><div class="bar"><i class="o" style="width:${v / mx * 100}%"></i></div><b>${money(v)}</b></div>`).join('')}</div>`;
  }
  return budgetCard + stats + consCard + monthCard + catCard;
}

function segCtl() {
  return `<div class="seg"><button type="button" data-mode="fill" class="${addMode === 'fill' ? 'on' : ''}">⛽ ${t('fill')}</button><button type="button" data-mode="expense" class="${addMode === 'expense' ? 'on' : ''}">💳 ${t('expense')}</button></div>`;
}
const f0 = x => (x === '' || x == null ? '' : x);
function vAddFill() {
  const e = editing && editing.kind === 'fill' ? S.live('fill').find(x => x.id === editing.id) : null;
  const last = compute(myFills()).list.slice(-1)[0];
  const v = e || { date: today(), odo: '', liters: '', price: '', total: '', full: true, fuel: last ? last.fuel : 'SP95', note: '' };
  return `<form id="addForm" class="card" autocomplete="off">
    <h2>${e ? t('editFill') : t('newFill')}</h2>
    <label>${t('date')}</label><input type="date" name="date" value="${esc(v.date)}" required>
    <label>${t('odo')}</label><input name="odo" inputmode="numeric" value="${esc(f0(v.odo))}" placeholder="${last ? esc(last.odo) : ''}" required>
    <div class="row">
      <div><label>${t('liters')}</label><input name="liters" inputmode="decimal" value="${esc(f0(v.liters))}" required></div>
      <div><label>${t('price')} (${esc(cur())})</label><input name="price" inputmode="decimal" value="${esc(v.liters ? (v.total / v.liters).toFixed(3) : '')}"></div>
    </div>
    <label>${t('total')} (${esc(cur())})</label><input name="total" inputmode="decimal" value="${esc(f0(v.total))}" required>
    <label>${t('fuel')}</label><select name="fuel">${FUELS.map(x => `<option ${x === v.fuel ? 'selected' : ''}>${x}</option>`).join('')}</select>
    <label class="chk"><input type="checkbox" name="full" ${v.full ? 'checked' : ''}>${t('full')}</label>
    <label>${t('note')}</label><input name="note" value="${esc(v.note)}">
    <button class="pri" type="submit">${t('save')}</button>
    ${e ? `<button class="sec" type="button" data-act="cancel" style="margin-top:10px">${t('cancel')}</button>` : ''}
  </form>`;
}
function vAddExp() {
  const e = editing && editing.kind === 'expense' ? S.live('expense').find(x => x.id === editing.id) : null;
  const v = e || { date: today(), category: 'maintenance', amount: '', odo: '', note: '' };
  return `<form id="expForm" class="card" autocomplete="off">
    <h2>${e ? t('editExp') : t('newExp')}</h2>
    <label>${t('date')}</label><input type="date" name="date" value="${esc(v.date)}" required>
    <label>${t('category')}</label><select name="category">${S.CATS.map(k => `<option value="${k}" ${k === v.category ? 'selected' : ''}>${t('cat_' + k)}</option>`).join('')}</select>
    <label>${t('amount')} (${esc(cur())})</label><input name="amount" inputmode="decimal" value="${esc(f0(v.amount))}" required>
    <label>${t('odoOpt')}</label><input name="odo" inputmode="numeric" value="${esc(f0(v.odo))}">
    <label>${t('note')}</label><input name="note" value="${esc(v.note)}">
    <button class="pri" type="submit">${t('save')}</button>
    ${e ? `<button class="sec" type="button" data-act="cancel" style="margin-top:10px">${t('cancel')}</button>` : ''}
  </form>`;
}
const vAdd = () => (editing ? '' : segCtl()) + (addMode === 'fill' ? vAddFill() : vAddExp());

function inPeriod(date, p) {
  const now = today(), y = +now.slice(0, 4), m = +now.slice(5, 7);
  const ym = d => d.slice(0, 7);
  switch (p) {
    case 'month': return ym(date) === ym(now);
    case 'last': { const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y; return ym(date) === `${py}-${String(pm).padStart(2, '0')}`; }
    case '3m': { const d = new Date(now + 'T12:00:00'); d.setMonth(d.getMonth() - 3); return date >= iso(d); }
    case 'year': return date.slice(0, 4) === String(y);
    case 'lastyear': return date.slice(0, 4) === String(y - 1);
    default: return true;
  }
}
function sel(id, opts, cur_) { return `<select data-filter="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur_ ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`; }
function vHist() {
  const c = compute(myFills());
  let items = [
    ...c.list.map(x => ({ ...x, kind: 'fill' })),
    ...myExp().map(x => ({ ...x, kind: 'expense' })),
  ];
  items = items.filter(x => inPeriod(x.date, filters.period)
    && (filters.type === 'all' || (filters.type === 'fills') === (x.kind === 'fill'))
    && (x.kind !== 'fill' || filters.fuel === 'all' || x.fuel === filters.fuel)
    && (x.kind !== 'expense' || filters.cat === 'all' || x.category === filters.cat));
  items.sort((a, b) => b.date.localeCompare(a.date) || (b.odo || 0) - (a.odo || 0));
  const total = items.reduce((s, x) => s + (x.kind === 'fill' ? x.total : x.amount), 0);
  const liters = items.reduce((s, x) => s + (x.kind === 'fill' ? x.liters : 0), 0);
  const showFuel = filters.type !== 'expenses', showCat = filters.type !== 'fills';
  const bar = `<div class="card filters">
    <div>${sel('type', [['all', t('all')], ['fills', t('tFills')], ['expenses', t('tExp')]], filters.type)}</div>
    <div>${sel('period', [['all', t('pAll')], ['month', t('pMonth')], ['last', t('pLast')], ['3m', t('p3m')], ['year', t('pYear')], ['lastyear', t('pLastYear')]], filters.period)}</div>
    ${showFuel ? `<div>${sel('fuel', [['all', t('fFuel') + ' : ' + t('allF')], ...FUELS.map(f => [f, f])], filters.fuel)}</div>` : ''}
    ${showCat ? `<div>${sel('cat', [['all', t('fCat') + ' : ' + t('allF')], ...S.CATS.map(k => [k, t('cat_' + k)])], filters.cat)}</div>` : ''}
    <div class="sum">${items.length} ${t('sumLine')} · <b>${money(total)}</b>${liters ? ` · ${num(liters)} L` : ''}</div>
  </div>`;
  if (!items.length) return bar + `<div class="empty">${t('emptyHist')}</div>`;
  return bar + `<div class="card">${items.map(x => x.kind === 'fill' ? `<div class="item">
    <div><b>⛽ ${fmtDate(x.date)}</b>${x.cons != null ? `<span class="badge">${num(x.cons)} L/100</span>` : ''}
      <div class="mut">${num(x.odo, 0)} ${t('km')} · ${esc(x.fuel)}${x.full ? '' : ' · ½'}${x.note ? ' · ' + esc(x.note) : ''}</div>
      <div class="acts"><button data-act="edit" data-kind="fill" data-id="${esc(x.id)}">${t('edit')}</button><button class="d" data-act="del" data-kind="fill" data-id="${esc(x.id)}">${t('del')}</button></div></div>
    <div class="r"><b>${money(x.total)}</b><div class="mut">${num(x.liters)} L · ${num(x.total / x.liters, 3)}</div></div></div>`
    : `<div class="item">
    <div><b>💳 ${fmtDate(x.date)}</b><span class="badge o">${t('cat_' + x.category)}</span>
      <div class="mut">${x.odo != null ? num(x.odo, 0) + ' ' + t('km') : ''}${x.note ? (x.odo != null ? ' · ' : '') + esc(x.note) : ''}</div>
      <div class="acts"><button data-act="edit" data-kind="expense" data-id="${esc(x.id)}">${t('edit')}</button><button class="d" data-act="del" data-kind="expense" data-id="${esc(x.id)}">${t('del')}</button></div></div>
    <div class="r"><b>${money(x.amount)}</b></div></div>`).join('')}</div>`;
}

/* ---------- prix autour de moi ---------- */
function vPrice() {
  if (!prices.fuel) { const l = compute(myFills()).list.slice(-1)[0]; prices.fuel = l ? l.fuel : 'E10'; }
  let out = '';
  if (prices.state === 'loading') out = `<div class="empty">${esc(prices.msg)}</div>`;
  else if (prices.state === 'error') out = `<div class="empty">${esc(prices.msg)}</div>`;
  else if (prices.state === 'done') {
    out = prices.list.length ? `<div class="card">${prices.list.map((s, i) => `<div class="item">
      <div><b>${i + 1}. ${esc(s.adresse)}</b><div class="mut">${esc(s.cp)} ${esc(s.ville)} · ${num(s.dist, 1)} km${s.maj ? ' · ' + t('updated') + ' ' + esc(String(s.maj).slice(0, 10)) : ''}</div>
      <div class="acts"><a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}" target="_blank" rel="noopener">${t('map')}</a></div></div>
      <div class="r"><b>${num(s.prix, 3)} ${esc(cur())}</b></div></div>`).join('')}</div>` : `<div class="empty">${t('noStation')}</div>`;
    out += `<div class="mut" style="text-align:center">${t('priceSrc')}</div>`;
  }
  return `<div class="card"><h2>${t('priceT')}</h2><div class="row">
    <div><label>${t('fuel')}</label><select id="pFuel">${FUELS.map(f => `<option ${f === prices.fuel ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
    <div><label>${t('radius')}</label><select id="pRad">${[5, 10, 20, 30].map(r => `<option value="${r}" ${r === prices.radius ? 'selected' : ''}>${r} km</option>`).join('')}</select></div></div>
    <button class="pri" data-act="search">📍 ${t('search')}</button></div>${out}`;
}
const km = (la1, lo1, la2, lo2) => { const r = Math.PI / 180, a = Math.sin((la2 - la1) * r / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(a)); };
function searchPrices() {
  const field = FUEL_FIELD[prices.fuel];
  prices.state = 'loading'; prices.msg = t('locating'); render();
  if (!navigator.geolocation) { prices.state = 'error'; prices.msg = t('geoDenied'); return render(); }
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    prices.msg = t('loading'); render();
    try {
      const q = new URLSearchParams({ where: `within_distance(geom, geom'POINT(${lon} ${lat})', ${prices.radius}km) and ${field} is not null`, limit: '100' });
      const r = await fetch(`${PRICE_API}?${q}`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      prices.list = (j.results || []).map(x => {
        const g = x.geom || {}, la = Number(g.lat ?? x.latitude / 100000), lo = Number(g.lon ?? x.longitude / 100000);
        return { adresse: x.adresse || '', ville: x.ville || '', cp: x.cp || '', prix: Number(x[field]), maj: x[field.replace('_prix', '_maj')], lat: la, lon: lo, dist: km(lat, lon, la, lo) };
      }).filter(s => isFinite(s.prix) && isFinite(s.dist)).sort((a, b) => a.prix - b.prix).slice(0, 15);
      prices.state = 'done';
    } catch (e) { prices.state = 'error'; prices.msg = t('priceErr'); }
    if (tab === 'price') render();
  }, err => { prices.state = 'error'; prices.msg = err && err.code === 1 ? t('geoDenied') : t('priceErr'); if (tab === 'price') render(); }, { enableHighAccuracy: false, timeout: 15000 });
}

/* ---------- réglages ---------- */
const ago = ts => (ts ? new Date(ts).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : '—');
function syncLink() { const s = data.settings.sync; return location.origin + location.pathname + '#sync=' + btoa(JSON.stringify({ u: s.url, a: s.anon, k: s.key })); }
function syncActionsHtml() {
  return S.sync.configured() ? `<button class="sec" data-act="copyLink">${t('copyLink')}</button><button class="sec" data-act="syncNow">${t('syncNow')}</button><div class="mut" style="margin-top:6px">${t('linkWarn')}</div>` : '';
}
function syncStatusHtml() {
  const ss = S.sync.status();
  const txt = { off: t('stOff'), syncing: t('stSyncing'), ok: `${t('stOk')} (${t('last')} ${ago(ss.last)})`, error: `${t('stError')} ${esc(ss.err)}` }[ss.s];
  return `<div class="status ${ss.s}">☁️ ${txt}</div>`;
}
function backupBtnsHtml() {
  if (!S.backup.supported) return '';
  const bs = S.backup.status();
  return `<div style="margin-top:10px"><button class="sec" data-act="bChoose">${t('bChoose')}</button>${bs.s === 'needperm' ? `<button class="sec" data-act="bReconnect">${t('bReconnect')}</button>` : ''}${bs.s !== 'none' ? `<button class="sec danger" data-act="bStop">${t('bStop')}</button>` : ''}</div>`;
}
function backupStatusHtml() {
  const bs = S.backup.status();
  const txt = { none: t('bNone'), unsupported: t('bUnsupported'), ok: `${t('bOk')}${bs.last ? ' · ' + ago(bs.last) : ''}`, needperm: t('bNeed'), error: t('bErr') }[bs.s];
  return `<div class="status ${bs.s}">💾 ${txt}</div>`;
}
// met à jour uniquement les blocs d'état, jamais les champs de saisie
function paintStatus() {
  const set = (id, html) => { const el = document.getElementById(id); if (el && el.innerHTML !== html) el.innerHTML = html; };
  set('syncActions', syncActionsHtml()); set('syncStatus', syncStatusHtml());
  set('backupBtns', backupBtnsHtml()); set('backupStatus', backupStatusHtml());
}
function vSet() {
  const v = vehicle(), sy = data.settings.sync;
  const vehs = data.vehicles.filter(x => !x.deleted);
  return `<div class="card"><h2>${t('vehicles')}</h2>
    ${vehs.map(x => `<div class="item"><div><b>${esc(x.name)}</b>${x.id === vid() ? `<span class="badge">${t('active')}</span>` : ''}</div>
      <div>${x.id !== vid() ? `<button class="sec" data-act="useVeh" data-id="${esc(x.id)}">${t('use')}</button>` : ''}${vehs.length > 1 ? `<button class="sec danger" data-act="delVeh" data-id="${esc(x.id)}">${t('del')}</button>` : ''}</div></div>`).join('')}
    <label>${t('vehicle')}</label><input id="sVehicle" value="${esc(v.name)}">
    <div class="row"><div><label>${t('monthBudget')}</label><input id="sBudget" inputmode="decimal" value="${esc(v.budget)}"></div>
    <div><label>${t('currency')}</label><input id="sCur" value="${esc(cur())}" maxlength="4"></div></div>
    <button class="sec" data-act="addVeh" style="margin-top:14px">+ ${t('addVehicle')}</button>
  </div>
  <div class="card"><h2>${t('syncT')}</h2>
    <div class="mut">${t('syncIntro')}</div>
    <div class="mut" style="margin-top:8px">${t('syncStep1')}<br>${t('syncStep2')}<br>${t('syncStep3')}<br>${t('syncStep4')}</div>
    <button class="sec" data-act="copySql" style="margin-top:10px">${t('copySql')}</button>
    <label>${t('pasteLink')}</label><input id="sLink" placeholder="https://…#sync=…" autocapitalize="off" spellcheck="false">
    <label>${t('sUrl')}</label><input id="sUrl" value="${esc(sy.url)}" placeholder="https://xxxx.supabase.co" autocapitalize="off" spellcheck="false">
    <label>${t('sAnon')}</label><input id="sAnon" value="${esc(sy.anon)}" autocapitalize="off" spellcheck="false">
    <label>${t('sKey')}</label><input id="sKey" value="${esc(sy.key)}" autocapitalize="off" spellcheck="false">
    <button class="sec" data-act="genKey" style="margin-top:10px">${t('genKey')}</button>
    <span id="syncActions">${syncActionsHtml()}</span>
    <div id="syncStatus" style="margin-top:10px">${syncStatusHtml()}</div>
  </div>
  <div class="card"><h2>${t('backupT')}</h2><div class="mut">${t('backupText')}</div>
    <div id="backupBtns">${backupBtnsHtml()}</div>
    <div id="backupStatus" style="margin-top:10px">${backupStatusHtml()}</div>
  </div>
  <div class="card"><h2>${t('data')}</h2>
    <button class="sec" data-act="expJson">${t('exportJson')}</button>
    <button class="sec" data-act="impJson">${t('importJson')}</button>
    <button class="sec" data-act="expCsv">${t('exportCsv')}</button>
    <button class="sec danger" data-act="reset">${t('reset')}</button>
    <input type="file" id="file" accept="application/json,.json" hidden>
  </div>`;
}

/* ---------- rendu ---------- */
const TABS = [['dash', '📊'], ['add', '➕'], ['hist', '📜'], ['price', '📍'], ['set', '⚙️']];
function renderHeader() {
  document.documentElement.lang = lang();
  const vehs = data.vehicles.filter(x => !x.deleted);
  const ss = S.sync.status();
  $('#vehSlot').innerHTML = vehs.length > 1
    ? `<select id="vehSel" aria-label="${t('vehicles')}">${vehs.map(x => `<option value="${esc(x.id)}" ${x.id === vid() ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
    : `<h1>⛽ ${esc(vehs[0].name)}</h1>`;
  const sb = $('#syncBtn');
  sb.hidden = !S.sync.configured();
  sb.className = 'ghost ' + ss.s;
  sb.textContent = ss.s === 'error' ? '⚠️' : '☁️';
  $('#langBtn').textContent = lang() === 'fr' ? 'EN' : 'FR';
  $('#tabs').innerHTML = TABS.map(([k, ic]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}"><span>${ic}</span>${t(k === 'price' ? 'tabPrice' : k)}</button>`).join('');
}
function render() {
  renderHeader();
  view.innerHTML = { dash: vDash, add: vAdd, hist: vHist, price: vPrice, set: vSet }[tab]();
}
function go(k) { tab = k; if (k !== 'add') editing = null; render(); window.scrollTo(0, 0); }

S.on(kind => {
  if (kind === 'data') { if (tab !== 'add') render(); else renderHeader(); }
  else { renderHeader(); if (tab === 'set') paintStatus(); }
});

/* ---------- export ---------- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function exportCsv() {
  const rows = [['vehicle', 'type', 'date', 'odometer', 'liters', 'price_per_liter', 'amount', 'full', 'fuel', 'category', 'note']];
  const name = id => (data.vehicles.find(v => v.id === id) || {}).name || '';
  S.live('fill').sort((a, b) => a.date.localeCompare(b.date)).forEach(x => rows.push([name(x.vehicleId), 'fill', x.date, x.odo, x.liters, (x.total / x.liters).toFixed(3), x.total, x.full ? 1 : 0, x.fuel, '', x.note]));
  S.live('expense').sort((a, b) => a.date.localeCompare(b.date)).forEach(x => rows.push([name(x.vehicleId), 'expense', x.date, x.odo ?? '', '', '', x.amount, '', '', x.category, x.note]));
  download(`fuel-log-${today()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}
const copy = async (txt, ok) => { try { await navigator.clipboard.writeText(txt); toast(ok || t('copied')); } catch (e) { prompt('Copy:', txt); } };

/* ---------- événements ---------- */
document.addEventListener('click', ev => {
  const tb = ev.target.closest('[data-tab]'); if (tb) return go(tb.dataset.tab);
  if (ev.target.closest('#langBtn')) { data.settings.lang = lang() === 'fr' ? 'en' : 'fr'; S.persist(); return render(); }
  if (ev.target.closest('#syncBtn')) { S.sync.now(); return toast(t('stSyncing')); }
  const md = ev.target.closest('[data-mode]'); if (md) { addMode = md.dataset.mode; return render(); }
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'edit': editing = { kind: b.dataset.kind, id }; addMode = b.dataset.kind; tab = 'add'; render(); window.scrollTo(0, 0); break;
    case 'cancel': go('hist'); break;
    case 'del': if (confirm(t('confirmDel'))) { S.remove(b.dataset.kind, id); render(); toast(t('deleted')); } break;
    case 'search': searchPrices(); break;
    case 'useVeh': data.settings.activeVehicle = id; S.persist(); render(); break;
    case 'delVeh': if (confirm(t('confirmDelVeh'))) {
      S.live('fill').filter(x => x.vehicleId === id).forEach(x => S.remove('fill', x.id));
      S.live('expense').filter(x => x.vehicleId === id).forEach(x => S.remove('expense', x.id));
      S.remove('vehicle', id); if (vid() === id) data.settings.activeVehicle = data.vehicles.find(v => !v.deleted).id; S.persist(); render();
    } break;
    case 'addVeh': { const n = (prompt(t('vehName')) || '').trim(); if (n) { const rec = { id: S.uid(), name: n.slice(0, 60), budget: 150 }; S.upsert('vehicle', rec); data.settings.activeVehicle = rec.id; S.persist(); render(); } break; }
    case 'copySql': copy(SQL); break;
    case 'genKey': { const k = S.sync.genKey(); $('#sKey').value = k; S.sync.set({ url: $('#sUrl').value.trim(), anon: $('#sAnon').value.trim(), key: k }); paintStatus(); break; }
    case 'copyLink': copy(syncLink()); break;
    case 'syncNow': S.sync.now(); toast(t('stSyncing')); break;
    case 'bChoose': S.backup.choose().catch(() => {}); break;
    case 'bReconnect': S.backup.reconnect(); break;
    case 'bStop': S.backup.stop(); break;
    case 'expJson': download(`fuel-log-${today()}.json`, JSON.stringify(S.exportData(), null, 2), 'application/json'); break;
    case 'expCsv': exportCsv(); break;
    case 'impJson': $('#file').click(); break;
    case 'reset': if (confirm(t('confirmReset'))) { S.resetAll(); render(); } break;
  }
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'file') {
    const file = el.files[0]; if (!file) return;
    file.text().then(txt => {
      try {
        const j = JSON.parse(txt);
        if (!j || !Array.isArray(j.fills)) throw 0;
        const n = S.importData(j); render(); toast(`${n} ${t('imported')}`);
      } catch (e) { toast(t('importErr')); }
    });
    return;
  }
  if (el.dataset.filter) { filters[el.dataset.filter] = el.value; return render(); }
  if (el.id === 'vehSel') { data.settings.activeVehicle = el.value; S.persist(); return render(); }
  if (el.id === 'pFuel') { prices.fuel = el.value; return; }
  if (el.id === 'pRad') { prices.radius = +el.value; return; }
  if (el.id === 'sLink') {
    try {
      const m = el.value.match(/#sync=([^\s]+)/); const c = JSON.parse(atob(m[1]));
      if (!c.u || !c.a || !c.k) throw 0;
      S.sync.set({ url: String(c.u), anon: String(c.a), key: String(c.k) }); render(); toast(t('saved'));
    } catch (e) { toast(t('importErr')); }
    return;
  }
  const v = vehicle();
  if (el.id === 'sVehicle') { v.name = el.value.trim() || v.name; S.upsert('vehicle', v); renderHeader(); toast(t('saved')); }
  else if (el.id === 'sBudget') { v.budget = parse(el.value) || 0; S.upsert('vehicle', v); toast(t('saved')); }
  else if (el.id === 'sCur') { data.settings.currency = el.value.trim() || '€'; S.persist(); toast(t('saved')); }
  else if (el.id === 'sUrl' || el.id === 'sAnon' || el.id === 'sKey') {
    S.sync.set({ url: $('#sUrl').value, anon: $('#sAnon').value, key: $('#sKey').value.trim() });
    $('#sUrl').value = data.settings.sync.url; $('#sAnon').value = data.settings.sync.anon;
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
  const id = ev.target.id;
  if (id !== 'addForm' && id !== 'expForm') return;
  ev.preventDefault();
  const f = ev.target.elements;
  if (id === 'addForm') {
    const odo = parse(f.odo.value), liters = parse(f.liters.value), total = parse(f.total.value);
    if (!(odo >= 0) || !(liters > 0) || !(total > 0) || !f.date.value) return toast(t('errFields'));
    S.upsert('fill', { id: editing ? editing.id : S.uid(), vehicleId: vid(), date: f.date.value, odo, liters, total, full: f.full.checked, fuel: f.fuel.value, note: f.note.value.trim() });
  } else {
    const amount = parse(f.amount.value), odo = parse(f.odo.value);
    if (!(amount > 0) || !f.date.value) return toast(t('errFields'));
    S.upsert('expense', { id: editing ? editing.id : S.uid(), vehicleId: vid(), date: f.date.value, category: f.category.value, amount, odo: odo >= 0 ? odo : null, note: f.note.value.trim() });
  }
  editing = null; toast(t('saved')); go('dash');
});

/* ---------- lien de configuration de synchro ---------- */
(function applySyncHash() {
  const m = location.hash.match(/^#sync=(.+)$/); if (!m) return;
  try {
    const c = JSON.parse(atob(m[1]));
    history.replaceState(null, '', location.pathname + location.search);
    if (c.u && c.a && c.k && confirm(t('applySync'))) { S.sync.set({ url: String(c.u), anon: String(c.a), key: String(c.k) }); tab = 'set'; }
  } catch (e) {}
})();

render();
S.sync.now();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
