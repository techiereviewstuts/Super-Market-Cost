'use strict';
/* ---------- Βοηθητικά ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const eur = n => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'];
const MSHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800); }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function parseAmount(s) {
  s = String(s).trim().replace(/\s/g, '').replace('€', '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/* ---------- Δεδομένα ---------- */
const KEY = 'sm_data_v1';
let db = load();
function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.entries) { d.stores = d.stores || {}; d.deleted = d.deleted || []; return d; } } catch { }
  return { entries: [], deleted: [], stores: {} };
}
function save(markDirty = true) {
  localStorage.setItem(KEY, JSON.stringify(db));
  if (markDirty) { localStorage.setItem('sm_dirty', '1'); autoBackup(); }
  render();
}
function merge(remote) {
  const del = new Set([...(db.deleted || []), ...(remote.deleted || [])]);
  const map = new Map();
  for (const e of [...db.entries, ...(remote.entries || [])]) {
    if (del.has(e.id)) continue;
    const o = map.get(e.id);
    if (!o || (e.u || 0) > (o.u || 0)) map.set(e.id, e);
  }
  db = { entries: [...map.values()], deleted: [...del], stores: { ...(remote.stores || {}), ...(db.stores || {}) } };
}
/* πηγή & επαλήθευση: 'pdf' (με ΜΑΡΚ) = επαληθευμένο, 'photo' = OCR, 'manual' = χειροκίνητο */
const srcOf = e => e.src || (e.mark ? 'pdf' : 'old');
const isVer = e => srcOf(e) === 'pdf';
const storeName = e => (e.biz?.afm && db.stores?.[e.biz.afm]?.name) || e.biz?.name || e.note || '';
const CATS = { super: '🛒 SuperMarket', mini: '🏪 MiniMarket', fuel: '⛽ Βενζίνη', meat: '🥩 Κρέατα', greens: '🥬 Μανάβικο', other: '📦 Άλλο' };
const catOf = e => (CATS[e.cat] ? e.cat : 'super');
let chartCat = 'all';
const sumRange = (a, b, cat = 'all') => db.entries.filter(e => e.date >= a && e.date <= b && (cat === 'all' || catOf(e) === cat)).reduce((s, e) => s + e.amount, 0);

/* ---------- Πλοήγηση ---------- */
function showTab(name) {
  $$('nav button').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  render(); scrollTo(0, 0);
}
$$('nav button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

/* ---------- Απόδοση ---------- */
let yearSel = new Date().getFullYear();
function render() {
  const now = new Date(), today = ymd(now);
  const mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  $('#sumDay').textContent = eur(sumRange(today, today));
  $('#sumMonth').textContent = eur(sumRange(mk + '-01', mk + '-31'));
  $('#sumYear').textContent = eur(sumRange(`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`));
  $('#monthLbl').textContent = MONTHS[now.getMonth()];
  $('#yearLbl').textContent = 'Έτος ' + now.getFullYear();

  const sorted = sortEntries();
  $('#recent').innerHTML = listHtml(sorted.slice(0, 8));
  renderCharts();
  renderHistory(sorted);
  renderReport();
  // υπενθύμιση αναφοράς στις πρώτες ημέρες του μήνα
  const pv = new Date(now.getFullYear(), now.getMonth() - 1, 1), pk = `${pv.getFullYear()}-${pad(pv.getMonth() + 1)}`;
  const show = now.getDate() <= 7 && localStorage.getItem('sm_rep_seen') !== pk && db.entries.some(e => e.date.startsWith(pk));
  const bn = $('#repBanner'); bn.hidden = !show; bn.dataset.k = pk; bn.textContent = `📑 Η αναφορά ${['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'][pv.getMonth()]} είναι έτοιμη — πάτα για προβολή`;
  // υπενθύμιση συγχρονισμού: εκκρεμεί αντίγραφο εδώ και 7+ ημέρες (ή δεν έγινε ποτέ)
  const sb = $('#syncBanner');
  const lastSync = +localStorage.getItem('sm_sync_at') || 0;
  const stale = localStorage.getItem('sm_gconn') && localStorage.getItem('sm_dirty') && (!lastSync || Date.now() - lastSync >= 7 * 86400000);
  sb.hidden = !stale;
  if (stale) sb.textContent = lastSync ? `⚠️ Έχεις ${Math.floor((Date.now() - lastSync) / 86400000)} ημέρες χωρίς αντίγραφο στο Google Drive — πάτα για συγχρονισμό` : '⚠️ Δεν έχει γίνει ποτέ αντίγραφο στο Google Drive — πάτα για συγχρονισμό';
  $('#syncState').textContent = gState();
}
$('#repBanner').onclick = e => { const k = e.currentTarget.dataset.k; localStorage.setItem('sm_rep_seen', k); repKey = k; showTab('report'); };
$('#syncBanner').onclick = () => { toast('Συγχρονισμός…'); backupNow(true).then(() => toast('Το αντίγραφο ολοκληρώθηκε ✔')).catch(e => toast(e.message || e)); };
function listHtml(arr, withDelete = false) {
  if (!arr.length) return '<li class="empty">Δεν υπάρχουν καταχωρήσεις ακόμα</li>';
  return arr.map(e => {
    const sub = [storeName(e), e.biz ? e.note : '', e.items?.length ? e.items.length + ' προϊόντα' : ''].filter(Boolean).map(esc).join(' · ');
    return `<li data-id="${e.id}"><div class="ico">${CATS[catOf(e)].split(' ')[0]}</div><div class="mid"><div class="d">${parseYmd(e.date).toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${e.time ? ` · <b>${e.time}</b>` : ''}${isVer(e) ? ' · <span class="okv">✔ επαληθευμένο</span>' : ''}</div><div class="n">${CATS[catOf(e)].split(' ').slice(1).join(' ')}${sub ? ' · ' + sub : ''}</div></div><div class="a">${eur(e.amount)}</div>${withDelete ? `<button class="del" data-del="${e.id}" aria-label="Διαγραφή">🗑️</button>` : ''}</li>`;
  }).join('');
}
function deleteEntry(id, ask = true) {
  const e = db.entries.find(x => x.id === id); if (!e) return false;
  if (ask && !confirm(`Να διαγραφεί η καταχώρηση ${parseYmd(e.date).toLocaleDateString('el-GR')} · ${eur(e.amount)};`)) return false;
  db.entries = db.entries.filter(x => x.id !== id);
  db.deleted.push(id);
  save();            // ξαναϋπολογίζει σύνολα, γραφήματα και στατιστικά + νέο αντίγραφο
  toast('Διαγράφηκε ✔');
  return true;
}
document.addEventListener('click', ev => {
  const del = ev.target.closest('[data-del]');
  if (del) { ev.stopPropagation(); deleteEntry(del.dataset.del); return; }
  const li = ev.target.closest('.list li[data-id]'); if (li) openEntry(db.entries.find(e => e.id === li.dataset.id));
});

/* Ιστορικό */
function renderHistory(sorted) {
  const sel = $('#fMonth'), prev = sel.value;
  const months = [...new Set(sorted.map(e => e.date.slice(0, 7)))];
  sel.innerHTML = '<option value="all">Όλα</option>' + months.map(m => { const [y, mo] = m.split('-'); return `<option value="${m}">${MONTHS[+mo - 1]} ${y}</option>`; }).join('');
  sel.value = months.includes(prev) || prev === 'all' ? prev : (months[0] || 'all');
  const cat = $('#fCatH').value;
  const list = sorted.filter(e => (sel.value === 'all' || e.date.startsWith(sel.value)) && (cat === 'all' || catOf(e) === cat));
  $('#hTotal').textContent = eur(list.reduce((s, e) => s + e.amount, 0));
  $('#histList').innerHTML = listHtml(list, true);
}
$('#fMonth').onchange = $('#fCatH').onchange = () => renderHistory(sortEntries());
$('#chartCat').onchange = e => { chartCat = e.target.value; renderCharts(); };
$('#statPeriod').onchange = () => renderStats();
function sortEntries() { return [...db.entries].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || (b.u || 0) - (a.u || 0)); }

