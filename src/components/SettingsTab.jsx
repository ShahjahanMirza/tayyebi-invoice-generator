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
  { key:'backup_path',         label:'Backup Folder Path',  type:'text'   },
]

export default function SettingsTab({ settings, onSaved }) {
  const [form, setForm]   = useState({ ...settings })
  const [saved, setSaved] = useState(false)

  useEffect(() => { setForm({ ...settings }) }, [settings])

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

      <div style={{ display:'flex', gap:20, alignItems:'flex-start', marginBottom:24 }}>
        <div className="card" style={{ flex:1 }}>
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

        <div className="card" style={{ flex:1 }}>
          <div className="section-title">📄 Invoice Defaults</div>
          {FIELDS.slice(0, 2).concat(FIELDS.slice(8)).map(f => (
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
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <button className="btn btn-primary" onClick={handleSave}>💾 Save Settings</button>
        {saved && <span className="badge badge-green">✓ Saved successfully</span>}
      </div>

      <hr className="divider" />
      <div className="section-title">Data Files</div>
      <p className="muted" style={{ marginBottom:12, fontSize:13, lineHeight:1.6 }}>
        All data (customers, products, invoices, settings) is stored in your local AppData folder.
        You can back this folder up or transfer it to another machine.
      </p>
      <button className="btn btn-secondary btn-sm" onClick={() => window.api.openDataFolder()}>
        📁 Open Data Folder
      </button>
    </div>
  )
}
