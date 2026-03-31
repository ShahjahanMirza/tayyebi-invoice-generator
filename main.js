const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')

// ── Storage Path Determination (Unified Folder Strategy) ───────────────────
const isPackaged = app.isPackaged
const ROOT_DIR = isPackaged 
  ? path.dirname(app.getPath('exe'))               // Local to where app is installed
  : path.join(__dirname, 'tayyebi_app_data')       // Local project folder in Dev

const DATA_DIR = path.join(ROOT_DIR, 'Data')
const PDF_DIR  = path.join(ROOT_DIR, 'Invoices')

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(PDF_DIR))  fs.mkdirSync(PDF_DIR,  { recursive: true })

// ── Initial Data Seeding (First Launch) ──────────────────────────────────
function seedInitialData() {
  if (!isPackaged) return // Only for production build

  // Only seed if settings.json doesn't exist yet (first-ever launch)
  const settingsFile = path.join(DATA_DIR, 'settings.json')
  if (fs.existsSync(settingsFile)) return

  const sourceDir = path.join(process.resourcesPath, 'initialData')
  if (!fs.existsSync(sourceDir)) return

  try {
    const files = fs.readdirSync(sourceDir)
    files.forEach(file => {
      const src = path.join(sourceDir, file)
      const dst = path.join(DATA_DIR, file)
      if (!fs.existsSync(dst)) {
        fs.copyFileSync(src, dst)
        console.log(`Seeded initial data: ${file}`)
      }
    })
  } catch (e) {
    console.error('Data seeding failed:', e)
  }
}
seedInitialData()

const FILES = {
  settings:  path.join(DATA_DIR, 'settings.json'),
  products:  path.join(DATA_DIR, 'products.json'),
  customers: path.join(DATA_DIR, 'customers.json'),
  history:   path.join(DATA_DIR, 'history.json'),
}

// ── Automatic Migration (From AppData to Local) ─────────────────────────────
function migrateData() {
  const oldDataDir = path.join(app.getPath('userData'), 'tayyebi_data')
  if (fs.existsSync(oldDataDir)) {
    const files = fs.readdirSync(oldDataDir)
    files.forEach(file => {
      const oldPath = path.join(oldDataDir, file)
      const newPath = path.join(DATA_DIR, file)
      if (!fs.existsSync(newPath)) {
        try {
          fs.copyFileSync(oldPath, newPath)
          console.log(`Migrated: ${file}`)
        } catch (e) { console.error(`Migration failed for ${file}:`, e) }
      }
    })
  }
}
migrateData()

// ── Window ────────────────────────────────────────────────────────────────
let win

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Tayyebi Invoicing System',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (!isPackaged) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  win.setMenuBarVisibility(false)
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── Generic JSON helpers ───────────────────────────────────────────────────
function readJSON(filePath, fallback = null) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (e) { console.error('readJSON error:', e) }
  return fallback
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

// ── Automated Backups ───────────────────────────────────────────────────────
function backupData() {
  try {
    const settings = readJSON(FILES.settings, {})
    const backupRoot = settings.backup_path || "C:\\Tayyebi_Invoices_Backup"
    
    if (!fs.existsSync(backupRoot)) fs.mkdirSync(backupRoot, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupDir = path.join(backupRoot, `Backup_${timestamp}`)
    fs.mkdirSync(backupDir, { recursive: true })

    const filesToBackup = ['products.json', 'customers.json', 'history.json', 'settings.json']
    filesToBackup.forEach(file => {
      const src = path.join(DATA_DIR, file)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, file))
      }
    })
    console.log(`Backup completed to: ${backupDir}`)
  } catch (e) {
    console.error('Automated backup failed:', e)
  }
}

// ── IPC: data ─────────────────────────────────────────────────────────────
ipcMain.handle('get-settings', () => {
  const defaults = {
    next_invoice_number: 49500,
    gst_rate: 1.0,
    backup_path: "C:\\Tayyebi_Invoices_Backup",
    company_name:    'Tayyebi Dawakhana (Pvt) Ltd.',
    company_address: '11 B-4, Commercial Area, Nazimabad No. 2, Karachi Pakistan.',
    company_phone:   '021-36600703-4, 36603036, 36602189',
    company_ntn:     '0659124-7',
    company_gst:     '11-00-3000-001-37',
    company_web:     'www.tayyebi.com.pk',
    default_type:          'Commercial Invoice',
    default_payment_terms: 'Cash on Delivery',
    default_stock_from:    '/HO/',
  }
  const saved = readJSON(FILES.settings, {})
  return { ...defaults, ...saved }
})

