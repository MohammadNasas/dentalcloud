const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')
const outWebm = path.join(publicDir, 'dentalcloud-intro.webm')
const outPoster = path.join(publicDir, 'dentalcloud-intro-poster.png')
const logoPath = path.join(publicDir, 'logo.png')

const WIDTH = 1280
const HEIGHT = 720
const FPS = 30
const DURATION_SECONDS = 36

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean)
  return candidates.find((p) => fs.existsSync(p))
}

function html() {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>DentalCloud Intro Recorder</title>
  <style>
    html, body { margin: 0; background: #101827; height: 100%; overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
<script>
const WIDTH = ${WIDTH}
const HEIGHT = ${HEIGHT}
const FPS = ${FPS}
const DURATION = ${DURATION_SECONDS}
const canvas = document.getElementById('c')
const ctx = canvas.getContext('2d')
const logo = new Image()
logo.src = '/logo.png'

const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n))
const phase = (t, start, end) => clamp((t - start) / (end - start))
const ep = (t, start, end) => ease(phase(t, start, end))
const fade = (t, start, end) => {
  const inP = phase(t, start, start + 0.7)
  const outP = 1 - phase(t, end - 0.7, end)
  return clamp(Math.min(inP, outP))
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fillRound(x, y, w, h, r, fill, stroke) {
  roundedRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function text(str, x, y, size, color = '#0f172a', weight = 700, align = 'right') {
  ctx.save()
  ctx.direction = 'rtl'
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = weight + ' ' + size + 'px Arial, Tahoma, sans-serif'
  ctx.fillText(str, x, y)
  ctx.restore()
}

function ltr(str, x, y, size, color = '#0f172a', weight = 700, align = 'left') {
  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = weight + ' ' + size + 'px Arial, Tahoma, sans-serif'
  ctx.fillText(str, x, y)
  ctx.restore()
}

function bg(t) {
  const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT)
  g.addColorStop(0, '#f8fafc')
  g.addColorStop(0.54, '#eefcf8')
  g.addColorStop(1, '#eaf3ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.globalAlpha = 0.14
  ctx.fillStyle = '#0d9488'
  ctx.beginPath(); ctx.arc(1060 + Math.sin(t) * 30, 90, 210, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#3b82f6'
  ctx.beginPath(); ctx.arc(120, 650 + Math.cos(t * 0.8) * 20, 230, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
}

function logoMark(x, y, s) {
  fillRound(x, y, s, s, s * 0.22, '#ffffff', '#dbeafe')
  ctx.drawImage(logo, x, y, s, s)
}

function appShell(x, y, w, h, p = 1) {
  ctx.save()
  ctx.globalAlpha = p
  fillRound(x, y, w, h, 22, '#ffffff', '#dbeafe')
  fillRound(x, y, w, 64, 22, '#0f766e')
  fillRound(x, y + 42, w, 22, 0, '#0f766e')
  logoMark(x + w - 54, y + 14, 36)
  text('DentalCloud', x + w - 68, y + 20, 22, '#ffffff', 800)
  for (let i = 0; i < 4; i++) fillRound(x + 26 + i * 18, y + 24, 9, 9, 5, '#ccfbf1')
  fillRound(x + w - 186, y + 20, 92, 24, 12, '#14b8a6')
  text('Ù…ØªØµÙ„', x + w - 126, y + 23, 13, '#ffffff', 800, 'center')
  ctx.restore()
}

function metricCard(x, y, w, h, label, value, accent) {
  fillRound(x, y, w, h, 16, '#ffffff', '#e2e8f0')
  fillRound(x + w - 28, y + 18, 10, h - 36, 7, accent)
  text(label, x + w - 46, y + 18, 18, '#64748b', 700)
  ltr(value, x + 28, y + 45, 34, '#0f172a', 900)
}

function dashboardScene(t, a) {
  appShell(70, 96, 650, 470, a)
  metricCard(110, 190, 170, 116, 'Ø§Ù„Ù…Ø±Ø¶Ù‰', '142', '#0d9488')
  metricCard(300, 190, 170, 116, 'Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„ÙŠÙˆÙ…', '12', '#3b82f6')
  metricCard(490, 190, 170, 116, 'Ø§Ù„ØªØ­ØµÙŠÙ„', '87%', '#f59e0b')
  fillRound(110, 330, 260, 160, 16, '#f8fafc', '#e2e8f0')
  text('Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„ØºØ¯', 340, 352, 20)
  ;['Ø¯. Ø³Ø§Ø±Ø© - 10:00', 'ØªÙ†Ø¸ÙŠÙ - 11:30', 'ØªØ±ÙƒÙŠØ¨ ØªØ§Ø¬ - 13:00'].forEach((v, i) => {
    fillRound(130, 392 + i * 32, 218, 22, 11, ['#ccfbf1', '#dbeafe', '#fef3c7'][i])
    text(v, 330, 394 + i * 32, 14, '#334155', 800)
  })
  fillRound(390, 330, 270, 160, 16, '#f8fafc', '#e2e8f0')
  text('Ø¯ÙØ¹Ø§Øª Ø­Ø¯ÙŠØ«Ø©', 630, 352, 20)
  ;['40 JOD', '120 JOD', '30 JOD'].forEach((v, i) => {
    ltr(v, 422, 392 + i * 32, 18, ['#16a34a', '#3b82f6', '#16a34a'][i], 900)
  })
  text('ÙƒÙ„ Ø´ÙŠØ¡ ÙÙŠ Ø´Ø§Ø´Ø© ÙˆØ§Ø­Ø¯Ø©', 1165, 190, 56, '#0f172a', 900)
  text('Ù…Ø±Ø¶Ù‰ØŒ Ù…ÙˆØ§Ø¹ÙŠØ¯ØŒ Ø¯ÙØ¹Ø§Øª ÙˆØªÙ‚Ø§Ø±ÙŠØ±', 1165, 262, 28, '#475569', 700)
  text('Ù…ØµÙ…Ù… Ù„Ø·Ø¨ÙŠØ¨ Ø§Ù„Ø£Ø³Ù†Ø§Ù†... Ø¨Ø¯ÙˆÙ† ØªØ¹Ù‚ÙŠØ¯', 1165, 310, 25, '#0d9488', 800)
}

function patientScene(t, a) {
  appShell(590, 98, 610, 470, a)
  fillRound(630, 190, 520, 84, 18, '#f8fafc', '#e2e8f0')
  fillRound(1110, 208, 44, 44, 22, '#ccfbf1')
  text('Ù„ÙŠÙ„Ù‰ Ø£Ø­Ù…Ø¯', 1088, 202, 27, '#0f172a', 900)
  text('Ø£Ù„Ù… ÙÙŠ Ø§Ù„Ø¶Ø±Ø³ Ø§Ù„Ø³ÙÙ„ÙŠ Ø§Ù„Ø£ÙŠÙ…Ù†', 1088, 238, 17, '#64748b', 700)
  ;[
    ['ØªØ§Ø±ÙŠØ® Ø·Ø¨ÙŠ ÙˆØ³Ù†ÙŠ ÙƒØ§Ù…Ù„', '#0d9488'],
    ['ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ù„Ù„Ø­Ø³Ø§Ø³ÙŠØ© ÙˆØ§Ù„Ø£Ø¯ÙˆÙŠØ©', '#ef4444'],
    ['ØªØµØ¯ÙŠØ± Ù…Ù„Ù Word Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø©', '#3b82f6'],
  ].forEach((row, i) => {
    fillRound(650, 302 + i * 56, 480, 42, 14, '#ffffff', '#e2e8f0')
    fillRound(1098, 313 + i * 56, 20, 20, 10, row[1])
    text(row[0], 1080, 308 + i * 56, 22, '#334155', 800)
  })
  text('Ù…Ù„Ù Ø§Ù„Ù…Ø±ÙŠØ¶ ØµØ§Ø± Ù…Ø±ØªØ¨', 536, 200, 54, '#0f172a', 900)
  text('Ù…Ù† Ø£ÙˆÙ„ Ø²ÙŠØ§Ø±Ø© Ù„Ø¢Ø®Ø± Ø¯ÙØ¹Ø©', 536, 272, 29, '#475569', 700)
  text('ÙƒÙ„ Ù…Ø¹Ù„ÙˆÙ…Ø© ÙÙŠ Ù…ÙƒØ§Ù†Ù‡Ø§', 536, 320, 25, '#0d9488', 800)
}

function tooth(x, y, color, label) {
  fillRound(x, y, 34, 46, 13, '#ffffff', '#cbd5e1')
  fillRound(x + 7, y + 10, 20, 18, 6, color || '#f8fafc')
  ltr(label, x + 17, y + 52, 12, '#64748b', 800, 'center')
}

function chartScene(t, a) {
  appShell(80, 90, 620, 485, a)
  text('Ù…Ø®Ø·Ø· Ø§Ù„Ø£Ø³Ù†Ø§Ù†', 650, 176, 28, '#0f172a', 900)
  const colors = ['#ef4444', '#3b82f6', '', '#8b5cf6', '#f59e0b', '', '#14b8a6', '#ef4444']
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 8; i++) tooth(140 + i * 58, 230 + row * 78, colors[(i + row) % colors.length], String(18 - i - row * 2))
  }
  ;[
    ['ØªØ´Ø®ÙŠØµ', '#ef4444'],
    ['Ø¹Ù„Ø§Ø¬ Ù…Ù†Ø¬Ø²', '#3b82f6'],
    ['ØªØ§Ø¬ / Ø¹ØµØ¨', '#8b5cf6'],
  ].forEach((r, i) => {
    fillRound(500, 456 + i * 34, 130, 24, 12, '#f8fafc', '#e2e8f0')
    fillRound(606, 462 + i * 34, 12, 12, 6, r[1])
    text(r[0], 596, 458 + i * 34, 15, '#334155', 800)
  })
  text('ØªØ´Ø®ÙŠØµ ÙˆØ¹Ù„Ø§Ø¬', 1160, 185, 57, '#0f172a', 900)
  text('Ø¹Ù„Ù‰ Ù†ÙØ³ Ø§Ù„Ø³Ù†ØŒ Ø¨ØªÙˆØ§Ø±ÙŠØ® ÙˆØ§Ø¶Ø­Ø©', 1160, 260, 28, '#475569', 700)
  text('Ø£Ù„ÙˆØ§Ù†ØŒ Ø£Ø³Ø·Ø­ØŒ ÙˆØ­Ø§Ù„Ø© Ø§Ù„Ø¹Ù„Ø§Ø¬', 1160, 306, 25, '#0d9488', 800)
}

function paymentsScene(t, a) {
  appShell(570, 95, 620, 480, a)
  fillRound(620, 176, 520, 94, 18, '#f0fdfa', '#ccfbf1')
  text('Ø§Ù„Ù…Ø¨Ù„Øº Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ', 1106, 192, 22, '#0f766e', 800)
  ltr('160 JOD', 650, 206, 40, '#0f766e', 900)
  ;[
    ['Ù†Ù‚Ø¯Ø§Ù‹', '40 JOD', '#16a34a'],
    ['Ø¨Ø·Ø§Ù‚Ø©', '120 JOD', '#3b82f6'],
    ['ØªØ£Ù…ÙŠÙ†', '80 JOD', '#8b5cf6'],
  ].forEach((row, i) => {
    fillRound(640, 310 + i * 58, 460, 42, 14, '#ffffff', '#e2e8f0')
    fillRound(1068, 320 + i * 58, 20, 20, 10, row[2])
    text(row[0], 1050, 315 + i * 58, 22, '#334155', 800)
    ltr(row[1], 668, 316 + i * 58, 22, '#0f172a', 900)
  })
  text('Ø¯ÙØ¹Ø§Øª Ø£ÙˆØ¶Ø­', 500, 195, 56, '#0f172a', 900)
  text('Ù…ÙŠÙ† Ø¯ÙØ¹ØŸ ÙˆÙ…ÙŠÙ† Ø¹Ù„ÙŠÙ‡ØŸ', 500, 267, 30, '#475569', 700)
  text('Ù…Ø¹ Ø·Ø±Ù‚ Ø¯ÙØ¹ Ù…ØªØ¹Ø¯Ø¯Ø© ÙˆØªÙ‚Ø§Ø±ÙŠØ± Ø´Ù‡Ø±ÙŠØ©', 500, 315, 24, '#0d9488', 800)
}

function trustScene(t, a) {
  text('Ù„ÙŠØ´ ØªØ·Ù…Ø¦Ù† Ù…Ø¹ DentalCloudØŸ', 1100, 120, 52, '#0f172a', 900)
  const cards = [
    ['Ø¨ÙŠØ§Ù†Ø§Øª ÙƒÙ„ Ø¹ÙŠØ§Ø¯Ø© Ù…Ù†ÙØµÙ„Ø©', 'Ø­Ø³Ø§Ø¨Ùƒ ÙˆÙ…Ø±Ø¶Ù‰ Ø¹ÙŠØ§Ø¯ØªÙƒ Ù„Ø§ ÙŠØ¸Ù‡Ø±ÙˆÙ† Ù„Ø£ÙŠ Ø¹ÙŠØ§Ø¯Ø© Ø£Ø®Ø±Ù‰', '#0d9488'],
    ['ØªØµØ¯ÙŠØ± Ø¨ÙŠØ§Ù†Ø§ØªÙƒ Ø¨Ø£ÙŠ ÙˆÙ‚Øª', 'Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ø±Ø¶Ù‰ Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªØµØ¯ÙŠØ± Ø¥Ù„Ù‰ Word Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø©', '#3b82f6'],
    ['Ø¯Ø¹Ù… Ù…Ø¨Ø§Ø´Ø±', 'Ø¥Ø°Ø§ ÙˆØ§Ø¬Ù‡ØªÙƒ Ù…Ø´ÙƒÙ„Ø©ØŒ Ù†Ø³Ø§Ø¹Ø¯Ùƒ Ø¹Ù„Ù‰ ÙˆØ§ØªØ³Ø§Ø¨ Ø£Ùˆ Ø§Ù„Ø¥ÙŠÙ…ÙŠÙ„', '#f59e0b'],
  ]
  cards.forEach((c, i) => {
    const x = 145 + i * 335
    fillRound(x, 250, 300, 190, 22, '#ffffff', '#e2e8f0')
    fillRound(x + 226, 278, 44, 44, 14, c[2])
    text(c[0], x + 260, 344, 24, '#0f172a', 900)
    text(c[1], x + 260, 386, 17, '#64748b', 700)
  })
}

function finalScene(t, a) {
  logoMark(562, 116, 156)
  ltr('DentalCloud', 640, 304, 66, '#0f172a', 900, 'center')
  text('Ø¬Ø±Ù‘Ø¨ Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø¹ÙŠØ§Ø¯Ø© Ø¨Ø·Ø±ÙŠÙ‚Ø© Ø£ÙˆØ¶Ø­', 640, 390, 36, '#334155', 800, 'center')
  fillRound(420, 462, 440, 60, 18, '#0d9488')
  text('Ø§Ù„Ø¯Ø¹Ù… Ø¬Ø§Ù‡Ø² Ù„Ù…Ø³Ø§Ø¹Ø¯ØªÙƒ', 640, 476, 28, '#ffffff', 900, 'center')
  ltr('dentalcloudd@gmail.com   |   +972599510078', 640, 558, 25, '#0f766e', 800, 'center')
}

function draw(timeMs) {
  const t = timeMs / 1000
  bg(t)
  ctx.save()
  ctx.globalAlpha = fade(t, 0, 5.3)
  const introP = ep(t, 0.2, 1.4)
  logoMark(562, 120 - (1 - introP) * 18, 156)
  ltr('DentalCloud', 640, 310, 64, '#0f172a', 900, 'center')
  text('Ù†Ø¸Ø§Ù… Ø¥Ø¯Ø§Ø±Ø© Ø¹ÙŠØ§Ø¯Ø§Øª Ø§Ù„Ø£Ø³Ù†Ø§Ù†', 640, 398, 36, '#334155', 800, 'center')
  text('Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ø±Ø¶Ù‰ØŒ Ù…Ø®Ø·Ø· Ø§Ù„Ø£Ø³Ù†Ø§Ù†ØŒ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ ÙˆØ§Ù„Ø¯ÙØ¹Ø§Øª ÙÙŠ Ù…ÙƒØ§Ù† ÙˆØ§Ø­Ø¯', 640, 456, 24, '#0d9488', 800, 'center')
  ctx.restore()

  ctx.save(); ctx.globalAlpha = fade(t, 5.2, 11.3); dashboardScene(t, ctx.globalAlpha); ctx.restore()
  ctx.save(); ctx.globalAlpha = fade(t, 11.2, 16.8); patientScene(t, ctx.globalAlpha); ctx.restore()
  ctx.save(); ctx.globalAlpha = fade(t, 16.7, 22.3); chartScene(t, ctx.globalAlpha); ctx.restore()
  ctx.save(); ctx.globalAlpha = fade(t, 22.2, 27.4); paymentsScene(t, ctx.globalAlpha); ctx.restore()
  ctx.save(); ctx.globalAlpha = fade(t, 27.3, 32.1); trustScene(t, ctx.globalAlpha); ctx.restore()
  ctx.save(); ctx.globalAlpha = fade(t, 32.0, DURATION); finalScene(t, ctx.globalAlpha); ctx.restore()
}

async function postBlob(url, blob) {
  await fetch(url, { method: 'POST', body: blob })
}

async function start() {
  await new Promise((resolve) => { if (logo.complete) resolve(); else logo.onload = resolve })

  draw(2200)
  const posterBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  await postBlob('/save-poster', posterBlob)

  const stream = canvas.captureStream(FPS)
  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || ''
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 3600000 } : undefined)
  const chunks = []
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
    await postBlob('/save-video', blob)
    document.body.dataset.done = '1'
  }
  recorder.start(1000)

  const started = performance.now()
  function frame(now) {
    const elapsed = now - started
    draw(elapsed)
    if (elapsed < DURATION * 1000) requestAnimationFrame(frame)
    else recorder.stop()
  }
  requestAnimationFrame(frame)
}

