// Electron main process — wraps the DentaCare web app as a desktop application.
const { app, BrowserWindow, shell, Menu } = require('electron')
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

// Auto-update: in the installed app, quietly check GitHub Releases for a newer
// version, download it in the background, and install it on the next restart.
// Errors (offline, or no release published yet) are swallowed so they never
// block the app from starting.
function setupAutoUpdates() {
  if (!app.isPackaged) return // updates only apply to the installed desktop app
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('error', (err) => console.error('[updater]', err == null ? 'unknown' : err.message || err))
  autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  // Re-check every 6 hours for apps that stay open all day.
  setInterval(() => { autoUpdater.checkForUpdatesAndNotify().catch(() => {}) }, 6 * 60 * 60 * 1000)
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
