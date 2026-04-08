const { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')
const { createClient } = require('@supabase/supabase-js')
const { autoUpdater } = require('electron-updater')

// ── Supabase Configuration ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://etedxnlemuauwkxctcav.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZWR4bmxlbXVhdXdreGN0Y2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTY4NjksImV4cCI6MjA5MDYzMjg2OX0.dKIf1tmSiYgGDLraTHOUEalZDZ-4rg_Jc8Jvn9u-wVk'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Storage Paths ──────────────────────────────────────────────────────────
const isPackaged = app.isPackaged
const ROOT_DIR = isPackaged
  ? path.dirname(app.getPath('exe'))
  : path.join(__dirname, 'tayyebi_app_data')

const PDF_DIR = path.join(ROOT_DIR, 'Invoices')
const DATA_DIR = path.join(ROOT_DIR, 'Data')
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true })
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

// ── Seed local JSON files from bundled initialData on first install ────────
if (isPackaged) {
  const SEED_DIR = path.join(process.resourcesPath, 'initialData')
  const SEED_FILES = ['products.json', 'customers.json', 'settings.json', 'history.json']
  for (const file of SEED_FILES) {
    const dest = path.join(DATA_DIR, file)
    const src  = path.join(SEED_DIR, file)
    if (!fs.existsSync(dest) && fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, dest)
        console.log(`Seeded ${file} from bundled data`)
      } catch (e) {
        console.error(`Failed to seed ${file}:`, e)
      }
    }
  }
}

// ── Local JSON Helpers ─────────────────────────────────────────────────────
function readLocalJSON(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (e) {
    console.error(`readLocalJSON(${filename}) error:`, e)
    return null
  }
}

function writeLocalJSON(filename, data) {
  try {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error(`writeLocalJSON(${filename}) error:`, e)
  }
}

// ── Connectivity Check ─────────────────────────────────────────────────────
async function checkOnline() {
  try {
    const { error } = await supabase.from('app_settings').select('key').limit(1)
    return !error
  } catch {
    return false
  }
}

// ── Auto-Updater (production only) ─────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates…')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Update available: v${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date.')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Updater] Downloading: ${Math.round(progress.percent)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Updater] Update downloaded: v${info.version}`)
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'The application will restart to install the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message)
  })

  autoUpdater.checkForUpdatesAndNotify()
}

// ── Window Management ───────────────────────────────────────────────────────
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
    // win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  win.setMenuBarVisibility(false)
}

app.whenReady().then(() => {
  createWindow()
  if (isPackaged) setupAutoUpdater()
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── IPC: Connectivity ──────────────────────────────────────────────────────
ipcMain.handle('check-online', () => checkOnline())

// ── IPC: Products ──────────────────────────────────────────────────────────
ipcMain.handle('get-products', async () => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true })
    if (error) throw error
    const mapped = data.map(p => ({
      'Code': p.code,
      'ITEM NAME': p.name,
      'NEW PRICE': p.price
    }))
    writeLocalJSON('products.json', mapped)
    return mapped
  } catch (e) {
    console.error('get-products error (trying local fallback):', e)
    const local = readLocalJSON('products.json')
    return local || []
  }
})

ipcMain.handle('save-products', async (_, products) => {
  try {
    const online = await checkOnline()
    if (!online) return { offline: true, error: 'Cannot save products while offline' }

    const incomingCodes = products.map(p => String(p['Code']))
    await supabase.from('products').delete().not('code', 'in', `(${incomingCodes.join(',')})`)

    const formatted = products.map(p => ({
      code: String(p['Code']),
      name: p['ITEM NAME'],
      price: parseFloat(p['NEW PRICE']) || 0
    }))
    const { error } = await supabase.from('products').upsert(formatted, { onConflict: 'code' })
    if (!error) writeLocalJSON('products.json', products)
    return !error
  } catch (e) {
    console.error('save-products error:', e)
    return false
  }
})

// ── IPC: Customers ─────────────────────────────────────────────────────────
ipcMain.handle('get-customers', async () => {
  try {
    const { data, error } = await supabase.from('customers').select('*').order('company', { ascending: true })
    if (error) throw error
    const mapped = data.map(c => ({
      'TraderID': c.trader_id,
      'Company': c.company,
      'Sales Man': c.sales_man,
      'ContactPerson': c.contact_person,
      'Mobile': c.mobile,
      'WorkPhone': c.work_phone,
      'Area': c.area,
      'Address': c.address,
      'City': c.city,
      'Zone': c.zone,
      'Bulk (Discount % )': c.bulk_discount,
      'Special (Discount % )': c.special_discount
    }))
    writeLocalJSON('customers.json', mapped)
    return mapped
  } catch (e) {
    console.error('get-customers error (trying local fallback):', e)
    const local = readLocalJSON('customers.json')
    return local || []
  }
})

