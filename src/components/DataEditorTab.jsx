import { useState, useMemo, useEffect } from 'react'

export default function DataEditorTab({ data, onSave, columns, title }) {
  const emptyRow = useMemo(() => Object.fromEntries(columns.map(c => [c, ''])), [columns])
  const [form,    setForm]    = useState(emptyRow)
  const [selIdx,  setSelIdx]  = useState(-1)
  const [search,  setSearch]  = useState('')
  const [sortCol, setSortCol] = useState(columns[0])
  const [sortDir, setSortDir] = useState(1)
  const pk = useMemo(() => title === 'customer' ? 'TraderID' : 'Code', [title])

  useEffect(() => {
    if (selIdx === -1) {
      const nextId = getNextId(data)
      setForm({ ...emptyRow, [pk]: String(nextId) })
    }
  }, [data, emptyRow, pk, selIdx])

  const getNextId = (items) => {
    const ids = items.map(r => parseInt(String(r[pk]).replace(/\D/g, ''))).filter(n => !isNaN(n))
    return ids.length > 0 ? Math.max(...ids) + 1 : 1
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => columns.some(c => String(row[c] || '').toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = String(a.row[sortCol] || ''), bv = String(b.row[sortCol] || '')
        return av.localeCompare(bv, undefined, { numeric: true }) * sortDir
      })
  }, [data, search, sortCol, sortDir, columns])

  function selectRow(origIdx) {
    setSelIdx(origIdx)
    setForm({ ...emptyRow, ...data[origIdx] })
  }

  function handleSort(col) {
    if (col === sortCol) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(1) }
  }

  async function addRow() {
    const idValue = String(form[pk] || '').trim()
    if (!idValue) {
      alert(`${pk} is required.`)
      return
    }
    if (data.some(r => String(r[pk]).trim() === idValue)) {
      alert(`Duplicate ${pk}: ${idValue} already exists.`)
      return
    }
    const next = [...data, { ...form }]
    await onSave(next)
    clearForm(next)
  }

  async function updateRow() {
    if (selIdx < 0) return
    const idValue = String(form[pk] || '').trim()
    if (!idValue) {
      alert(`${pk} is required.`)
      return
    }
    // Check if the new ID exists in *other* records
    if (data.some((r, i) => i !== selIdx && String(r[pk]).trim() === idValue)) {
      alert(`Duplicate ${pk}: ${idValue} already exists in another record.`)
      return
    }
    const next = data.map((r, i) => i === selIdx ? { ...form } : r)
    await onSave(next)
  }

  async function deleteRow() {
    if (selIdx < 0) return
    if (!confirm('Delete this row?')) return
    const next = data.filter((_, i) => i !== selIdx)
    await onSave(next)
    setSelIdx(-1)
    setForm(emptyRow)
  }

  function clearForm(customData) {
    const items = customData || data
    const nextId = getNextId(items)
    setForm({ ...emptyRow, [pk]: String(nextId) })
    setSelIdx(-1)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', padding:'12px 16px' }}>

      {/* Form */}
      <div className="card" style={{ flexShrink:0, marginBottom:12 }}>
        <div className="section-title">{selIdx >= 0 ? `Editing row ${selIdx + 1}` : `Add new ${title}`}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:12 }}>
          {columns.map(col => (
            <div className="col" key={col} style={{ minWidth: col === 'Address' || col === 'ITEM NAME' || col === 'Company' ? 240 : 140 }}>
              <label>{col}</label>
              <input
                value={form[col] ?? ''}
                onChange={e => setForm(f => ({ ...f, [col]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary btn-sm" onClick={addRow}>+ Add New</button>
          <button className="btn btn-secondary btn-sm" onClick={updateRow} disabled={selIdx < 0}>✎ Update Selected</button>
          <button className="btn btn-danger btn-sm" onClick={deleteRow} disabled={selIdx < 0}>✕ Delete Selected</button>
          <button className="btn btn-secondary btn-sm" onClick={() => clearForm()}>✕ Clear</button>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:220 }}
            />
            <span className="muted">{filtered.length} / {data.length} rows</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex:1, overflow:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-md)' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col} onClick={() => handleSort(col)} style={{ cursor:'pointer', userSelect:'none' }}>
                  {col}
                  {sortCol === col ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length} style={{ textAlign:'center', padding:28, color:'var(--text-3)' }}>
                No data found
              </td></tr>
            )}
            {filtered.map(({ row, i }) => (
              <tr key={i}
                onClick={() => selectRow(i)}
                style={{ cursor:'pointer', outline: i === selIdx ? '2px solid var(--accent)' : 'none', outlineOffset:-2 }}>
                {columns.map(col => (
                  <td key={col} style={{ maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {row[col] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