start().catch(async (err) => {
  await fetch('/save-error', { method: 'POST', body: String(err && err.stack || err) })
})
</script>
</body>
</html>`
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function main() {
  const browser = findBrowser()
  if (!browser) {
    throw new Error('Could not find Chrome or Edge. Set CHROME_PATH or EDGE_PATH and try again.')
  }

  fs.mkdirSync(publicDir, { recursive: true })
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'dc-video-profile-'))

  let resolveDone
  let rejectDone
  const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject })

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url === '/' || req.url === '/recorder') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(html())
        return
      }
      if (req.url === '/logo.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        fs.createReadStream(logoPath).pipe(res)
        return
      }
      if (req.url === '/save-poster' && req.method === 'POST') {
        fs.writeFileSync(outPoster, await readBody(req))
        res.writeHead(200); res.end('ok')
        return
      }
      if (req.url === '/save-video' && req.method === 'POST') {
        fs.writeFileSync(outWebm, await readBody(req))
        res.writeHead(200); res.end('ok')
        resolveDone()
        return
      }
      if (req.url === '/save-error' && req.method === 'POST') {
        const error = (await readBody(req)).toString('utf8')
        res.writeHead(200); res.end('ok')
        rejectDone(new Error(error))
        return
      }
      res.writeHead(404); res.end('not found')
    } catch (e) {
      res.writeHead(500); res.end(String(e.message || e))
      rejectDone(e)
    }
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const url = `http://127.0.0.1:${port}/recorder`

  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${tmpProfile}`,
    url,
  ], { stdio: 'ignore' })

  const timeout = setTimeout(() => rejectDone(new Error('Timed out while recording video')), (DURATION_SECONDS + 20) * 1000)

  try {
    await done
    clearTimeout(timeout)
  } finally {
    child.kill()
    server.close()
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true })
    } catch {
      // Edge can keep a profile file locked for a moment after kill(); the OS
      // will clean the temp folder eventually, and the video has already been saved.
    }
  }

  console.log(`Wrote ${path.relative(root, outWebm)}`)
  console.log(`Wrote ${path.relative(root, outPoster)}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
