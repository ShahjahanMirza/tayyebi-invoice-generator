const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  checkOnline:    ()       => ipcRenderer.invoke('check-online'),
  getSettings:    ()       => ipcRenderer.invoke('get-settings'),
  saveSettings:   (data)   => ipcRenderer.invoke('save-settings', data),
  getProducts:    ()       => ipcRenderer.invoke('get-products'),
  saveProducts:   (data)   => ipcRenderer.invoke('save-products', data),
  getCustomers:   ()       => ipcRenderer.invoke('get-customers'),
  saveCustomers:  (data)   => ipcRenderer.invoke('save-customers', data),
  getHistory:     ()       => ipcRenderer.invoke('get-history'),
  saveInvoice:    (data)   => ipcRenderer.invoke('save-invoice', data),
  generatePDF:    (payload)=> ipcRenderer.invoke('generate-pdf', payload),
  getTheme:       ()       => ipcRenderer.invoke('get-theme'),
  getVersion:     ()       => ipcRenderer.invoke('get-version'),
  checkForUpdate: ()       => ipcRenderer.invoke('check-for-update'),
  openDataFolder: ()       => ipcRenderer.invoke('open-data-folder'),
  openInvoicesFolder: ()   => ipcRenderer.invoke('open-invoices-folder'),
  onThemeChange:  (cb)     => ipcRenderer.on('theme-changed', (_, theme) => cb(theme)),
  onUpdateStatus: (cb)     => ipcRenderer.on('update-status', (_, data) => cb(data)),
})
