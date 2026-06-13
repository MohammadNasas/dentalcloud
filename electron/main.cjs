// Electron main process — wraps the DentaCare web app as a desktop application.
const { app, BrowserWindow, shell, Menu, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

const isDev = !app.isPackaged
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#f4f7fa',
    title: 'DentalCloud',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // Remove the default application menu for a clean app feel.
  Menu.setApplicationMenu(null)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Print sheets (window.open) open as child windows; external http links go to
  // the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url === 'about:blank') {
      return { action: 'allow' }
    }
    if (url.startsWith('http')) {
      shell.openExternal(url)
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })
}

// Auto-update: in the installed app, check GitHub Releases for a newer version,
// download it in the background, then prompt the user to restart and apply it
// right away. Relying on "install on quit" alone is unreliable (force-quitting
// from Task Manager skips it), so we surface an explicit "Restart now" dialog.
let updatePromptShown = false
function setupAutoUpdates() {
  if (!app.isPackaged) return // updates only apply to the installed desktop app
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true // fallback: still applies on normal quit

  autoUpdater.on('error', (err) => console.error('[updater]', err == null ? 'unknown' : err.message || err))
  autoUpdater.on('checking-for-update', () => console.log('[updater] checking…'))
  autoUpdater.on('update-available', (info) => console.log('[updater] update available:', info?.version))
  autoUpdater.on('update-not-available', () => console.log('[updater] up to date'))
  autoUpdater.on('download-progress', (p) => console.log(`[updater] downloading ${Math.round(p.percent)}%`))

  autoUpdater.on('update-downloaded', (info) => {
    if (updatePromptShown) return
    updatePromptShown = true
    const win = BrowserWindow.getAllWindows()[0]
    dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['أعد التشغيل الآن', 'لاحقاً'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'تحديث جديد لـ DentalCloud',
      message: `النسخة ${info?.version || 'الجديدة'} جاهزة`,
      detail: 'تم تنزيل تحديث جديد. أعد تشغيل التطبيق الآن لتطبيقه — أو سيُطبَّق تلقائياً عند إغلاق التطبيق.',
    }).then((res) => {
      if (res.response === 0) { setImmediate(() => autoUpdater.quitAndInstall()) }
      else { updatePromptShown = false } // allow re-prompt on next check
    }).catch(() => { updatePromptShown = false })
  })

  autoUpdater.checkForUpdates().catch(() => {})
  // Re-check every 2 hours for apps that stay open all day.
  setInterval(() => { autoUpdater.checkForUpdates().catch(() => {}) }, 2 * 60 * 60 * 1000)
}

app.whenReady().then(() => {
  createWindow()
  setupAutoUpdates()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
