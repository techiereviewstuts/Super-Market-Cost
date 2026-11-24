/* Ανάγνωση απόδειξης Epsilon Digital από κείμενο (PDF ή επικόλληση) */
(function (root) {
  const num = s => { const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
  const r2 = n => Math.round(n * 100) / 100;

  function parseEpsilon(text) {
    text = String(text).replace(/ /g, ' ');
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const out = { merchant: '', total: null, date: null, time: null, mark: '', uid: '', items: [] };

    // έμπορος: πρώτη γραμμή με γράμματα, όχι ετικέτα
    out.merchant = (lines.find(l => /[Α-Ωα-ωA-Za-z]{3}/.test(l) && !/^(Απόδειξη|Στοιχεία|Epsilon)/i.test(l) && !/Epsilon|\d{1,2}\/\d{1,2}\/\d{2}/i.test(l)) || '').replace(/\s+/g, ' ');

    // προϊόντα: <α/α> <περιγραφή> <ποσότητα> <μονάδα> <ΦΠΑ%> <αξία ΦΠΑ> <καθαρή αξία>
    const row = /^(\d{1,3})\s*(.+?)\s*(\d+(?:,\d+)?)\s*(Τεμάχια|Τεμάχιο|Κιλά|Κιλό|Λίτρα|Λίτρο|Συσκευασίες|Συσκευασία|Μέτρα|Γραμμάρια|Τεμ\.?)\s*(0|4|6|9|13|17|24)[,.]00\s*(\d+,\d{2})\s*(\d+,\d{2})$/i;
    for (const l of lines) {
      const m = l.match(row);
      if (!m) continue;
      const gross = r2(num(m[6]) + num(m[7]));
      if (isFinite(gross)) out.items.push({ n: m[2].trim(), q: num(m[3]), g: gross, v: +m[5] });
    }

    // σύνολο
    // «διπλωμένο» κείμενο: χωρίς κενά/τόνους/κεφαλαία, ώστε να αντέχει σε αλλαγές διάταξης
    const flat = text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '').toLowerCase();
    const AM = '(\\d[\\d.]*,\\d{2})';
    let m = null;
    for (const key of ['συνολικηαξια', 'συνολοπαραστατικου', 'πληρωτεο', 'συνολικοποσο', 'τελικοποσο', 'συνολοπληρωμης']) {
      m = flat.match(new RegExp(key + ':?€?' + AM));
      if (m) { out.total = num(m[1]); break; }
    }
    if (out.total === null) { m = flat.match(new RegExp('τροποιπληρωμης[^\\d]{0,40}?' + AM)); if (m) out.total = num(m[1]); }
    if (out.total === null && out.items.length) out.total = r2(out.items.reduce((s, i) => s + i.g, 0));
    if (out.total === null) {  // τελευταία λύση: το μεγαλύτερο ποσό που εμφανίζεται 2+ φορές
      const cnt = new Map();
      for (const a of text.matchAll(/(?<![\d.,])(\d{1,4},\d{2})(?!\d)/g)) { const v = num(a[1]); cnt.set(v, (cnt.get(v) || 0) + 1); }
      const c = [...cnt].filter(([v, n]) => n >= 2 && v > 0).sort((a, b) => b[0] - a[0]);
      if (c.length) out.total = c[0][0];
    }

    // ημερομηνία / ώρα
    m = text.match(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(20\d{2})/);
    if (m) out.date = `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
    m = text.match(/\(\s*\d{1,2}\/\d{1,2}\/20\d{2}\s+(\d{1,2}):(\d{2})\s*\)/);
    if (m) out.time = `${String(+m[1]).padStart(2, '0')}:${m[2]}`;

    // αναγνωριστικά
    m = flat.match(/μ\.?αρ\.?κ\.?:?(\d{10,})/) || flat.match(/mark:?(\d{10,})/); if (m) out.mark = m[1];
    m = flat.match(/uid:?([0-9a-f]{30,})/); if (m) out.uid = m[1].toUpperCase();

    m = flat.match(/α\.?φ\.?μ\.?:?(\d{9})/); if (m) out.afm = m[1];
    m = flat.match(/υποκαταστημα:?(\d{1,4})/); if (m) out.branch = m[1];
    m = flat.match(/[aα]\/[aα]:(\d+-\d+)/); if (m) out.doc = m[1];
    out.docType = (lines.find(l => /^(Απόδειξη|Τιμολόγιο|Δελτίο)/i.test(l) && !/Στοιχεία/i.test(l)) || '').replace(/\s+/g, ' ');

    out.ok = !!(out.total && out.total > 0);
    return out;
  }
  root.parseEpsilon = parseEpsilon;
  if (typeof module !== 'undefined') module.exports = { parseEpsilon };
})(typeof window !== 'undefined' ? window : globalThis);
