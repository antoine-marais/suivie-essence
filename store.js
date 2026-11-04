/* Données, migration, fusion, synchro (Supabase) et sauvegarde fichier. */
(() => {
'use strict';
const KEY = 'fuellog.v2', OLD = 'fuellog.v1';
const CATS = ['maintenance', 'repair', 'insurance', 'toll', 'parking', 'tires', 'tax', 'other'];
const DEFAULT_VEHICLE = 'v-default';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const defaults = () => ({
  settings: {
    lang: (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en',
    currency: '€', activeVehicle: DEFAULT_VEHICLE,
    sync: { url: '', anon: '', key: '', last: 0 },
  },
  vehicles: [], fills: [], expenses: [],
});

/* ---------- nettoyage des enregistrements (import / synchro) ---------- */
const fin = v => Number.isFinite(Number(v)) && v !== '' && v !== null;
const base = x => ({ id: String(x.id), updatedAt: fin(x.updatedAt) ? Number(x.updatedAt) : 0, deleted: !!x.deleted });
function cleanFill(x) {
  if (!x || !x.id || !x.date || !fin(x.odo) || !fin(x.liters) || !fin(x.total)) return null;
  return { ...base(x), vehicleId: String(x.vehicleId || DEFAULT_VEHICLE), date: String(x.date).slice(0, 10), odo: +x.odo, liters: +x.liters, total: +x.total, full: !!x.full, fuel: String(x.fuel || 'SP95'), note: String(x.note || '') };
}
function cleanExpense(x) {
  if (!x || !x.id || !x.date || !fin(x.amount)) return null;
  return { ...base(x), vehicleId: String(x.vehicleId || DEFAULT_VEHICLE), date: String(x.date).slice(0, 10), amount: +x.amount, category: CATS.includes(x.category) ? x.category : 'other', odo: fin(x.odo) ? +x.odo : null, note: String(x.note || '') };
}
function cleanVehicle(x) {
  if (!x || !x.id) return null;
  return { ...base(x), name: String(x.name || '').slice(0, 60), budget: fin(x.budget) ? +x.budget : 0 };
}

/* ---------- chargement + migration ---------- */
function ensureVehicle(d) {
  if (!d.vehicles.some(v => !v.deleted)) {
    const ex = d.vehicles.find(v => v.id === DEFAULT_VEHICLE);
    if (ex) { ex.deleted = false; ex.updatedAt = Date.now(); }
    else d.vehicles.push({ id: DEFAULT_VEHICLE, name: d.settings.lang === 'fr' ? 'Ma voiture' : 'My car', budget: 150, updatedAt: 1, deleted: false });
  }
  if (!d.vehicles.some(v => v.id === d.settings.activeVehicle && !v.deleted)) d.settings.activeVehicle = d.vehicles.find(v => !v.deleted).id;
}
function migrateV1() {
  try {
    const o = JSON.parse(localStorage.getItem(OLD));
    if (!o || !Array.isArray(o.fills)) return null;
    const d = defaults(); const s = o.settings || {};
    if (s.lang) d.settings.lang = s.lang;
    if (s.currency) d.settings.currency = s.currency;
    d.vehicles.push({ id: DEFAULT_VEHICLE, name: s.vehicle || (d.settings.lang === 'fr' ? 'Ma voiture' : 'My car'), budget: fin(s.budget) ? +s.budget : 150, updatedAt: Date.now(), deleted: false });
    d.fills = o.fills.map(f => cleanFill({ ...f, vehicleId: DEFAULT_VEHICLE, updatedAt: Date.now() })).filter(Boolean);
    return d;
  } catch (e) { return null; }
}
function load() {
  let d = null;
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.fills)) {
      d = defaults();
      Object.assign(d.settings, r.settings || {});
      d.settings.sync = { ...defaults().settings.sync, ...(r.settings && r.settings.sync) };
      d.vehicles = (r.vehicles || []).map(cleanVehicle).filter(Boolean);
      d.fills = r.fills.map(cleanFill).filter(Boolean);
      d.expenses = (r.expenses || []).map(cleanExpense).filter(Boolean);
    }
  } catch (e) {}
  if (!d) d = migrateV1() || defaults();
  ensureVehicle(d);
  return d;
}
const data = load();

/* ---------- événements ---------- */
const subs = [];
const emit = kind => subs.forEach(f => { try { f(kind); } catch (e) {} });

/* ---------- persistance ---------- */
function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
function save() { persist(); scheduleSync(); scheduleBackup(); }

/* ---------- mutations ---------- */
const COLL = { vehicle: 'vehicles', fill: 'fills', expense: 'expenses' };
function upsert(kind, rec) {
  const arr = data[COLL[kind]];
  rec.updatedAt = Date.now(); rec.deleted = false;
  const i = arr.findIndex(x => x.id === rec.id);
  if (i >= 0) arr[i] = rec; else arr.push(rec);
  save();
}
function remove(kind, id) {
  const x = data[COLL[kind]].find(r => r.id === id);
  if (x) { x.deleted = true; x.updatedAt = Date.now(); ensureVehicle(data); save(); }
}
const live = kind => data[COLL[kind]].filter(x => !x.deleted);
const forVehicle = (kind, vid) => live(kind).filter(x => kind === 'vehicle' || x.vehicleId === vid);