ipcMain.handle('save-settings', (_, data) => {
  const oldSettings = readJSON(FILES.settings, {})
  writeJSON(FILES.settings, data)
  if (data.theme !== oldSettings.theme) {
    let themeToUse = data.theme
    if (!themeToUse || themeToUse === 'system') {
      themeToUse = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    }
    win?.webContents.send('theme-changed', themeToUse)
  }
  return true
})

ipcMain.handle('get-products', () => {
  const raw = readJSON(FILES.products, [])
  return raw.map(p => ({
    ...p,
    'NEW PRICE': parseFloat(String(p['NEW PRICE'] || '0').replace(',', '')) || 0,
    'Code':      String(p['Code'] || '').trim(),
    'ITEM NAME': String(p['ITEM NAME'] || '').trim(),
  }))
})

ipcMain.handle('save-products', (_, data) => { writeJSON(FILES.products, data); return true })

ipcMain.handle('get-customers', () => {
  const raw = readJSON(FILES.customers, [])
  return raw.map(c => ({
    ...c,
    'Special (Discount % )': parseFloat(String(c['Special (Discount % )'] || '0').replace(',', '')) || 0,
    'Bulk (Discount % )':    parseFloat(String(c['Bulk (Discount % )']    || '0').replace(',', '')) || 0,
    'Company':               String(c['Company'] || '').trim(),
  }))
})

ipcMain.handle('save-customers', (_, data) => { writeJSON(FILES.customers, data); return true })

ipcMain.handle('get-history', () => readJSON(FILES.history, []))

ipcMain.handle('save-invoice', (_, invoiceData) => {
  const history = readJSON(FILES.history, [])
  
  // Check for duplicate invoice number
  const isDuplicate = history.some(inv => String(inv.invoice_number) === String(invoiceData.invoice_number))
  if (isDuplicate) {
    throw new Error(`Invoice #${invoiceData.invoice_number} already exists in history. Please use a unique number.`)
  }

  history.push({ ...invoiceData, saved_at: new Date().toISOString() })
  writeJSON(FILES.history, history)

  // Increment invoice number in settings
  const settings = readJSON(FILES.settings, {})
  settings.next_invoice_number = (parseInt(invoiceData.invoice_number) || settings.next_invoice_number) + 1
  writeJSON(FILES.settings, settings)
  return true
})

// ── IPC: PDF generation ───────────────────────────────────────────────────
ipcMain.handle('generate-pdf', async (_, { invoiceData, settings }) => {
  const { generateInvoicePDF } = require('./pdfGenerator')

  // Add a small timestamp to the filename for extra safety
  const ts = new Date().getTime().toString().slice(-4)
  const safeCustomer = invoiceData.customer_name.replace(/[^a-z0-9]/gi, '_')
  const filePath = path.join(
    PDF_DIR,
    `Invoice_${invoiceData.invoice_number}_${safeCustomer}_${ts}.pdf`
  )

  try {
    await generateInvoicePDF(invoiceData, settings, filePath)
    shell.openPath(filePath)
    
    // Trigger automated backup
    backupData()

    return { success: true, filePath }
  } catch (e) {
    console.error('PDF error:', e)
    return { success: false, reason: e.message }
  }
})

// ── IPC: theme ────────────────────────────────────────────────────────────
ipcMain.handle('get-theme', () => {
  const settings = readJSON(FILES.settings, {})
  if (settings.theme === 'dark' || settings.theme === 'light') return settings.theme
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})

nativeTheme.on('updated', () => {
  const settings = readJSON(FILES.settings, {})
  if (!settings.theme || settings.theme === 'system') {
    win?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  }
})

// ── IPC: open folders ───────────────────────────────────────────────────
ipcMain.handle('open-data-folder', () => shell.openPath(DATA_DIR))
ipcMain.handle('open-invoices-folder', () => shell.openPath(PDF_DIR))