ipcMain.handle('save-customers', async (_, customers) => {
  try {
    const online = await checkOnline()
    if (!online) return { offline: true, error: 'Cannot save customers while offline' }

    const incomingIds = customers.map(c => String(c['TraderID'] || ''))
    await supabase.from('customers').delete().not('trader_id', 'in', `(${incomingIds.join(',')})`)

    const formatted = customers.map(c => ({
      trader_id: String(c['TraderID'] || ''),
      company: c['Company'] || '',
      sales_man: c['Sales Man'] || '',
      contact_person: c['ContactPerson'] || '',
      mobile: c['Mobile'] || '',
      work_phone: c['WorkPhone'] || '',
      area: c['Area'] || '',
      address: c['Address'] || '',
      city: c['City'] || '',
      zone: c['Zone'] || '',
      bulk_discount: parseFloat(c['Bulk (Discount % )']) || 0,
      special_discount: parseFloat(c['Special (Discount % )']) || 0
    }))
    const { error } = await supabase.from('customers').upsert(formatted, { onConflict: 'trader_id' })
    if (!error) writeLocalJSON('customers.json', customers)
    return !error
  } catch (e) {
    console.error('save-customers error:', e)
    return false
  }
})

// ── IPC: Settings ──────────────────────────────────────────────────────────
ipcMain.handle('get-settings', async () => {
  const defaults = {
    next_invoice_number: 1,
    gst_rate: 1.0,
    company_name:    'Tayyebi Dawakhana (Pvt) Ltd.',
    company_address: '11 B-4, Commercial Area, Nazimabad No. 2, Karachi Pakistan.',
    company_phone:   '021-36600703-4, 36603036, 36602189',
    company_ntn:     '0659124-7',
    company_gst:     '11-00-3000-001-37',
    company_web:     'www.tayyebi.com.pk',
    default_type:          'Commercial Invoice',
    default_payment_terms: 'Cash on Delivery',
    default_stock_from:    '/HO/',
    retail_to_trade_discount: 15,
    gst_rate: 1.0,
    admin_user: 'admin',
    admin_pass: 'admin123',
    staff_user: 'staff',
    staff_pass: 'staff123',
    theme: 'light'
  }

  try {
    const { data, error } = await supabase.from('app_settings').select('*')
    if (error || !data) throw new Error('Supabase unavailable')
    const cloudSettings = {}
    data.forEach(item => { cloudSettings[item.key] = item.value })

    // Reconcile invoice counter: if local counter is ahead (offline invoices were created),
    // push it up to Supabase so we don't hand out the same number again
    const localCache = readLocalJSON('settings.json')
    const localNextNum  = parseInt(localCache?.next_invoice_number ?? 0)
    const cloudNextNum  = parseInt(cloudSettings.next_invoice_number ?? 0)
    if (localNextNum > cloudNextNum) {
      await supabase.from('app_settings').upsert({ key: 'next_invoice_number', value: localNextNum })
      cloudSettings.next_invoice_number = localNextNum
    }

    const merged = { ...defaults, ...cloudSettings }
    writeLocalJSON('settings.json', merged)
    return merged
  } catch (e) {
    console.error('get-settings error (trying local fallback):', e)
    const local = readLocalJSON('settings.json')
    return local ? { ...defaults, ...local } : defaults
  }
})

ipcMain.handle('save-settings', async (_, data) => {
  try {
    const online = await checkOnline()
    if (!online) return { offline: true, error: 'Cannot save settings while offline' }

    const formatted = Object.entries(data).map(([key, value]) => ({ key, value }))
    const { error } = await supabase.from('app_settings').upsert(formatted)
    if (error) throw error

    writeLocalJSON('settings.json', data)

    // Theme notification
    const themeToUse = (data.theme === 'system' || !data.theme)
      ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
      : data.theme
    win?.webContents.send('theme-changed', themeToUse)

    return true
  } catch (e) {
    console.error('save-settings error:', e)
    return false
  }
})

// ── IPC: History & Invoices ────────────────────────────────────────────────
ipcMain.handle('get-history', async () => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .order('saved_at', { ascending: false })
    if (error) throw error
    writeLocalJSON('history.json', data)
    return data
  } catch (e) {
    console.error('get-history error (trying local fallback):', e)
    const local = readLocalJSON('history.json')
    return local || []
  }
})