/* ---------- fusion ---------- */
function mergeColl(local, remote, clean) {
  const m = new Map(local.map(x => [x.id, x]));
  let changed = 0;
  for (const raw of Array.isArray(remote) ? remote : []) {
    const r = clean(raw); if (!r) continue;
    const l = m.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) { m.set(r.id, r); changed++; }
  }
  return { list: [...m.values()], changed };
}
function mergeData(src) {
  const a = mergeColl(data.vehicles, src.vehicles, cleanVehicle);
  const b = mergeColl(data.fills, src.fills, cleanFill);
  const c = mergeColl(data.expenses, src.expenses, cleanExpense);
  data.vehicles = a.list; data.fills = b.list; data.expenses = c.list;
  ensureVehicle(data);
  return a.changed + b.changed + c.changed;
}
const payload = () => ({ v: 2, vehicles: data.vehicles, fills: data.fills, expenses: data.expenses });
const exportData = () => ({ v: 2, vehicles: data.vehicles.filter(x => !x.deleted), fills: live('fill'), expenses: live('expense') });
function importData(j) { const n = mergeData(j); persist(); save(); return n; }
function resetAll() {
  // on marque tout comme supprimé (et non vidé), pour que la synchro efface aussi les autres appareils
  const t = Date.now();
  [...data.vehicles, ...data.fills, ...data.expenses].forEach(x => { x.deleted = true; x.updatedAt = t; });
  data.settings.activeVehicle = DEFAULT_VEHICLE; ensureVehicle(data); save();
}

/* ---------- synchro Supabase ---------- */
let syncStatus = 'off', syncErr = '', syncing = false, again = false, syncTimer = null;
const syncCfg = () => data.settings.sync;
const syncConfigured = () => { const s = syncCfg(); return !!(s.url && s.anon && s.key && s.key.length >= 32); };
function setSync(st, err = '') { syncStatus = st; syncErr = err; emit('status'); }
async function rpc(fn, args) {
  const s = syncCfg();
  const r = await fetch(s.url.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    // ancienne clé « anon » = JWT (eyJ…) : on l'envoie aussi en Bearer ; la nouvelle clé « sb_publishable_… » ne va que dans apikey
    headers: { apikey: s.anon, ...(s.anon.startsWith('eyJ') ? { Authorization: 'Bearer ' + s.anon } : {}), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const txt = await r.text();
  return txt ? JSON.parse(txt) : null;
}
async function syncNow() {
  if (!syncConfigured()) { setSync('off'); return; }
  if (syncing) { again = true; return; }
  syncing = true; setSync('syncing');
  let changed = 0;
  try {
    const remote = await rpc('fuel_get', { p_key: syncCfg().key });
    if (remote && typeof remote === 'object') changed = mergeData(remote);
    await rpc('fuel_put', { p_key: syncCfg().key, p_data: payload() });
    syncCfg().last = Date.now(); persist(); setSync('ok');
  } catch (e) { setSync('error', String(e.message || e)); }
  finally {
    syncing = false;
    if (changed) { persist(); scheduleBackup(); emit('data'); }
    if (again) { again = false; syncNow(); }
  }
}
function scheduleSync() { if (!syncConfigured()) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 1200); }
const genKey = () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); };
function setSyncConfig(c) { Object.assign(syncCfg(), c); persist(); if (syncConfigured()) syncNow(); else setSync('off'); }
window.addEventListener('online', () => syncNow());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });

/* ---------- sauvegarde automatique dans un fichier (Chrome / Edge bureau) ---------- */
const hasBackup = 'showSaveFilePicker' in window;
let bHandle = null, bStatus = hasBackup ? 'none' : 'unsupported', bLast = 0, bTimer = null;
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('fuellog', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async k => { const db = await idb(); return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); };
const idbSet = async (k, v) => { const db = await idb(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); };
async function backupWrite() {
  if (!bHandle) return;
  try {
    if ((await bHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') { bStatus = 'needperm'; return emit('status'); }
    const w = await bHandle.createWritable();
    await w.write(JSON.stringify(exportData(), null, 2)); await w.close();
    bStatus = 'ok'; bLast = Date.now();
  } catch (e) { bStatus = 'error'; }
  emit('status');
}
function scheduleBackup() { if (!bHandle) return; clearTimeout(bTimer); bTimer = setTimeout(backupWrite, 1500); }
async function backupChoose() {
  const h = await window.showSaveFilePicker({ suggestedName: 'fuel-log-backup.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
  bHandle = h; await idbSet('backup', h); await backupWrite();
}
async function backupReconnect() {
  if (bHandle && (await bHandle.requestPermission({ mode: 'readwrite' })) === 'granted') backupWrite();
}
async function backupStop() { bHandle = null; bStatus = 'none'; await idbSet('backup', null); emit('status'); }
if (hasBackup) idbGet('backup').then(h => { if (h) { bHandle = h; bStatus = 'needperm'; h.queryPermission({ mode: 'readwrite' }).then(p => { if (p === 'granted') { bStatus = 'ok'; } emit('status'); }); } }).catch(() => {});

window.Store = {
  data, CATS, DEFAULT_VEHICLE, uid, save, persist, upsert, remove, live, forVehicle,
  exportData, importData, resetAll, on: f => subs.push(f),
  sync: { now: syncNow, set: setSyncConfig, genKey, configured: syncConfigured, status: () => ({ s: syncStatus, err: syncErr, last: syncCfg().last }) },
  backup: { supported: hasBackup, choose: backupChoose, reconnect: backupReconnect, stop: backupStop, status: () => ({ s: bStatus, last: bLast }) },
};
})();
