import { useState, useEffect } from 'react'

export default function NumberSpinner({ value, onChange, min = 1, step = 1, style, inputStyle, className }) {
  const [internal, setInternal] = useState(String(value))

  useEffect(() => {
    setInternal(String(value))
  }, [value])

  function commit(v) {
    let n = parseFloat(v)
    if (isNaN(n) || n < min) n = min
    onChange(n)
  }

  function handleIn(v) {
    setInternal(v)
  }

  function handleBlur() {
    commit(internal)
  }

  function inc(dir) {
    const next = (parseFloat(internal) || 0) + (dir * step)
    setInternal(String(Math.max(min, next)))
    commit(Math.max(min, next))
  }

  return (
    <div className={`number-spinner ${className || ''}`} style={{ display:'inline-flex', alignItems:'center', ...style }}>
      <button 
        onClick={() => inc(-1)} 
        disabled={(parseFloat(internal) || 0) <= min}
        style={{ width:24, height:28, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', borderRadius:'var(--radius-sm) 0 0 var(--radius-sm)', cursor:'pointer' }}
      >—</button>
      <input
        type="text"
        value={internal}
        onChange={e => handleIn(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => e.key === 'Enter' && handleBlur()}
        style={{ 
          width: 50, height:28, textAlign:'center', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)', borderLeft:'none', borderRight:'none', borderRadius:0, padding:0, ...inputStyle 
        }}
      />
      <button 
        onClick={() => inc(1)} 
        style={{ width:24, height:28, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text)', borderRadius:'0 var(--radius-sm) var(--radius-sm) 0', cursor:'pointer' }}
      >+</button>
    </div>
  )
}