ipcMain.handle('save-invoice', async (_, invoiceData) => {
  const online = await checkOnline()

  // Helper to append/update invoice in local history cache
  function appendToLocalHistory(invoice, synced) {
    const history = readLocalJSON('history.json') || []
    const existingIdx = history.findIndex(h => h.invoice_number === invoice.invoice_number)
    if (existingIdx >= 0) {
      // Update existing entry (e.g. offline invoice now being synced)
      history[existingIdx] = { ...history[existingIdx], ...invoice, synced }
    } else {
      history.unshift({ ...invoice, saved_at: new Date().toISOString(), synced, items: invoice.items || [] })
    }
    writeLocalJSON('history.json', history)
  }

  if (!online) {
    // ── Offline: save locally ──
    try {
      // Check local duplicates
      const history = readLocalJSON('history.json') || []
      if (history.some(h => h.invoice_number === invoiceData.invoice_number)) {
        throw new Error(`Invoice #${invoiceData.invoice_number} already exists locally!`)
      }

      appendToLocalHistory(invoiceData, false)

      // Increment local invoice counter
      const localSettings = readLocalJSON('settings.json') || {}
      localSettings.next_invoice_number = (parseInt(invoiceData.invoice_number) || 0) + 1
      writeLocalJSON('settings.json', localSettings)

      return { offline: true, success: true }
    } catch (e) {
      console.error('save-invoice offline error:', e)
      throw e
    }
  }

  // ── Online: save to Supabase ──
  try {
    // Resolve the actual invoice number — handle conflicts by auto-incrementing
    let invoiceNumber = invoiceData.invoice_number
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('id')
        .eq('invoice_number', invoiceNumber)
        .maybeSingle()
      if (!existing) break
      // This number is taken (another machine beat us to it) — get latest from Supabase
      const { data: counterRow } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'next_invoice_number')
        .maybeSingle()
      invoiceNumber = parseInt(counterRow?.value ?? invoiceNumber) + attempt
    }

    const { error: invErr } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      date: invoiceData.date,
      inv_type: invoiceData.inv_type,
      payment_terms: invoiceData.payment_terms,
      stock_from: invoiceData.stock_from,
      po_number: invoiceData.po_number,
      challan_number: invoiceData.challan_number,
      customer_name: invoiceData.customer_name,
      address: invoiceData.address,
      contact: invoiceData.contact,
      phone: invoiceData.phone,
      subtotal: invoiceData.subtotal,
      gst_amount: invoiceData.gst_amount,
      grand_total: invoiceData.grand_total,
      saved_at: new Date().toISOString()
    })

    if (invErr) throw invErr

    if (invoiceData.items && invoiceData.items.length > 0) {
      const formattedItems = invoiceData.items.map(item => ({
        invoice_id: invoiceNumber,
        code: item.code,
        name: item.name,
        qty: item.qty,
        bonus: item.bonus,
        retail: item.retail,
        disc_r: item.disc_r,
        gst_r: item.gst_r,
        exp: item.exp,
        disc_a: item.disc_a,
        disc_t: item.disc_t,
        sub: item.sub,
        gst_a: item.gst_a,
        gst_t: item.gst_t,
        total: item.total
      }))
      const { error: itemsErr } = await supabase.from('invoice_items').insert(formattedItems)
      if (itemsErr) console.error('Items fail:', itemsErr)
    }

    const nextNum = (parseInt(invoiceNumber) || 0) + 1
    await supabase.from('app_settings').upsert({ key: 'next_invoice_number', value: nextNum })

    appendToLocalHistory({ ...invoiceData, invoice_number: invoiceNumber }, true)
    return { invoice_number: invoiceNumber }
  } catch (e) {
    console.error('save-invoice error:', e)
    throw e
  }
})

// ── IPC: PDF Generation ────────────────────────────────────────────────────
ipcMain.handle('generate-pdf', async (_, { invoiceData, settings }) => {
  const { generateInvoicePDF } = require('./pdfGenerator')
  const ts = new Date().getTime().toString().slice(-4)
  const safeCustomer = invoiceData.customer_name.replace(/[^a-z0-9]/gi, '_')
  const originalPath  = path.join(PDF_DIR, `Invoice_${invoiceData.invoice_number}_${safeCustomer}_${ts}.pdf`)
  const duplicatePath = path.join(PDF_DIR, `Invoice_${invoiceData.invoice_number}_${safeCustomer}_${ts}_DUP.pdf`)

  try {
    // Generate Original
    await generateInvoicePDF(invoiceData, settings, originalPath, 'Original')

    // Generate Duplicate (local only)
    await generateInvoicePDF(invoiceData, settings, duplicatePath, 'Duplicate')
    
    // Cloud Backup (Original only)
    try {
      const fileBuffer = fs.readFileSync(originalPath)
      const cloudPath = `INV_${invoiceData.invoice_number}_${safeCustomer}.pdf`
      
      const { error: uploadErr } = await supabase.storage
        .from('invoices')
        .upload(cloudPath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true
        })

      if (uploadErr) console.error('Cloud backup fail:', uploadErr.message)
      else {
        const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(cloudPath)
        await supabase.from('invoices')
          .update({ cloud_pdf_url: publicUrl })
          .eq('invoice_number', invoiceData.invoice_number)
      }
    } catch (bkErr) {
      console.warn('Cloud sync issue:', bkErr.message)
    }

    shell.openPath(originalPath)
    shell.openPath(duplicatePath)
    return { success: true, filePath: originalPath }
  } catch (e) {
    console.error('PDF error:', e)
    return { success: false, reason: e.message }
  }
})

// ── IPC: Utility & UI ──────────────────────────────────────────────────────
ipcMain.handle('get-theme', async () => {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'theme').maybeSingle()
    if (error) throw error
    const theme = data?.value
    if (theme === 'dark' || theme === 'light') return theme
  } catch (e) {
    const local = readLocalJSON('settings.json')
    if (local?.theme === 'dark' || local?.theme === 'light') return local.theme
  }
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})

ipcMain.handle('open-invoices-folder', () => shell.openPath(PDF_DIR))
ipcMain.handle('get-version', () => app.getVersion())
