// Opens a clean, styled print window for a single sheet (instructions, priority
// teeth, etc.) — independent of the app's own styles for reliable printing.
export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export function printSheet({ title = '', lang = 'ar', clinicName = '', subtitle = '', bodyHtml = '' }) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const side = dir === 'rtl' ? 'right' : 'left'
  const w = window.open('', 'PRINT', 'height=900,width=820')
  if (!w) { alert('Please allow pop-ups to print.'); return }
  w.document.write(`<!doctype html><html dir="${dir}" lang="${lang}"><head><meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#1e293b;margin:0;padding:42px;line-height:1.7}
    .head{text-align:center;border-bottom:3px solid #0d9488;padding-bottom:14px;margin-bottom:26px}
    .clinic{font-size:26px;font-weight:800;color:#0d9488}
    .sub{color:#64748b;font-size:13px;margin-top:4px}
    h1{font-size:21px;margin:0 0 16px}
    .meta{background:#f1f5f9;border-radius:10px;padding:10px 16px;margin-bottom:20px;font-size:14px;display:flex;gap:24px;flex-wrap:wrap}
    .meta b{color:#475569}
    ul{padding-${side}:22px;margin:0}
    li{margin-bottom:11px;font-size:15px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #cbd5e1;padding:8px 10px;font-size:13px;text-align:${side}}
    th{background:#0d9488;color:#fff}
    .foot{margin-top:46px;border-top:1px solid #e2e8f0;padding-top:12px;color:#94a3b8;font-size:12px;display:flex;justify-content:space-between}
    @media print{ body{padding:24px} }
  </style></head><body>
    <div class="head"><div class="clinic">${escapeHtml(clinicName)}</div><div class="sub">${escapeHtml(subtitle)}</div></div>
    ${bodyHtml}
    <div class="foot"><span>${new Date().toLocaleDateString()}</span><span>${escapeHtml(clinicName)}</span></div>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
