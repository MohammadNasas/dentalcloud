import { IMPORT_LIMITS, groupLabeledLines, parseLabeledRecord } from './patientImport.js'

// Never execute spreadsheet formulas or macros. All decoding stays on-device.
export function parseDelimited(text, delimiter) {
  if (!delimiter) {
    const line = text.split(/\r?\n/).slice(0, 10).join('\n').replace(/"(?:[^"]|"")*"/g, '')
    delimiter = [',', '\t', ';', '|'].sort((a, b) => line.split(b).length - line.split(a).length)[0]
  }
  const rows = []; let cells = [], cell = '', quoted = false
  const pushCell = () => { cells.push(cell); cell = ''; if (cells.length > IMPORT_LIMITS.columns) throw new Error('columnLimit') }
  const pushRow = () => { pushCell(); rows.push({ row: rows.length + 1, cells, formulas: cells.map((v,i) => /^\s*[=]/.test(v) ? i : -1).filter(i => i >= 0) }); cells = []; if (rows.length > IMPORT_LIMITS.rows + 12) throw new Error('rowLimit') }
  text = text.replace(/^\ufeff/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || !cell) quoted = !quoted
      else cell += char
    } else if (!quoted && char === delimiter) pushCell()
    else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[i + 1] === '\n') i++; pushRow() }
    else cell += char
    if (cell.length > IMPORT_LIMITS.text) throw new Error('textLimit')
  }
  if (quoted) throw new Error('quotes')
  if (cell || cells.length) pushRow()
  return rows
}
function xml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('invalidFile')
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('invalidFile')
  return doc
}
const nodes = (root, name) => [...root.getElementsByTagNameNS('*', name)]
async function archive(buffer) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)
  let size = 0
  for (const file of Object.values(zip.files)) {
    size += file._data?.uncompressedSize || 0
    if (size > 25 * 1024 * 1024) throw new Error('expandedLimit')
  }
  return async (path, optional = false) => {
    const file = zip.file(path)
    if (!file) { if (optional) return null; throw new Error('invalidFile') }
    const text = await file.async('string')
    if (text.length > 25 * 1024 * 1024) throw new Error('expandedLimit')
    return xml(text)
  }
}
export async function readPatientImport(file) {
  if (!file.size || file.size > IMPORT_LIMITS.bytes) throw new Error('fileSize')
  const buffer = await file.arrayBuffer()
  const fingerprint = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(v => v.toString(16).padStart(2, '0')).join('')
  const ext = file.name.split('.').pop().toLowerCase()
  let sheets = []
  if (['csv', 'tsv', 'txt'].includes(ext)) {
    const bytes = new Uint8Array(buffer)
    let encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8'
    let text
    try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes) } catch { throw new Error('encoding') }
    const labelled = ext === 'txt' && text.split(/\r?\n/).some(line => parseLabeledRecord(line).name)
    sheets = [{ name: 'Data', rows: labelled ? groupLabeledLines(text.split(/\r?\n/)) : parseDelimited(text, ext === 'tsv' ? '\t' : undefined) }]
  } else if (ext === 'xlsx') {
    const read = await archive(buffer)
    const workbook = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels')
    const shared = await read('xl/sharedStrings.xml', true), styles = await read('xl/styles.xml', true)
    const strings = shared ? nodes(shared, 'si').map(n => nodes(n, 't').map(t => t.textContent).join('')) : []
    const formats = new Map(styles ? nodes(styles, 'numFmt').map(n => [Number(n.getAttribute('numFmtId')), n.getAttribute('formatCode')]) : [])
    const styleList = styles ? nodes(styles, 'cellXfs').flatMap(n => [...n.children]).map(n => Number(n.getAttribute('numFmtId'))) : []
    const date1904 = nodes(workbook, 'workbookPr')[0]?.getAttribute('date1904') === '1'
    const relMap = new Map(nodes(rels, 'Relationship').filter(n => n.getAttribute('TargetMode') !== 'External').map(n => [n.getAttribute('Id'), n.getAttribute('Target')]))
    const sheetNodes = nodes(workbook, 'sheet')
    if (sheetNodes.length > 20) throw new Error('sheetLimit')
    for (const sheet of sheetNodes) {
      const target = relMap.get(sheet.getAttribute('r:id'))
      if (!target || target.includes('..') || /https?:/i.test(target)) throw new Error('invalidFile')
      const doc = await read(target.startsWith('/') ? target.slice(1) : `xl/${target}`)
      const sourceRows = nodes(doc, 'row')
      if (sourceRows.length > IMPORT_LIMITS.rows + 12) throw new Error('rowLimit')
      const rows = sourceRows.map((row, index) => {
        const cells = [], formulas = []
        for (const c of nodes(row, 'c')) {
          const ref = c.getAttribute('r') || '', letters = ref.match(/^[A-Z]+/)?.[0]
          if (!letters) throw new Error('invalidFile')
          const col = [...letters].reduce((sum, l) => sum * 26 + l.charCodeAt(0) - 64, 0) - 1
          if (col >= IMPORT_LIMITS.columns) throw new Error('columnLimit')
          let value = nodes(c, 'v')[0]?.textContent || ''
          const type = c.getAttribute('t')
          if (type === 's') value = strings[Number(value)] ?? ''
          if (type === 'inlineStr') value = nodes(c, 't').map(n => n.textContent).join('')
          const formatId = styleList[Number(c.getAttribute('s') || 0)]
          const format = formats.get(formatId) || ''
          const isDate = [14,15,16,17,22].includes(formatId) || /[yd]/i.test(format.replace(/"[^"]*"|\[[^\]]*\]/g, ''))
          if (isDate && /^\d+(?:\.\d+)?$/.test(value)) {
            const days = Number(value)
            if (!date1904 && days === 60) value = 'Invalid Excel date (1900-02-29)'
            else value = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31) + (days - (!date1904 && days > 60 ? 1 : 0)) * 86400000).toISOString().slice(0, 10)
          } else if (/^0+$/.test(format) && /^\d+$/.test(value)) value = value.padStart(format.length, '0')
          if (nodes(c, 'f').length) formulas.push(col)
          if (value.length > IMPORT_LIMITS.text) throw new Error('textLimit')
          cells[col] = value
        }
        return { row: Number(row.getAttribute('r')) || index + 1, cells: Array.from({ length: cells.length }, (_, i) => cells[i] || ''), formulas }
      })
      sheets.push({ name: sheet.getAttribute('name') || String(sheets.length + 1), rows })
    }
  } else if (ext === 'docx') {
    const read = await archive(buffer), doc = await read('word/document.xml')
    const tables = nodes(doc, 'tbl')
    if (tables.length) sheets = tables.map((table, i) => ({ name: `Table ${i + 1}`, rows: nodes(table, 'tr').map((row, index) => ({ row: index + 1, cells: [...row.children].filter(c => c.localName === 'tc').map(c => nodes(c, 'p').map(p => nodes(p, 't').map(t => t.textContent).join('')).join('\n')) })) }))
    // Non-tabular text stays as visible source lines; the user must map/review it.
    else sheets = [{ name: 'Text', rows: groupLabeledLines(nodes(doc, 'p').map(p => nodes(p, 't').map(t => t.textContent).join(''))) }]
  } else if (ext === 'pdf') {
    const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdf.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
    const task = pdf.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true })
    let document
    try {
      document = await task.promise
      if (document.numPages > 50) throw new Error('pageLimit')
      for (let pageNo = 1; pageNo <= document.numPages; pageNo++) {
        const page = await document.getPage(pageNo), content = await page.getTextContent(), lines = new Map()
        for (const item of content.items) {
          if (!item.str?.trim()) continue
          const y = Math.round(item.transform[5] / 3) * 3
          if (!lines.has(y)) lines.set(y, [])
          lines.get(y).push(item)
        }
        const rows = [...lines].sort((a,b) => b[0]-a[0]).map(([_, items], i) => ({ row: i+1, cells: items.sort((a,b) => a.transform[4]-b.transform[4]).map(n => n.str) }))
        const textLines = rows.map(r => r.cells.join(' '))
        const labelled = textLines.some(line => parseLabeledRecord(line).name)
        sheets.push({ name: `Page ${pageNo}`, rows: labelled ? groupLabeledLines(textLines) : rows })
      }
    } finally { await task.destroy() }
    if (!sheets.some(s => s.rows.length)) throw new Error('scanned')
  } else throw new Error('unsupported')
  sheets = sheets.filter(s => s.rows.some(r => r.cells.some(c => c.trim())))
  if (!sheets.length) throw new Error('empty')
  for (const sheet of sheets) {
    if (sheet.rows.length > IMPORT_LIMITS.rows + 12) throw new Error('rowLimit')
    if (sheet.rows.some(r => r.cells.length > IMPORT_LIMITS.columns)) throw new Error('columnLimit')
    if (sheet.rows.some(r => r.cells.some(c => c.length > IMPORT_LIMITS.text))) throw new Error('textLimit')
  }
  return { name: file.name, fingerprint, sheets }
}
