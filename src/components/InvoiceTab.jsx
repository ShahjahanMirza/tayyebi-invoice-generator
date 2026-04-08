import { useState, useEffect, useCallback, useMemo } from 'react'
import SearchDropdown from './SearchDropdown'
import NumberSpinner from './NumberSpinner'

const today = () => new Date().toLocaleDateString('en-GB')

function recalc(item, retailToTradeDiscount = 15) {
  const p = parseFloat(item.retail) || 0
  const q = parseFloat(item.qty) || 0
  const dr = parseFloat(item.disc_r) || 0
  const gr = parseFloat(item.gst_r) || 0

  // Calculate Trade Price first
  const tradePrice = p * (1 - ((retailToTradeDiscount ?? 15) / 100))

  const disc_a = tradePrice * (dr / 100)        // Discount per unit (on Trade)
  const disc_t = disc_a * q                     // Total discount for the row
  const sub = (tradePrice * q) - disc_t         // Net amount before tax
  const gst_a = 0                               // Set per-item GST to 0
  const gst_t = 0

  return { ...item, gst_r: 0, tradePrice, disc_a, disc_t, sub, gst_a, gst_t, total: sub }
}

export default function InvoiceTab({ products, customers, settings, onSaved, isOnline }) {
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
  const subtotal = items.reduce((s, i) => s + (i.sub || 0), 0)
  const gstRate = parseFloat(settings?.gst_rate ?? 1.0)
  const gstAmount = subtotal * (gstRate / 100)
  const grandTotal = parseFloat((subtotal + gstAmount).toFixed(2))

  // Auto-recalculate everything if the global retail-to-trade discount changes
  useEffect(() => {
    if (items.length > 0) {
      const retailDisc = settings?.retail_to_trade_discount ?? 15
      setItems(prev => prev.map(item => recalc(item, retailDisc)))
    }
  }, [settings?.retail_to_trade_discount])

  const productList = useMemo(() => products
    .filter(p => p['Code'])
    .map(p => ({
      id: p['Code'],
      label: (String(p['ITEM NAME'] || '').trim()) || `Product ${p['Code']}`,
      details: String(p['Code'])
    }))
    .sort((a, b) => {
      const na = parseInt(String(a.id).replace(/\D/g, '')) || 0
      const nb = parseInt(String(b.id).replace(/\D/g, '')) || 0
      return na - nb
    }), [products])

  const customerList = useMemo(() => customers
    .filter(c => c['TraderID'])
    .map(c => ({
      id: c['TraderID'],
      label: (String(c['Company'] || '').trim()) || `Customer ${c['TraderID']}`,
      details: String(c['TraderID'])
    }))
    .sort((a, b) => {
      const na = parseInt(String(a.id).replace(/\D/g, '')) || 0
      const nb = parseInt(String(b.id).replace(/\D/g, '')) || 0
      return na - nb
    }), [customers])

  function onCustomerChosen(val) {
    const id = typeof val === 'string' ? null : val.id
    const name = typeof val === 'string' ? val : val.label
    setCustName(name)
    const d = id ? customers.find(c => c['TraderID'] === id) : customers.find(c => c['Company'] === name)
    setCustData(d || null)

    // Recalculate all items if a customer is found
    if (d && items.length > 0) {
      const newDisc = parseFloat(d['Special (Discount % )'] || 0)
      const retailDisc = settings?.retail_to_trade_discount ?? 15
      setItems(prev => prev.map(item => recalc({ ...item, disc_r: newDisc }, retailDisc)))
    }
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
    const gr = parseFloat(settings?.gst_rate ?? 1.0)
    const retailDisc = settings?.retail_to_trade_discount ?? 15

    const item = recalc({
      code: prodData?.['Code'] || 'N/A',
      name: prodName,
      qty: q,
      bonus: parseFloat(bonus) || 0,
      retail: p,
      disc_r: dr,
      gst_r: gr,
      exp: expiry,
    }, retailDisc)
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
      const retailDisc = settings?.retail_to_trade_discount ?? 15
      next[idx] = recalc({ ...next[idx], [field]: value }, retailDisc)
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
      const saveResult = await window.api.saveInvoice(payload)

      // Use the actual invoice number assigned (may differ if there was a conflict)
      const actualNumber = saveResult?.invoice_number ?? payload.invoice_number
      const finalPayload = { ...payload, invoice_number: actualNumber }

      const result = await window.api.generatePDF({ invoiceData: finalPayload, settings })

      onSaved?.()
      reset()

      if (saveResult?.offline) {
        alert('Invoice saved locally (offline). It will not sync to the cloud until internet is restored.')
      } else if (actualNumber !== payload.invoice_number) {
        alert(`Invoice number was already taken. Saved as Invoice #${actualNumber} instead.`)
      }
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
            <label>Retail</label>
            <input type="number" value={retail} onChange={e => setRetail(e.target.value)} placeholder="0.00" />
          </div>
          <div className="col" style={{ width: 100 }}>
            <label>Trade</label>
            <input
              readOnly
              disabled
              value={(parseFloat(retail || 0) * (1 - (settings?.retail_to_trade_discount ?? 15) / 100)).toFixed(2)}
              style={{ background: 'var(--surface-3)', borderStyle: 'dashed' }}
            />
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
              <th colSpan="3" className="group-end" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>Product</th>
              <th colSpan="3" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>Discount</th>
              <th rowSpan="2" className="group-end" style={{ width: 90 }}>SubTotal</th>
              <th colSpan="3" style={{ borderBottom: '1px solid rgba(255,255,255,.1)' }}>GST</th>
              <th rowSpan="2" className="group-end" style={{ width: 95 }}>Grand Total</th>
              <th rowSpan="2" style={{ width: 80 }}>Expiry</th>
            </tr>
            <tr className="sub-header">
              <th style={{ width: 80 }}>Retail</th>
              <th style={{ width: 80 }}>Trade</th>
              <th style={{ width: 40 }}>Quantity</th>
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
              <tr><td colSpan={16} style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', background: 'var(--surface)' }}>

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
                <td className="mono">
                  <NumberSpinner value={item.retail} onChange={v => updateItemField(idx, 'retail', v)} step={10} style={{ width: 105 }} />
                </td>
                <td className="mono" style={{ background: 'rgba(59, 130, 246, 0.05)', fontWeight: 600 }}>
                  {item.tradePrice?.toFixed(2)}
                </td>
                <td className="mono">
                  <NumberSpinner value={item.qty} onChange={v => updateItemField(idx, 'qty', v)} style={{ width: 85 }} />
                </td>

                {/* Discount Rate/Amt/Tot */}
                <td className="right">{item.disc_r?.toFixed(2)}</td>
                <td className="right">{item.disc_a?.toFixed(2)}</td>
                <td className="right group-end">{item.disc_t?.toFixed(2)}</td>

                <td className="right group-end" style={{ fontWeight: 500 }}>{item.sub?.toFixed(2)}</td>

                {/* GST Rate/Amt/Tot */}
                <td className="right">{item.gst_r?.toFixed(2)}</td>
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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {!isOnline && (
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginRight: 4 }}>
              OFFLINE — saves locally only
            </span>
          )}
          <button className="btn btn-secondary" onClick={reset}>↺ Reset</button>
          <button className="btn btn-success" style={{ minWidth: 200 }} onClick={handleFinalize} disabled={saving}>
            {saving ? 'Processing…' : 'Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
