import { useState, useEffect, useCallback } from 'react'
import SearchDropdown from './SearchDropdown'
import NumberSpinner from './NumberSpinner'

const today = () => new Date().toLocaleDateString('en-GB')

function recalc(item) {
  const p = parseFloat(item.retail) || 0
  const q = parseFloat(item.qty) || 0
  const dr = parseFloat(item.disc_r) || 0
  const gr = parseFloat(item.gst_r) || 0

  const disc_a = p * (dr / 100)        // Discount per unit
  const disc_t = disc_a * q            // Total discount for the row
  const sub = (p * q) - disc_t      // Net amount before tax
  const gst_a = sub * (gr / 100)      // Total GST amount for the row
  const gst_t = gst_a                 // Matching Python: gst_t = gst_a

  return { ...item, disc_a, disc_t, sub, gst_a, gst_t, total: sub + gst_t }
}

export default function InvoiceTab({ products, customers, settings, onSaved }) {
  const [items, setItems] = useState([])
  const [custName, setCustName] = useState('')
  const [custData, setCustData] = useState(null)
  const [prodName, setProdName] = useState('')
  const [prodData, setProdData] = useState(null)
  const [qty, setQty] = useState('1')
  const [bonus, setBonus] = useState('0')
  const [retail, setRetail] = useState('')
  const [expiry, setExpiry] = useState('')
  const [date, setDate] = useState(today())
  const [invType, setInvType] = useState(settings?.default_type || 'Commercial Invoice')
  const [payment, setPayment] = useState(settings?.default_payment_terms || 'Cash on Delivery')
  const [stock, setStock] = useState(settings?.default_stock_from || '/HO/')
  const [poNum, setPoNum] = useState('')
  const [challan, setChallan] = useState('')
  const [saving, setSaving] = useState(false)

  const invNumber = settings?.next_invoice_number ?? '—'
  const grandTotal = items.reduce((s, i) => s + (i.total || 0), 0)
  const subtotal = items.reduce((s, i) => s + (i.sub || 0), 0)
  const gstAmount = items.reduce((s, i) => s + (i.gst_t || 0), 0)

  const productList = products
    .filter(p => p['ITEM NAME'] && String(p['ITEM NAME']).trim() && p['Code'])
    .map(p => ({
      id: p['Code'],
      label: String(p['ITEM NAME']).trim(),
      details: p['Code']
    }))

  const customerList = customers
    .filter(c => c['Company'] && String(c['Company']).trim() && c['TraderID'])
    .map(c => ({
      id: c['TraderID'],
      label: String(c['Company']).trim(),
      details: String(c['TraderID'])
    }))

  function onCustomerChosen(val) {
    const id = typeof val === 'string' ? null : val.id
    const name = typeof val === 'string' ? val : val.label
    setCustName(name)
    const d = id ? customers.find(c => c['TraderID'] === id) : customers.find(c => c['Company'] === name)
    setCustData(d || null)
  }

  function onProductChosen(val) {
    const id = typeof val === 'string' ? null : val.id
    const name = typeof val === 'string' ? val : val.label
    setProdName(name)
    const d = id ? products.find(p => p['Code'] === id) : products.find(p => p['ITEM NAME'] === name)
    setProdData(d || null)
    if (d) setRetail(String(d['NEW PRICE'] ?? ''))
  }

  function addItem() {
    if (!custData) { alert('Please select a customer first.'); return }
    if (!prodName) { alert('Please select a product.'); return }
    const q = parseFloat(qty) || 1
    const p = parseFloat(retail)
    if (q <= 0) { alert('Enter a valid quantity.'); return }
    if (!p || p <= 0) { alert('Enter a valid retail price.'); return }

    const dr = parseFloat(custData['Special (Discount % )'] || 0)
    const gr = parseFloat(settings?.gst_rate || 0)
    const item = recalc({
      code: prodData?.['Code'] || 'N/A',
      name: prodName,
      qty: q,
      bonus: parseFloat(bonus) || 0,
      retail: p,
      disc_r: dr,
      gst_r: gr,
      exp: expiry,
    })
    setItems(prev => [...prev, item])
    setProdName(''); setProdData(null)
    setQty('1'); setRetail(''); setExpiry(''); setBonus('0')
  }

  function deleteItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItemField(idx, field, value) {
    setItems(prev => {
      const next = [...prev]
      next[idx] = recalc({ ...next[idx], [field]: value })
      return next
    })
  }

  function reset() {
    setItems([]); setCustName(''); setCustData(null)
    setPoNum(''); setChallan('')
    setDate(today())
  }

  async function handleFinalize() {
    if (!custData) { alert('Please select a customer.'); return }
    if (items.length < 1) { alert('Add at least one item.'); return }

    setSaving(true)
    const payload = buildPayload()

    try {
      // 1. Save to JSON History
      await window.api.saveInvoice(payload)

      // 2. Generate and Open PDF
      const result = await window.api.generatePDF({ invoiceData: payload, settings })

      onSaved?.()
      reset()
      
      if (!result.success) {
        alert('Invoice saved, but PDF error: ' + result.reason)
      }
    } catch (e) {
      alert('Error finalizing invoice: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function buildPayload() {
    return {
      invoice_number: invNumber,
      date, inv_type: invType, payment_terms: payment, stock_from: stock,
      po_number: poNum, challan_number: challan,
      customer_name: custData?.['Company'] || custName,
      address: custData?.['Address'] || '',
      contact: custData?.['ContactPerson'] || '',
      phone: custData?.['Mobile'] || '',
      items, subtotal, gst_amount: gstAmount, grand_total: grandTotal,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Top panels ── */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px 0', flexShrink: 0 }}>

        {/* Invoice info */}
        <div className="card" style={{ minWidth: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>Invoice Info</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>No.</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{invNumber}</div>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="col flex1">
              <label>Date</label>
              <input value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="col flex1">
              <label>Stock from</label>
              <select value={stock} onChange={e => setStock(e.target.value)}>
                {['/HO/', '/GODOWN/'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="col flex1">
              <label>Type</label>
              <input value={invType} onChange={e => setInvType(e.target.value)} />
            </div>
            <div className="col flex1">
              <label>Payment</label>
              <input value={payment} onChange={e => setPayment(e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="col flex1">
              <label>PO Number</label>
              <input value={poNum} onChange={e => setPoNum(e.target.value)} placeholder="Optional" />
            </div>
            <div className="col flex1">
              <label>Challan Number</label>
              <input value={challan} onChange={e => setChallan(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* Customer card */}
        <div className="card" style={{ flex: 1 }}>
          <div className="section-title">Customer</div>
          <div style={{ marginBottom: 10 }}>
            <label>Company *</label>
            <SearchDropdown
              values={customerList}
              value={custName}
              onSelect={onCustomerChosen}
              placeholder="Search customer…"
            />
          </div>
          {custData ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
              <div><span className="muted">Trader ID: </span>{custData['TraderID'] || '—'}</div>
              <div><span className="muted">Contact: </span>{custData['ContactPerson'] || '—'}</div>
              <div><span className="muted">Phone: </span>{custData['Mobile'] || '—'} {custData['WorkPhone'] ? `/ ${custData['WorkPhone']}` : ''}</div>
              <div><span className="muted">Discount: </span>
                <span className="badge badge-blue">{custData['Special (Discount % )'] || 0}%</span>
              </div>
              <div style={{ gridColumn: '1/-1' }}><span className="muted">Address: </span>{custData['Address'] || '—'}</div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, paddingTop: 8 }}>No customer selected</div>
          )}
        </div>
      </div>

      {/* ── Add product bar ── */}
      <div className="card" style={{ margin: '10px 16px 0', flexShrink: 0 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="col" style={{ flex: 2.5 }}>
            <label>Product *</label>
            <SearchDropdown
              values={productList}
              value={prodName}
              onSelect={onProductChosen}
              placeholder="Search product…"
            />
          </div>
          <div className="col" style={{ width: 80 }}>
            <label>Qty *</label>
            <NumberSpinner value={qty} onChange={v => setQty(String(v))} style={{ width: 80 }} />
          </div>
          <div className="col" style={{ width: 75 }}>
            <label>Bonus</label>
            <NumberSpinner value={bonus || 0} min={0} onChange={v => setBonus(String(v))} style={{ width: 75 }} />
          </div>
          <div className="col" style={{ width: 100 }}>
            <label>Retail *</label>
            <NumberSpinner value={retail || 1} onChange={v => setRetail(String(v))} step={10} style={{ width: 100 }} />
          </div>
          <div className="col" style={{ width: 100 }}>
            <label>Expiry</label>
            <input value={expiry} onChange={e => setExpiry(e.target.value)} placeholder="MM/YY" style={{ width: 100 }} />
          </div>
          <button className="btn btn-primary" onClick={addItem} style={{ height: 36 }}>
            + Add Item
          </button>
        </div>
      </div>

      {/* ── Items table ── */}
      <div className="inv-table-wrap" style={{ margin: '10px 16px 0', flex: 1, minHeight: 0 }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{ width: 32 }}>  </th>
              <th rowSpan="2" style={{ width: 32 }}>#</th>
              <th rowSpan="2" style={{ width: 70 }}>Code</th>
              <th rowSpan="2" className="group-end" style={{ textAlign: 'left', width: 200 }}>Item Name</th>
              <th rowSpan="2" style={{ width: 80 }}>Qty</th>
              <th rowSpan="2" className="group-end" style={{ width: 80 }}>Retail</th>
              <th colSpan="3" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>Discount</th>
              <th rowSpan="2" className="group-end" style={{ width: 90 }}>SubTotal</th>
              <th colSpan="3" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>GST</th>
              <th rowSpan="2" className="group-end" style={{ width: 95 }}>Grand Total</th>
              <th rowSpan="2" style={{ width: 80 }}>Expiry</th>
            </tr>
            <tr className="sub-header">
              <th style={{ width: 55 }}>Rate</th>
              <th style={{ width: 70 }}>Amount</th>
              <th className="group-end" style={{ width: 70 }}>Total</th>
              <th style={{ width: 55 }}>Rate</th>
              <th style={{ width: 75 }}>Amount</th>
              <th className="group-end" style={{ width: 75 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={15} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', background: 'var(--surface)' }}>

                No items added yet. Search for a product above to start.
              </td></tr>
            )}
            {items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <button className="del-btn" onClick={() => deleteItem(idx)}>✕</button>
                </td>
                <td>{idx + 1}</td>
                <td className="mono">{item.code}</td>
                <td className="left group-end">{item.name}</td>
                <td>
                  <NumberSpinner value={item.qty} onChange={v => updateItemField(idx, 'qty', v)} style={{ width: 85 }} />
                </td>
                <td className="group-end">
                  <NumberSpinner value={item.retail} onChange={v => updateItemField(idx, 'retail', v)} step={10} style={{ width: 105 }} />
                </td>

                {/* Discount Rate/Amt/Tot */}
                <td>
                  <NumberSpinner value={item.disc_r} min={0} onChange={v => updateItemField(idx, 'disc_r', v)} style={{ width: 82 }} />
                </td>
                <td className="right">{item.disc_a?.toFixed(2)}</td>
                <td className="right group-end">{item.disc_t?.toFixed(2)}</td>

                <td className="right group-end" style={{ fontWeight: 500 }}>{item.sub?.toFixed(2)}</td>

                {/* GST Rate/Amt/Tot */}
                <td>
                  <NumberSpinner value={item.gst_r} min={0} onChange={v => updateItemField(idx, 'gst_r', v)} style={{ width: 82 }} />
                </td>
                <td className="right">{item.gst_a?.toFixed(2)}</td>
                <td className="right group-end">{item.gst_t?.toFixed(2)}</td>

                <td className="right group-end" style={{ fontWeight: 600, color: 'var(--inv-num)' }}>
                  {item.total?.toFixed(2)}
                </td>
                <td>
                  <input value={item.exp}
                    onChange={e => updateItemField(idx, 'exp', e.target.value)}
                    style={{ width: 72 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Total bar ── */}
      <div className="total-bar">
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div className="total-label">Subtotal</div>
            <div className="mono" style={{ fontSize: 14 }}>Rs. {subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div className="total-label">GST ({settings?.gst_rate ?? 1}%)</div>
            <div className="mono" style={{ fontSize: 14 }}>Rs. {gstAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="total-label">Grand Total</div>
          <div className="total-amount">
            Rs. {grandTotal.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary" onClick={reset}>↺ Reset</button>
          <button className="btn btn-success" style={{ minWidth: 200 }} onClick={handleFinalize} disabled={saving}>
            {saving ? 'Processing…' : '✓ Finalize & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
