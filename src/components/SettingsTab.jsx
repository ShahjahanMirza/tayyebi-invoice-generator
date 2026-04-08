import { useState, useEffect } from 'react'

const FIELDS = [
  { key:'next_invoice_number', label:'Next Invoice Number', type:'number' },
  { key:'gst_rate',            label:'Default GST Rate (%)', type:'number' },
  { key:'company_name',        label:'Company Name',        type:'text'   },
  { key:'company_address',     label:'Company Address',     type:'text'   },
  { key:'company_phone',       label:'Company Phone',       type:'text'   },
  { key:'company_ntn',         label:'Company NTN',         type:'text'   },
  { key:'company_gst',         label:'Company GST #',       type:'text'   },
  { key:'company_web',         label:'Company Website',     type:'text'   },
  { key:'default_type',        label:'Default Invoice Type',type:'text'   },
  { key:'default_payment_terms',label:'Default Payment Terms',type:'text' },
  { key:'default_stock_from',  label:'Default Stock From',  type:'text'   },
  { key:'retail_to_trade_discount', label:'Retail Discount % (Trade)', type:'number' },
  { key:'admin_user',                label:'Admin Username',         type:'text'   },
  { key:'admin_pass',                label:'Admin Password',         type:'password' },
  { key:'staff_user',                label:'Staff Username',         type:'text'   },
  { key:'staff_pass',                label:'Staff Password',         type:'password' },
]

export default function SettingsTab({ settings, onSaved, isOnline }) {
  const [form, setForm]       = useState({ ...settings })
  const [saved, setSaved]     = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => { setForm({ ...settings }) }, [settings])
  useEffect(() => { window.api.getVersion().then(v => setVersion(v)) }, [])

  async function handleSave() {
    const payload = { ...form }
    FIELDS.forEach(f => {
      if (f.type === 'number') payload[f.key] = parseFloat(form[f.key]) || 0
    })
    await window.api.saveSettings(payload)
    onSaved?.(payload)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ padding:'24px 32px', maxWidth:1100, margin:'0 auto', overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>Application Settings</h2>
          <p className="muted">Changes apply immediately after saving.</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', background:'var(--surface-2)', borderRadius:20, border:'1px solid var(--border)' }}>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text-3)' }}>THEME:</span>
          {['system', 'light', 'dark'].map(t => (
            <button
              key={t}
              onClick={() => setForm(f => ({ ...f, theme: t }))}
              style={{
                padding:'4px 12px', borderRadius:16, border:'none', fontSize:11, fontWeight:600, textTransform:'uppercase', cursor:'pointer',
                background: form.theme === t ? 'var(--accent)' : 'transparent',
                color: form.theme === t ? '#fff' : 'var(--text-2)',
                transition:'all .15s'
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'flex-start', marginBottom:24 }}>
        <div className="card">
          <div className="section-title">🏢 Company Info</div>
          {FIELDS.slice(2, 8).map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <label>{f.label}</label>
              <input
                type={f.type}
                value={form[f.key] ?? ''}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-title">📄 Invoice Defaults</div>
          {FIELDS.slice(0, 2).concat(FIELDS.slice(8, 12)).map(f => (
            <div key={f.key} style={{ marginBottom:12 }}>
              <label>{f.label}</label>
              <input
                type={f.type}
                value={form[f.key] ?? ''}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="section-title">🔐 Security & Access Control</div>
          <p className="muted" style={{ marginBottom: 15, fontSize: 13 }}>Configure the login credentials for your shop terminals. Changes sync across all workstations.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            {FIELDS.slice(12).map(f => (
              <div key={f.key} style={{ marginBottom:12 }}>
                <label>{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key] ?? ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={`Set ${f.label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={!isOnline}>
          💾 Save Settings
        </button>
        {!isOnline && (
          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
            Settings cannot be saved while offline
          </span>
        )}
        {saved && <span className="badge badge-green">✓ Saved successfully</span>}
      </div>

      <hr className="divider" style={{ margin: '30px 0' }} />
      <div className="section-title">System Information</div>
      <p className="muted" style={{ marginBottom:12, fontSize:13, lineHeight:1.6 }}>
        Your data is fully synchronized with the <strong>Tayyebi Supabase Cloud</strong>. 
        Local data files are maintained for temporary caching and offline recovery.
      </p>
      {version && <p className="muted" style={{ marginBottom:12, fontSize:12 }}>Version <strong>{version}</strong></p>}
      <button className="btn btn-secondary btn-sm" onClick={() => window.api.openDataFolder()}>
        📁 Open Resource Folder
      </button>
    </div>
  )
}
