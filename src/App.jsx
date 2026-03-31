import { useState, useEffect } from 'react'
import InvoiceTab from './components/InvoiceTab'
import DataEditorTab from './components/DataEditorTab'
import SettingsTab from './components/SettingsTab'

const PRODUCT_COLS = ['Code', 'ITEM NAME', 'NEW PRICE']
const CUSTOMER_COLS = ['TraderID', 'Company', 'ContactPerson', 'Mobile', 'WorkPhone', 'Address', 'City', 'Zone', 'Bulk (Discount % )', 'Special (Discount % )']

const TABS = [
  { id: 'invoice', label: 'Invoice' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState('invoice')
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [settings, setSettings] = useState({})
  const [theme, setTheme] = useState('light')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const [s, p, c, t] = await Promise.all([
        window.api.getSettings(),
        window.api.getProducts(),
        window.api.getCustomers(),
        window.api.getTheme(),
      ])
      setSettings(s)
      setProducts(p)
      setCustomers(c)
      setTheme(t)
      setLoading(false)
    }
    init()
    window.api.onThemeChange(t => setTheme(t))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  async function handleLogin(u, p) {
    if (u === 'admin' && p === 'admin') {
      setUser({ username: 'admin', role: 'admin' })
      setLoginError('')
    } else if (u === 'user' && p === 'user') {
      setUser({ username: 'user', role: 'user' })
      setTab('invoice')
      setLoginError('')
    } else {
      setLoginError('Invalid credentials. Please try again.')
    }
  }

  function handleLogout() {
    setUser(null)
    setTab('invoice')
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 28 }}>⚙</div>
      <div style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading Tayyebi Invoicing…</div>
    </div>
  )

  const filteredTabs = TABS.filter(t => {
    if (!user) return false
    if (user.role === 'admin') return true
    return t.id === 'invoice'
  })

  // Derive columns dynamically from actual data if available
  const prodCols = products.length > 0 ? Object.keys(products[0]) : PRODUCT_COLS
  const custCols = customers.length > 0 ? Object.keys(customers[0]) : CUSTOMER_COLS

  return (
    <>
      {!user && <LoginModal onLogin={handleLogin} error={loginError} />}
      
      <div className="app-shell" style={!user ? { filter: 'blur(10px)', pointerEvents: 'none' } : {}}>
        <header className="app-header">
          <div className="header-logo">Tayyebi <span>Invoicing</span></div>
          <nav className="header-tabs">
            {filteredTabs.map(t => (
              <button
                key={t.id}
                className={`header-tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </nav>
          <div className="header-spacer" />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                  {user.role}
                </span>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => window.api.openInvoicesFolder()}
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  📁 View All
                </button>
                <button className="btn logout-btn" onClick={handleLogout}>Logout</button>
              </div>
            )}
            <div className="header-inv">
              Invoice <strong>#{settings.next_invoice_number ?? '…'}</strong>
            </div>
          </div>
        </header>

        <main className="app-body">
          {tab === 'invoice' && (
            <InvoiceTab
              products={products}
              customers={customers}
              settings={settings}
              onSaved={onInvoiceSaved}
            />
          )}
          {tab === 'products' && user?.role === 'admin' && (
            <DataEditorTab
              data={products}
              onSave={saveProducts}
              columns={prodCols}
              title="product"
            />
          )}
          {tab === 'customers' && user?.role === 'admin' && (
            <DataEditorTab
              data={customers}
              onSave={saveCustomers}
              columns={custCols}
              title="customer"
            />
          )}
          {tab === 'settings' && user?.role === 'admin' && (
            <SettingsTab settings={settings} onSaved={onSettingsSaved} />
          )}
        </main>
      </div>
    </>
  )

  async function saveProducts(next) {
    setProducts(next)
    await window.api.saveProducts(next)
  }

  async function saveCustomers(next) {
    setCustomers(next)
    await window.api.saveCustomers(next)
  }

  async function onInvoiceSaved() {
    const s = await window.api.getSettings()
    setSettings(s)
  }

  async function onSettingsSaved(s) {
    setSettings(s)
  }
}

function LoginModal({ onLogin, error }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')

  const submit = (e) => {
    e.preventDefault()
    onLogin(u, p)
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-logo">Tayyebi <span>Dawakhana</span></div>
        <div className="login-subtitle">Invoicing & Management System</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="login-row">
            <label>Username</label>
            <input 
              autoFocus
              value={u} 
              onChange={e => setU(e.target.value)} 
              placeholder="Enter username"
              required
            />
          </div>
          <div className="login-row">
            <label>Password</label>
            <input 
              type="password" 
              value={p} 
              onChange={e => setP(e.target.value)} 
              placeholder="Enter password"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary login-btn">
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