/* ---------- Γραφήματα ---------- */
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function barChart(el, buckets) {
  const W = 360, H = 210, L = 8, R = 8, T = 22, B = 30;
  const max = Math.max(...buckets.map(b => b.v), 1);
  const bw = (W - L - R) / buckets.length;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  buckets.forEach((b, i) => {
    const h = (b.v / max) * (H - T - B), x = L + i * bw + bw * .15, y = H - B - h;
    const p = i > 0 ? buckets[i - 1].v : null;
    const col = p === null || b.v === p ? '#16a34a' : (b.v > p ? '#ef4444' : '#16a34a');
    svg += `<rect data-i="${i}" x="${x}" y="${y}" width="${bw * .7}" height="${Math.max(h, b.v ? 1 : 0)}" rx="3" fill="${col}" opacity="${b.cur ? 1 : .8}"/>`;
    if (b.v) svg += `<text x="${x + bw * .35}" y="${y - 4}" font-size="${buckets.length > 8 ? 8 : 9}" text-anchor="middle" fill="currentColor">${Math.round(b.v)}</text>`;
    svg += `<text x="${x + bw * .35}" y="${H - 14}" font-size="8.5" text-anchor="middle" fill="#9ca3af">${b.l}</text>`;
  });
  svg += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#9ca3af" stroke-width=".5"/></svg>`;
  // σύγκριση τελευταίου με προηγούμενο
  const n = buckets.length, c = buckets[n - 1], p = buckets[n - 2];
  let info = '';
  if (p && p.v > 0) {
    const pct = ((c.v - p.v) / p.v) * 100;
    info = `<div class="tip">${c.v > p.v ? '🔺 Αύξηση' : c.v < p.v ? '🔻 Μείωση' : '＝ Ίδιο'} ${Math.abs(pct).toFixed(0)}% σε σχέση με το προηγούμενο (${eur(p.v)} → ${eur(c.v)}) · 🔴 αύξηση 🟢 μείωση</div>`;
  } else info = '<div class="tip">Πρόσθεσε καταχωρήσεις για να δεις σύγκριση.</div>';
  el.innerHTML = svg + info + '<div class="tip" data-tip></div>';
  el.querySelectorAll('rect').forEach(r => r.onclick = () => { const b = buckets[+r.dataset.i]; el.querySelector('[data-tip]').textContent = `${b.full}: ${eur(b.v)}`; });
}
function renderCharts() {
  // εβδομάδες
  const now = new Date(), m0 = mondayOf(now), weeks = [];
  for (let i = 11; i >= 0; i--) {
    const s = new Date(m0); s.setDate(s.getDate() - i * 7);
    const e = new Date(s); e.setDate(e.getDate() + 6);
    weeks.push({ v: sumRange(ymd(s), ymd(e), chartCat), l: `${s.getDate()}/${s.getMonth() + 1}`, full: `Εβδομάδα ${s.getDate()}/${s.getMonth() + 1} – ${e.getDate()}/${e.getMonth() + 1}`, cur: i === 0 });
  }
  barChart($('#chartWeek'), weeks);
  // μήνες
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1), k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    months.push({ v: sumRange(k + '-01', k + '-31', chartCat), l: MSHORT[d.getMonth()], full: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, cur: i === 0 });
  }
  barChart($('#chartMonth'), months);
  // έτος
  $('#yLabel').textContent = yearSel;
  const ym = [];
  for (let m = 0; m < 12; m++) { const k = `${yearSel}-${pad(m + 1)}`; ym.push({ v: sumRange(k + '-01', k + '-31', chartCat), l: MSHORT[m], full: `${MONTHS[m]} ${yearSel}` }); }
  const tot = ym.reduce((s, b) => s + b.v, 0), active = ym.filter(b => b.v > 0).length;
  $('#yTotal').textContent = eur(tot);
  $('#yAvg').textContent = active ? `Μέσος όρος ανά μήνα: ${eur(tot / active)}` : '';
  barChart($('#chartYear'), ym);
  $('#chartYear .tip')?.remove();
  renderStats();
}
/* Στατιστικά ανά κατηγορία / επιχείρηση */
function renderStats() {
  const now = new Date(), p = $('#statPeriod').value;
  const from = p === 'month' ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01` : p === 'year' ? `${now.getFullYear()}-01-01` : '0000-00-00';
  const list = db.entries.filter(e => e.date >= from);
  const total = list.reduce((s, e) => s + e.amount, 0);
  $('#statSummary').innerHTML = `<div class="card"><div class="lbl">Σύνολο</div><div class="val">${eur(total)}</div></div><div class="card"><div class="lbl">Αποδείξεις · μέσο ποσό</div><div class="val">${list.length} · ${eur(list.length ? total / list.length : 0)}</div></div>`;
  const bars = (map, fmt) => {
    const rows = [...map].sort((a, b) => b[1].v - a[1].v);
    if (!rows.length) return '<div class="empty">Δεν υπάρχουν δεδομένα</div>';
    const max = rows[0][1].v;
    return rows.map(([k, o]) => `<div class="srow"><span>${fmt(k, o)}</span><b>${eur(o.v)} <small>${total ? Math.round(o.v / total * 100) : 0}% · ${o.n}</small></b></div><div class="bar"><i style="width:${max ? o.v / max * 100 : 0}%"></i></div>`).join('');
  };
  const cats = new Map(), biz = new Map();
  for (const e of list) {
    const c = cats.get(catOf(e)) || { v: 0, n: 0 }; c.v += e.amount; c.n++; cats.set(catOf(e), c);
    const name = storeName(e); if (!name) continue;
    const key = e.biz?.afm || name, b = biz.get(key) || { v: 0, n: 0, name }; b.v += e.amount; b.n++; biz.set(key, b);
  }
  $('#statCats').innerHTML = bars(cats, k => CATS[k]);
  $('#statBiz').innerHTML = bars(new Map([...biz].slice(0, 200)), (k, o) => esc(o.name));
}
$('#yPrev').onclick = () => { yearSel--; renderCharts(); };
$('#yNext').onclick = () => { yearSel++; renderCharts(); };

/* ---------- Μηνιαία αναφορά ---------- */
let repKey = null, repText = '';
const WD = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const monthName = k => { const [y, m] = k.split('-'); return `${MONTHS[+m - 1]} ${y}`; };
const monthTotal = k => db.entries.filter(e => e.date.startsWith(k)).reduce((s, e) => s + e.amount, 0);
function cmpTxt(cur, prev, label) {
  if (!prev) return `<div class="cmp">${label}: <span class="m">δεν υπάρχουν δεδομένα</span></div>`;
  const p = (cur - prev) / prev * 100, up = cur > prev;
  return `<div class="cmp">${label}: <b class="${up ? 'up' : 'down'}">${up ? '🔺 +' : '🔻 '}${p.toFixed(0)}%</b> <span class="m">(${eur(prev)})</span></div>`;
}
function renderReport() {
  const sel = $('#repMonth');
  const nowK = ymd(new Date()).slice(0, 7);
  const keys = [...new Set([nowK, ...db.entries.map(e => e.date.slice(0, 7))])].sort().reverse();
  if (!repKey || !keys.includes(repKey)) repKey = keys.includes(sel.value) ? sel.value : keys[0];
  sel.innerHTML = keys.map(k => `<option value="${k}">${monthName(k)}</option>`).join(''); sel.value = repKey;
  const k = repKey, [y, m] = k.split('-').map(Number);
  const list = db.entries.filter(e => e.date.startsWith(k)), total = list.reduce((s, e) => s + e.amount, 0);
  const prevK = `${m === 1 ? y - 1 : y}-${pad(m === 1 ? 12 : m - 1)}`, lastYK = `${y - 1}-${pad(m)}`;
  const body = $('#repBody');
  if (!list.length) { body.innerHTML = `<h2>${monthName(k)}</h2><div class="card empty">Δεν υπάρχουν καταχωρήσεις αυτό τον μήνα.</div>`; repText = ''; return; }

  const byCat = new Map(), byStore = new Map(), byWd = new Array(7).fill(0), byDay = new Map();
  let ver = 0, verN = 0;
  for (const e of list) {
    byCat.set(catOf(e), (byCat.get(catOf(e)) || 0) + e.amount);
    const nm = storeName(e); if (nm) { const key = e.biz?.afm || nm; const o = byStore.get(key) || { v: 0, n: 0, name: nm }; o.v += e.amount; o.n++; byStore.set(key, o); }
    byWd[parseYmd(e.date).getDay()] += e.amount; byDay.set(e.date, (byDay.get(e.date) || 0) + e.amount);
    if (isVer(e)) { ver += e.amount; verN++; }
  }
  const big = list.reduce((a, b) => (b.amount > a.amount ? b : a));
  const topDay = [...byDay].sort((a, b) => b[1] - a[1])[0], topWd = byWd.indexOf(Math.max(...byWd));
  const days = new Set(list.map(e => e.date)).size;
  const pct = v => total ? Math.round(v / total * 100) : 0;
  const rows = (map, fmt) => [...map].sort((a, b) => (b[1].v ?? b[1]) - (a[1].v ?? a[1])).slice(0, 6).map(([k2, o]) => { const v = o.v ?? o; return `<div class="srow"><span>${fmt(k2, o)}</span><b>${eur(v)} <small>${pct(v)}%</small></b></div><div class="bar"><i style="width:${pct(v)}%"></i></div>`; }).join('');
  const verPct = pct(ver);
  body.innerHTML = `
    <h2>Αναφορά ${monthName(k)}</h2>
    <div class="hero small"><div class="lbl">Σύνολο εξόδων</div><div class="big">${eur(total)}</div>
      ${cmpTxt(total, monthTotal(prevK), 'vs ' + monthName(prevK))}${cmpTxt(total, monthTotal(lastYK), 'vs ' + monthName(lastYK))}</div>
    <div class="cards two-col">
      <div class="card"><div class="lbl">Αποδείξεις</div><div class="val">${list.length}</div></div>
      <div class="card"><div class="lbl">Μέσο καλάθι</div><div class="val">${eur(total / list.length)}</div></div>
      <div class="card"><div class="lbl">Ημέρες με αγορές</div><div class="val">${days}</div></div>
      <div class="card"><div class="lbl">Μέσο ανά ημέρα μήνα</div><div class="val">${eur(total / new Date(y, m, 0).getDate())}</div></div>
    </div>
    <h2>Ανά κατηγορία</h2><div class="card">${rows(byCat, c => CATS[c])}</div>
    ${byStore.size ? `<h2>Κορυφαίες επιχειρήσεις</h2><div class="card">${rows(byStore, (k2, o) => `${esc(o.name)} <small>${o.n}×</small>`)}</div>` : ''}
    <h2>Συνήθειες</h2>
    <div class="card facts">
      <div>💸 Μεγαλύτερη απόδειξη: <b>${eur(big.amount)}</b> <span class="m">${parseYmd(big.date).toLocaleDateString('el-GR')}${storeName(big) ? ' · ' + esc(storeName(big)) : ''}</span></div>
      <div>📅 Πιο «ακριβή» ημέρα: <b>${eur(topDay[1])}</b> <span class="m">${parseYmd(topDay[0]).toLocaleDateString('el-GR')}</span></div>
      <div>🗓️ Ημέρα με τα περισσότερα έξοδα: <b>${WD[topWd]}</b> <span class="m">(${eur(byWd[topWd])})</span></div>
    </div>
    <h2>Αξιοπιστία δεδομένων</h2>
    <div class="card"><div class="srow"><span>✔ Επαληθευμένα (PDF)</span><b>${verPct}% <small>${verN}/${list.length} αποδείξεις</small></b></div><div class="bar"><i style="width:${verPct}%"></i></div>
      <div class="m small">${verPct < 100 ? 'Τα υπόλοιπα προέρχονται από φωτογραφία ή χειροκίνητη καταχώρηση και μπορεί να έχουν μικρές αποκλίσεις.' : 'Όλα τα ποσά προέρχονται από επίσημα στοιχεία απόδειξης.'}</div></div>`;
  repText = `📑 Αναφορά εξόδων ${monthName(k)}\nΣύνολο: ${eur(total)} (${list.length} αποδείξεις, μέσο καλάθι ${eur(total / list.length)})\n` +
    (monthTotal(prevK) ? `vs ${monthName(prevK)}: ${total > monthTotal(prevK) ? '+' : ''}${((total - monthTotal(prevK)) / monthTotal(prevK) * 100).toFixed(0)}%\n` : '') +
    '\nΑνά κατηγορία:\n' + [...byCat].sort((a, b) => b[1] - a[1]).map(([c, v]) => `• ${CATS[c]}: ${eur(v)} (${pct(v)}%)`).join('\n') +
    (byStore.size ? '\n\nΚορυφαίες επιχειρήσεις:\n' + [...byStore.values()].sort((a, b) => b.v - a.v).slice(0, 5).map(o => `• ${o.name}: ${eur(o.v)} (${o.n}×)`).join('\n') : '') +
    `\n\nΕπαληθευμένα δεδομένα: ${verPct}%`;
}
$('#repMonth').onchange = e => { repKey = e.target.value; renderReport(); };
$('#repShare').onclick = async () => {
  if (!repText) return toast('Δεν υπάρχουν δεδομένα για κοινοποίηση');
  try { if (navigator.share) await navigator.share({ title: 'Αναφορά εξόδων', text: repText }); else { await navigator.clipboard.writeText(repText); toast('Αντιγράφηκε στο πρόχειρο'); } } catch { }
};
$('#repPrint').onclick = () => window.print();

/* ---------- Φόρμα εισαγωγής ---------- */
const dlg = $('#dlg');
let curQr = '', curItems = null, curMark = '', curBiz = null, curSrc = '';
function updateVer() {
  const t = { pdf: '✔ Επαληθευμένο — στοιχεία από PDF (ΜΑΡΚ)', photo: '📷 Από φωτογραφία — έλεγξε το ποσό', manual: '✍️ Χειροκίνητη καταχώρηση', old: '○ Χωρίς επαλήθευση' }[curSrc || 'old'];
  const v = $('#verBadge'); v.textContent = t; v.className = 'ver' + (curSrc === 'pdf' ? ' ok' : '');
}
function renderBiz() {
  const b = $('#bizBox'), x = curBiz; b.hidden = !x;
  if (!x) return;
  if (x) $('#fStore').value = db.stores?.[x.afm]?.name || x.name || '';
  const row = (l, v) => v ? `<div><span>${l}</span><b>${esc(v)}</b></div>` : '';
  $('#bizInfo').innerHTML = row('Επωνυμία', x.name) + row('ΑΦΜ', x.afm) + row('Υποκατάστημα', x.branch) + row('Παραστατικό', [x.type, x.doc].filter(Boolean).join(' ')) + row('ΜΑΡΚ', x.mark) + row('UID', x.uid);
}
function renderItems(){ const b=$('#itemsBox'); b.hidden=!curItems?.length; if(!curItems?.length) return; $('#itemsSum').textContent=`Προϊόντα (${curItems.length})`; $('#itemsList').innerHTML=curItems.map(i=>`<li><span>${esc(i.n)}${i.q!==1?` ×${i.q}`:''}</span><b>${eur(i.g)}</b></li>`).join(''); }
function safeUrl(u){ try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } }
function updateQrLink(){ const a = $('#qrLink'), u = safeUrl(curQr); a.hidden = !u; if (u) a.href = u; }
const dupOf = qr => qr && db.entries.find(e => e.qr === qr && (!editing || e.id !== editing.id));
let editing = null;
function openEntry(entry, opts = {}) {
  editing = entry || null;
  $('#dlgTitle').textContent = entry ? 'Επεξεργασία' : 'Νέα καταχώρηση';
  $('#fAmount').value = entry ? String(entry.amount).replace('.', ',') : (opts.amount ?? '');
  $('#fDate').value = entry ? entry.date : (opts.date || ymd(new Date()));
  $('#fTime').value = entry ? entry.time || '' : (opts.time || `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`);
  $('#fNote').value = entry ? entry.note || '' : '';
  curQr = entry ? entry.qr || '' : (opts.qr || ''); updateQrLink();
  curItems = entry?.items || opts.items || null; curMark = entry?.mark || opts.mark || ''; renderItems();
  curBiz = entry?.biz || opts.biz || null; renderBiz();
  curSrc = entry ? srcOf(entry) === 'old' ? '' : srcOf(entry) : (opts.src || 'manual'); updateVer();
  $('#fCat').value = entry ? catOf(entry) : (opts.cat || 'super');
  $('#fDelete').hidden = !entry;
  $('#preview').hidden = !opts.img; if (opts.img) $('#preview').src = opts.img;
  $('#ocrStatus').hidden = !opts.status; $('#ocrStatus').textContent = opts.status || '';
  dlg.showModal();
  if (!entry) setTimeout(() => $('#fAmount').focus(), 100);
}
$('#btnManual').onclick = () => openEntry(null);
$('#fCancel').onclick = () => dlg.close();
$('#fDelete').onclick = () => {
  if (!editing) return;
  if (deleteEntry(editing.id)) dlg.close();
};
$('#entryForm').addEventListener('submit', ev => {
  const amount = parseAmount($('#fAmount').value);
  if (!(amount > 0)) { ev.preventDefault(); toast('Μη έγκυρο ποσό'); return; }
  if (!editing && dupOf(curQr) && !confirm('Αυτή η απόδειξη (ίδιο QR) έχει ήδη καταχωρηθεί. Να αποθηκευτεί ξανά;')) { ev.preventDefault(); return; }
  const date = $('#fDate').value, time = $('#fTime').value, note = $('#fNote').value.trim();
  const cat = $('#fCat').value;
  if (curBiz?.afm) db.stores[curBiz.afm] = { name: $('#fStore').value.trim() || curBiz.name, cat };   // το κατάστημα «θυμάται» όνομα και κατηγορία
  if (editing) Object.assign(editing, { src: curSrc || editing.src, amount, date, time, note, cat, qr: curQr || editing.qr, items: curItems || editing.items, mark: curMark || editing.mark, biz: curBiz || editing.biz, u: Date.now() });
  else db.entries.push({ id: uid(), src: curSrc || 'manual', amount, date, time, note, cat, qr: curQr || undefined, items: curItems || undefined, mark: curMark || undefined, biz: curBiz || undefined, u: Date.now() });
  save(); toast('Αποθηκεύτηκε ✔');
});

/* ---------- OCR απόδειξης ---------- */
async function preprocess(file) {
  const bmp = await createImageBitmap(file);
  const sc = Math.min(1, 2000 / bmp.width, 6000 / bmp.height);
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const y = (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11) | 0; d[i] = y; hist[y]++; }
  // κανονικοποίηση με αποκοπή 1% / 99% ώστε να μην επηρεάζουν σκιές και αντανακλάσεις
  const N = c.width * c.height; let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > N * .01) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > N * .01) { hi = v; break; } }
  const k = 255 / Math.max(hi - lo, 1);
  for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] - lo) * k)); d[i] = d[i + 1] = d[i + 2] = v; }
  g.putImageData(im, 0, 0);
  return c;
}
const AMT = /(?<![\d.,])(\d{1,4}[.,]\d{2})(?!\d)/g;
const amtsIn = l => [...l.matchAll(AMT)].map(m => parseAmount(m[1])).filter(n => n > 0);
const SKIP = /ΣΥΝΑΛΛ|ΑΛΛΑΓ|ΠΟΝΤ|ΠΩΝΤ|PONT|ΟΦΕΛ|ΩΦΕΛ|ΕΙΔΗ|ΕΚΠΤ|ΣΕΙΡ|SEIR|ΜΕΛΟΥΣ|ΜΕΛΟΥ|ΠΟΛΗΒ|ΦΠΑ|VAT|ΡΕΣΤΑ|ΡΕΣΤΑ|ΑΡΙΘ/i;
/* texts: κείμενα από πολλαπλά περάσματα OCR */
function parseReceipt(texts) {
  const nowY = new Date().getFullYear();
  // --- σύνολο: ψηφοφορία ανάμεσα σε γραμμές χωρίς % (ΣΥΝΟΛΟ, ΚΑΡΤΑ, ΜΕΤΡΗΤΑ, ΕΥΡΩ) ---
  const votes = new Map(), itemSums = [];
  for (const text of texts) {
    let items = 0, n = 0;
    for (const l of text.split(/\n/)) {
      if (/%|\d\s*[%ΧX]\s*$/.test(l) && /\d[.,]\d{2}\s*[-]?\s*\d{1,2}[.,]\d{2}\s*[%$&§S\d]?\s*$|%/.test(l)) { const a = amtsIn(l.replace(/\d{1,2}[.,]\d{2}\s*%?\s*\S?\s*$/, '')); if (a.length) { items += l.includes('-') && /-\s*\d/.test(l) ? a[a.length - 1] * -1 : a[a.length - 1]; n++; } continue; }
      if (SKIP.test(l)) continue;
      const a = amtsIn(l); if (!a.length) continue;
      const strong = /ΣΥΝΟ|ΖΥΝΟ|SYNO|ΕΥΡ|ΕΨΡ|EYP|EUR|€|ΚΑΡΤΑ|ΜΕΤΡΗΤΑ|CARD|CASH|TOTAL/i.test(l);
      const v = a[a.length - 1]; votes.set(v, (votes.get(v) || 0) + (strong ? 2 : 1));
    }
    if (n > 3) itemSums.push(Math.round(items * 100) / 100);
  }
  let total = null;
  const cand = [...votes.entries()].filter(([v]) => v < 3000);
  for (const s of itemSums) if (votes.has(s)) { total = s; break; }          // ταυτίζεται με το άθροισμα ειδών
  if (total === null && cand.length) { cand.sort((a, b) => b[1] - a[1] || b[0] - a[0]); total = cand[0][0]; }
  if (total === null) { const all = texts.flatMap(amtsIn).filter(n => n < 2000); if (all.length) total = Math.max(...all); }
  // --- ημερομηνία & ώρα ---
  let date = null, time = null;
  for (const text of texts) {
    if (!date) for (const dm of text.matchAll(/(?<![\dOoIl])([0-3]?[\dOoIl])\s*[\/.\-,]\s*([01]?[\dOoIl])\s*[\/.\-,]\s*([\dOoIl]{4}|[\dOoIl]{2})(?![\dOoIl])/g)) {
      const fx = s => +s.replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
      const d = fx(dm[1]), m = fx(dm[2]); let y = fx(dm[3]); if (y < 100) y += 2000;
      if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) continue;
      if (y < nowY - 5 || y > nowY) y = nowY;                 // λάθος ανάγνωση έτους από OCR
      let cand = new Date(y, m - 1, d); if (cand > new Date()) cand = new Date(y - 1, m - 1, d);
      date = ymd(cand); break;
    }
    const tm = text.match(/[ΩΏWΟO]\s*[ΡPR]\s*[ΑAΆΔ]\s*[:.;]?\s*([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)/i)
      || text.match(/(?<![\d.])([01]?\d|2[0-3])\s*:\s*([0-5]\d)\s*:\s*[0-5]\d(?!\d)/);
    if (tm && !time) time = `${pad(+tm[1])}:${tm[2]}`;
    if (date && time) break;
  }
  return { total, date, time };
}
function rotateCanvas(c, deg) {
  const r = document.createElement('canvas'), g = r.getContext('2d');
  r.width = c.height; r.height = c.width; g.translate(r.width / 2, r.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(c, -c.width / 2, -c.height / 2); return r;
}
async function readQR(c) {
  try { if ('BarcodeDetector' in window) { const r = await new BarcodeDetector({ formats: ['qr_code'] }).detect(c); if (r[0]?.rawValue) return r[0].rawValue; } } catch { }
  try { if (window.jsQR) { const g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, c.height); const r = jsQR(im.data, c.width, c.height, { inversionAttempts: 'attemptBoth' }); if (r?.data) return r.data; } } catch { }
  return '';
}
$('#photo').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f);
  const st = t => { $('#ocrStatus').hidden = false; $('#ocrStatus').textContent = t; };
  openEntry(null, { img: url, status: '⏳ Ανάγνωση απόδειξης… (την πρώτη φορά κατεβαίνουν τα ελληνικά δεδομένα OCR, κάνε υπομονή)', src: 'photo' });
  let worker;
  try {
    if (!window.Tesseract) throw new Error('Το OCR δεν φορτώθηκε (χρειάζεται internet)');
    const canvas = await preprocess(f);
    let pass = 1;
    worker = await Tesseract.createWorker('ell+eng', 1, { logger: m => { if (m.status === 'recognizing text') st(`⏳ Ανάγνωση (${pass}/2)… ${Math.round(m.progress * 100)}%`); else if (/load|init/.test(m.status)) st('⏳ Φόρτωση OCR… ' + Math.round((m.progress || 0) * 100) + '%'); } });
    const qr = safeUrl(await readQR(canvas));
    const texts = [];
    for (const psm of ['6', '3']) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      texts.push((await worker.recognize(canvas)).data.text); pass++;
    }
    let r = parseReceipt(texts);
    for (const deg of (r.total ? [] : [90, 270])) {   // φωτογραφία γυρισμένη στο πλάι
      st('⏳ Δοκιμή περιστροφής…'); await worker.setParameters({ tessedit_pageseg_mode: '6' });
      const t = (await worker.recognize(rotateCanvas(canvas, deg))).data.text, r2 = parseReceipt([t]);
      if (r2.total) { r = r2; break; }
    }
    if (qr) { curQr = qr; updateQrLink(); }
    if (r.total) $('#fAmount').value = String(r.total).replace('.', ',');
    if (r.date) $('#fDate').value = r.date;
    if (r.time) $('#fTime').value = r.time;
    const got = [r.total && 'σύνολο ' + eur(r.total), r.date && 'ημερομηνία', r.time && 'ώρα'].filter(Boolean);
    const dup = dupOf(qr);
    if (dup) return st('⚠️ Αυτή η απόδειξη έχει ήδη καταχωρηθεί (' + dup.date + ', ' + eur(dup.amount) + '). Πάτα Άκυρο αν είναι διπλή.');
    st(got.length ? `✅ Βρέθηκαν: ${got.join(', ')}. Έλεγξε και πάτα Αποθήκευση.` : '⚠️ Δεν αναγνωρίστηκε τίποτα — δοκίμασε πιο καθαρή φωτογραφία ή πληκτρολόγησε.' + (qr ? '' : ' (QR: δεν βρέθηκε στη φωτογραφία)'));
  } catch (e) {
    st('⚠️ ' + (e.message || e) + ' — πληκτρολόγησε το ποσό.');
  } finally { try { await worker?.terminate(); } catch { } }
};


/* ---------- Εισαγωγή από Epsilon Digital ---------- */
const impDlg = $('#dlgImp');
let impQr = '', scanStream = null, scanTimer = null;
function stopScan() { clearInterval(scanTimer); scanTimer = null; scanStream?.getTracks().forEach(t => t.stop()); scanStream = null; }
function showPdfStep(url) {
  impQr = url; $('#qrStepScan').hidden = true; $('#qrStepPdf').hidden = false; $('#qrOpen').href = url; stopScan();
  const dup = db.entries.find(e => e.qr === url && e.mark);
  if (dup) { $('#epsMsg').hidden = false; $('#epsMsg').textContent = `ℹ️ Αυτή η απόδειξη έχει ήδη εισαχθεί (${dup.date}, ${eur(dup.amount)}).`; }
}
async function startScan() {
  impQr = ''; $('#qrStepScan').hidden = false; $('#qrStepPdf').hidden = true; $('#epsMsg').hidden = true; $('#epsText').value = '';
  impDlg.showModal();
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    const v = $('#qrVideo'); v.srcObject = scanStream; await v.play();
    const c = document.createElement('canvas'), det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
    scanTimer = setInterval(async () => {
      if (!v.videoWidth) return;
      let val = '';
      try {
        if (det) val = (await det.detect(v))[0]?.rawValue || '';
        else if (window.jsQR) { c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d'); g.drawImage(v, 0, 0); val = jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data || ''; }
      } catch { }
      const u = safeUrl(val); if (u) showPdfStep(u);
    }, 300);
  } catch (e) { $('#epsMsg').hidden = false; $('#epsMsg').textContent = '⚠️ Η κάμερα δεν άνοιξε (' + (e.name || e) + '). Χρησιμοποίησε «τράβηξε φωτογραφία του QR».'; }
}
$('#btnQr').onclick = startScan;
$('#qrPhoto').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try {
    const bmp = await createImageBitmap(f), c = document.createElement('canvas'), sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    c.width = bmp.width * sc; c.height = bmp.height * sc; c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const u = safeUrl(await readQR(c));
    if (u) showPdfStep(u); else { $('#epsMsg').hidden = false; $('#epsMsg').textContent = '⚠️ Δεν βρέθηκε QR στη φωτογραφία. Δοκίμασε πιο κοντά και καθαρά.'; }
  } catch (e) { $('#epsMsg').hidden = false; $('#epsMsg').textContent = '⚠️ ' + (e.message || e); }
};
impDlg.addEventListener('close', stopScan);
$('#epsClose').onclick = () => impDlg.close();
async function pdfToText(file) {
  if (!window.pdfjsLib) throw new Error('Το PDF εργαλείο δεν φορτώθηκε (χρειάζεται internet)');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const c = await (await pdf.getPage(p)).getTextContent(), rows = [];
    for (const it of c.items) {
      if (!it.str.trim()) continue;
      const y = it.transform[5], x = it.transform[4]; let r = rows.find(r => Math.abs(r.y - y) < 3);
      if (!r) { r = { y, it: [] }; rows.push(r); } r.it.push({ x, s: it.str, w: it.width || 0, fs: Math.abs(it.transform[0]) || 8 });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) { r.it.sort((a, b) => a.x - b.x); let line = ''; r.it.forEach((i, k) => { if (k) { const p = r.it[k - 1], gap = i.x - (p.x + p.w); if (gap >= 0.1 * i.fs) line += ' '; } line += i.s; }); out += line + '\n'; }
  }
  return out;
}
function importEpsilon(text) {
  const r = parseEpsilon(text), msg = $('#epsMsg'); msg.hidden = false;
  if (!r.ok) {
    msg.textContent = `⚠️ Δεν αναγνωρίστηκε απόδειξη Epsilon (διαβάστηκαν ${text.length} χαρακτήρες). ` + (text.trim().length < 40 ? 'Το PDF δεν περιέχει κείμενο (μάλλον είναι εικόνα) — δοκίμασε επικόλληση κειμένου ή φωτογραφία.' : 'Αρχή κειμένου: ' + text.replace(/\s+/g, ' ').slice(0, 350));
    return;
  }
  const sum = Math.round(r.items.reduce((s, i) => s + i.g, 0) * 100) / 100;
  const match = (r.mark && db.entries.find(e => e.mark === r.mark)) || db.entries.find(e => !e.mark && e.date === r.date && Math.abs(e.amount - r.total) < 0.005);
  let target = null;
  if (match) { if (match.mark || confirm(`Υπάρχει ήδη καταχώρηση ${eur(match.amount)} στις ${match.date}. Να ενημερωθεί με τα στοιχεία της Epsilon (αντί για νέα);`)) target = match; }
  impDlg.close();
  const note = r.merchant;
  const status = `✅ Epsilon: ${r.items.length} προϊόντα${r.items.length && Math.abs(sum - r.total) < 0.015 ? ', το άθροισμα ταιριάζει με το σύνολο' : ''}.`;
  openEntry(target, { amount: String(r.total).replace('.', ','), date: r.date, time: r.time, items: r.items, mark: r.mark, qr: impQr, status, src: 'pdf', cat: db.stores?.[r.afm]?.cat });
  $('#fAmount').value = String(r.total).replace('.', ','); if (r.date) $('#fDate').value = r.date; if (r.time) $('#fTime').value = r.time;
  curItems = r.items; curMark = r.mark; if (impQr) curQr = impQr; updateQrLink(); renderItems();
  curBiz = { name: r.merchant, afm: r.afm, branch: r.branch, type: r.docType, doc: r.doc, mark: r.mark, uid: r.uid }; renderBiz();
  curSrc = 'pdf'; updateVer();
  if (db.stores?.[r.afm] && !target) toast('Γνωστό κατάστημα: κατηγορία ' + CATS[db.stores[r.afm].cat].split(' ').slice(1).join(' '));
}
$('#epsFile').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { $('#epsMsg').hidden = false; $('#epsMsg').textContent = '⏳ Ανάγνωση PDF…'; importEpsilon(await pdfToText(f)); }
  catch (e) { $('#epsMsg').hidden = false; $('#epsMsg').textContent = '⚠️ ' + (e.message || e); }
};
$('#epsGo').onclick = () => importEpsilon($('#epsText').value);

/* ---------- Εξαγωγή / Εισαγωγή αρχείου ---------- */
$('#btnExport').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }));
  a.download = `exoda-backup-${ymd(new Date())}.json`; a.click();
};
$('#importFile').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { merge(JSON.parse(await f.text())); save(); toast('Η εισαγωγή ολοκληρώθηκε ✔'); } catch { toast('Μη έγκυρο αρχείο'); }
};

/* ---------- Google Drive (appDataFolder) ---------- */
const DEFAULT_CID = '995876883635-q0eil5ri7eqdjr83ad3amskbsl7id46l.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata', FILE = 'supermarket-expenses-backup.json';
let tokClient = null, token = null, tokExp = 0;
// Επαναφορά token που ισχύει ακόμα από προηγούμενο άνοιγμα, ώστε να μη ζητάει ξανά σύνδεση
try { const t = JSON.parse(localStorage.getItem('sm_tok') || 'null'); if (t && t.token && Date.now() < t.exp - 60000) { token = t.token; tokExp = t.exp; } } catch { }
$('#clientId').value = localStorage.getItem('sm_cid') || DEFAULT_CID;
$('#originTxt').textContent = location.origin;
$('#clientId').onchange = e => { localStorage.setItem('sm_cid', e.target.value.trim()); tokClient = null; };
function gState() {
  if (!(localStorage.getItem('sm_cid') || DEFAULT_CID)) return '';
  if (localStorage.getItem('sm_dirty')) return '☁️ εκκρεμεί αντίγραφο · πάτα';
  return localStorage.getItem('sm_gok') ? '☁️ συγχρονισμένο' : '';
}
function ensureToken(interactive) {
  return new Promise((res, rej) => {
    if (token && Date.now() < tokExp - 60000) return res(token);
    // Ο αυτόματος (μη διαδραστικός) συγχρονισμός ΔΕΝ ανοίγει ποτέ παράθυρο Google.
    // Το access token ζει ~1 ώρα και δεν υπάρχει refresh token στο flow του browser,
    // οπότε όταν λήξει αφήνουμε το αντίγραφο εκκρεμές αντί να ζητήσουμε ξανά σύνδεση
    // μετά από κάθε απόδειξη. Ο χρήστης το συγχρονίζει με ένα πάτημα όποτε θέλει.
    if (!interactive) return rej(new Error('needs-login'));
    const cid = (localStorage.getItem('sm_cid') || DEFAULT_CID).trim();
    if (!cid) return rej(new Error('Βάλε πρώτα το Google Client ID στις Ρυθμίσεις'));
    if (!window.google?.accounts?.oauth2) return rej(new Error('Η Google δεν φορτώθηκε (χρειάζεται internet)'));
    tokClient = google.accounts.oauth2.initTokenClient({
      client_id: cid, scope: SCOPE,
      callback: r => { if (r.error) return rej(new Error(r.error_description || r.error)); token = r.access_token; tokExp = Date.now() + r.expires_in * 1000; localStorage.setItem('sm_gconn', '1'); try { localStorage.setItem('sm_tok', JSON.stringify({ token, exp: tokExp })); } catch { } res(token); },
      error_callback: e => rej(new Error(e.type || 'Ακυρώθηκε'))
    });
    tokClient.requestAccessToken({ prompt: localStorage.getItem('sm_gconn') ? '' : 'consent' });
  });
}
async function g(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, ...(opt.headers || {}) } });
  if (r.status === 401) { token = null; tokExp = 0; localStorage.removeItem('sm_tok'); }
  if (!r.ok) throw new Error('Drive ' + r.status);
  return r;
}
async function findFile() {
  const r = await g(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(`name='${FILE}'`)}&fields=files(id)`);
  return (await r.json()).files[0]?.id;
}
async function pull() { const id = await findFile(); if (!id) return false; merge(await (await g(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`)).json()); return true; }
async function push() {
  const id = await findFile(), body = JSON.stringify(db);
  if (id) await g(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  else {
    const b = '-----sm', meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
    await g('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: `--${b}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--` });
  }
}
async function backupNow(interactive) {
  await ensureToken(interactive);
  await pull();            // συγχώνευση με ό,τι υπάρχει ήδη
  localStorage.setItem(KEY, JSON.stringify(db));
  await push();
  localStorage.removeItem('sm_dirty'); localStorage.setItem('sm_gok', '1'); localStorage.setItem('sm_sync_at', String(Date.now())); render();
}
let abT; function autoBackup() {
  if (!localStorage.getItem('sm_gconn')) return;       // μόνο αφού έχει γίνει η πρώτη σύνδεση
  clearTimeout(abT);
  // μικρή καθυστέρηση ώστε να ισχύει ακόμα το «πάτημα» του χρήστη (το Google επιτρέπει σιωπηλή ανανέωση άδειας)
  abT = setTimeout(() => backupNow(false).catch(() => render()), 700);
}
function retryPending() { if (localStorage.getItem('sm_dirty') && localStorage.getItem('sm_gconn')) backupNow(false).catch(() => render()); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) retryPending(); });
$('#syncState').onclick = () => { if (localStorage.getItem('sm_dirty')) backupNow(true).then(() => toast('Το αντίγραφο ολοκληρώθηκε ✔')).catch(e => toast(e.message)); };
setTimeout(retryPending, 1500);
$('#btnConnect').onclick = async () => { try { await ensureToken(true); toast('Συνδέθηκε ✔'); await backupNow(true); toast('Αντίγραφο ✔'); } catch (e) { toast(e.message); } };
$('#btnBackup').onclick = async () => { try { toast('Αντίγραφο…'); await backupNow(true); toast('Το αντίγραφο ολοκληρώθηκε ✔'); } catch (e) { toast(e.message); } };
$('#btnRestore').onclick = async () => {
  try { await ensureToken(true); const found = await pull(); save(false); localStorage.setItem('sm_gok', '1'); toast(found ? `Επαναφορά ✔ (${db.entries.length} καταχωρήσεις)` : 'Δεν βρέθηκε αντίγραφο στο Drive'); render(); }
  catch (e) { toast(e.message); }
};

/* ---------- Εκκίνηση ---------- */
if (navigator.storage?.persist) navigator.storage.persist();
$('#storageInfo').textContent = 'Καταχωρήσεις στη συσκευή: ' + db.entries.length;
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
