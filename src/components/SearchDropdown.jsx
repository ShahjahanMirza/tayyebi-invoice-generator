import { useState, useRef, useEffect } from 'react'

export default function SearchDropdown({ values = [], onSelect, placeholder = 'Search…', value = '', width }) {
  const [query, setQuery]       = useState(value)
  const [filtered, setFiltered] = useState([])
  const [open, setOpen]         = useState(false)
  const [hi, setHi]             = useState(-1)
  const wrapRef = useRef()

  const isInternal = useRef(false)
  useEffect(() => { 
    if (!isInternal.current) setQuery(value)
    isInternal.current = false
  }, [value])

  useEffect(() => {
    const handler = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleInput(e) {
    const q = e.target.value
    setQuery(q)
    if (!q) { setFiltered([]); setOpen(false); return }
    
    const lowQ = q.toLowerCase()
    const f = values.filter(v => {
      const text = typeof v === 'string' ? v : `${v.label} ${v.details || ''} ${v.id || ''}`
      return text.toLowerCase().includes(lowQ)
    }).slice(0, 2000)
    
    setFiltered(f)
    setOpen(f.length > 0)
    setHi(-1)
  }

  function showAll() {
    setFiltered(values.slice(0, 2000))
    setOpen(true)
    setHi(-1)
  }

  function pick(v) {
    const label = typeof v === 'string' ? v : v.label
    setQuery(label)
    setOpen(false)
    onSelect?.(v)
  }

  function handleKey(e) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(filtered[hi]) }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="search-wrap" ref={wrapRef} style={width ? { width } : { flex: 1 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={query}
          onChange={handleInput}
          onKeyDown={handleKey}
          onFocus={showAll}
          placeholder={placeholder}
          style={{ flex: 1 }}
          autoComplete="off"
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={showAll} style={{ padding: '7px 10px' }}>▼</button>
      </div>
      {open && filtered.length > 0 && (
        <div className="search-popup">
          {filtered.map((v, i) => {
            const isObj = typeof v !== 'string'
            const label = isObj ? v.label : v
            const details = isObj ? v.details : null
            return (
              <div
                key={isObj ? v.id + i : v + i}
                className={`search-item${i === hi ? ' highlighted' : ''}`}
                onMouseDown={() => pick(v)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:12 }}
              >
                <span>{label}</span>
                {details && <span style={{ fontSize:11, opacity:0.6, fontWeight:400 }}>{details}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
