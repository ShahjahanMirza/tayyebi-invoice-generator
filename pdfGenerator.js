const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

function toWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function below1000(num) {
    if (num === 0) return ''
    if (num < 20) return ones[num] + ' '
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '') + ' '
    return ones[Math.floor(num / 100)] + ' Hundred ' + below1000(num % 100)
  }

  n = Math.round(n) // Use Round to match the grand total box
  if (n === 0) return 'Zero'
  let result = ''
  if (n >= 10000000) { result += below1000(Math.floor(n / 10000000)) + 'Crore '; n %= 10000000 }
  if (n >= 100000) { result += below1000(Math.floor(n / 100000)) + 'Lakh '; n %= 100000 }
  if (n >= 1000) { result += below1000(Math.floor(n / 1000)) + 'Thousand '; n %= 1000 }
  result += below1000(n)
  return result.trim() + ' Only'
}

function fmt(n) {
  return Number(n || 0).toFixed(2)
}

function generateInvoicePDF(invoiceData, settings, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 })
    const stream = fs.createWriteStream(outputPath)
    doc.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)

    const PW = doc.page.width   // 595
    const PH = doc.page.height  // 842
    const ML = 36, MR = 36
    const TR = PW - MR

    // ── Header ─────────────────────────────────────────────
    const headerTop = 30   // ⬅️ removes extra top space

    const logoRelPath = 'logo.png'
    const logoAbsPath = path.isAbsolute(logoRelPath)
      ? logoRelPath
      : path.join(__dirname, logoRelPath)

    // Logo (left)
    const logoWidth = 150
    if (fs.existsSync(logoAbsPath)) {
      doc.image(logoAbsPath, ML, headerTop, { width: logoWidth })
    } else {
      doc.font('Helvetica-Bold').fontSize(24).fillColor('#1a1a1a')
        .text('Tayyebi', ML, headerTop)
    }

    // Company info (RIGHT SIDE — properly aligned)
    doc.font('Helvetica').fontSize(7).fillColor('#333333')

    const addrLines = [
      settings.company_address || 'Address: II B-4, Commercial Area, Nazimabad No. 2, Karachi Pakistan.',
      settings.company_phone || 'Phone: 021-36600703-4, 36689036, 36602189',
      settings.company_fax || 'Fax: 021-36602684',
      settings.company_web || 'Web: www.tayyebi.com.pk'
    ]

    // Right aligned block (no weird center shift)
    let ay = headerTop
    addrLines.forEach(line => {
      doc.text(line, ML, ay, {
        width: TR - ML,
        align: 'right'
      })
      ay += 10
    })

    // Triplicate (tight under logo)
    doc.font('Helvetica').fontSize(8).fillColor('#333333')
      .text('Triplicate', ML, headerTop + 65)

    // ── Customer Meta ───────────────────────────────────────────────────
    const my = 138
    const boxH = 75

    // Cyan Banner (Centered horizontally and touching the box below)
    const bannerWidth = 140
    const bannerHeight = 20
    const bannerX = (PW - bannerWidth) / 2
    const bannerY = my - bannerHeight // Barely touching the box at 'my'

    doc.rect(bannerX, bannerY, bannerWidth, bannerHeight).fill('#00FBFF')

    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
      .text('Invoice', bannerX, bannerY + 4, {
        width: bannerWidth,
        align: 'center'
      })

    doc.rect(ML, my, TR - ML, boxH).stroke('#000000').lineWidth(0.5)

    // ── Customer Meta Box (Outer Border) ──
    doc.rect(ML, my, TR - ML, boxH).stroke('#000000').lineWidth(0.5)

    // Vertical divider between Customer Info and Invoice Meta (e.g. Date/Number)
    doc.moveTo(TR - 120, my).lineTo(TR - 120, my + boxH).stroke()

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
    doc.text('M/s:', ML + 4, my + 4)
    doc.text('Add:', ML + 4, my + 19)
    doc.text('Cont:', ML + 4, my + 34)
    doc.text('Purchase Order Number:', ML + 4, my + 49)
    doc.text('Delivery Challan Number:', ML + 4, my + 64)

    doc.font('Helvetica-BoldOblique', 8).text(invoiceData.customer_name || '', ML + 30, my + 4)
    doc.text(invoiceData.address || '', ML + 30, my + 19)
    doc.text(`Mr.  ${invoiceData.contact || ''}`, ML + 30, my + 34)
    doc.font('Helvetica', 8.5).text(invoiceData.po_number || '', ML + 115, my + 49)
    doc.text(invoiceData.challan_number || '', ML + 115, my + 64)

    // Center Section (Tax Labels & Values from Settings)
    doc.font('Helvetica-Bold').fontSize(8)
    doc.text(`NTN:  ${settings.ntn || '0658428-8'}`, ML + 275, my + 49)
    doc.text(`GST #:  ${settings.gst_num || '12-00-3004-913-17'}`, ML + 275, my + 64)
    doc.text(`CNIC #:  ${settings.cnic || ''}`, ML + 275, my + 34)

    // Right Box Labels
    doc.font('Helvetica-Bold').text('Date:', TR - 116, my + 4)
    doc.font('Helvetica-Bold').text('Invoice #:', TR - 116, my + 19)
    doc.font('Helvetica-Bold').text('NTN #:', TR - 116, my + 34)
    doc.font('Helvetica-Bold').text('GST #:', TR - 116, my + 49)

    doc.font('Helvetica-Bold').text(invoiceData.date || '', TR - 50, my + 4)
    doc.text(invoiceData.invoice_number || '', TR - 50, my + 19)
    doc.text(settings.ntn || '0658428-8', TR - 50, my + 34)
    doc.text(settings.gst_num || '12-00-3004-913-17', TR - 50, my + 49)

    // ── Table ────────────────────────────────────────────────────────────
    const ty = my + boxH // Touching the section above
    const cols = [
      { l: 'Sr#', w: 24, a: 'center' },
      { l: 'Item Name', w: 180, a: 'left' },
      { l: 'Quantity', w: 42, a: 'center' },
      { l: 'Bonus', w: 36, a: 'center' },
      { l: 'Unit', w: 34, a: 'center' },
      { l: 'Retail Price', w: 54, a: 'right' },
      { l: 'Trade Price', w: 54, a: 'right' },
      { l: 'Discount', w: 48, a: 'center' },
      { l: 'Total', w: 51, a: 'right' },
    ]
    const rowH = 15
    const tableH = rowH * 32 // 32 rows to fill page

    // Header
    doc.rect(ML, ty, TR - ML, rowH).fill('#E8E8E8').stroke('#000000')
    let tx = ML
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000')
    cols.forEach(c => {
      doc.text(c.l, tx + 2, ty + 4, { width: c.w - 4, align: c.a })
      tx += c.w
    })

    // Data Rows (Vertical Lines Only)
    const items = invoiceData.items || []
    let totalQty = 0, totalRetail = 0, totalTrade = 0
    const tableBottom = ty + rowH + tableH

    // Draw full-height vertical lines
    let bx = ML
    cols.forEach(c => {
      doc.moveTo(bx, ty).lineTo(bx, tableBottom).stroke('#000000').lineWidth(0.5)
      bx += c.w
    })
    doc.moveTo(TR, ty).lineTo(TR, tableBottom).stroke()

    for (let i = 0; i < 32; i++) {
      const ry = ty + rowH + i * rowH
      const it = items[i]

      if (it) {
        let dx = ML
        const r = parseFloat(it.retail || 0); const q = parseFloat(it.qty || 0); const dr = parseFloat(it.disc_r || 0)
        const trd = r * (1 - dr / 100)
        totalQty += q; totalRetail += r * q; totalTrade += it.sub || 0

        const rowData = [
          String(i + 1), it.name, String(q), String(it.bonus || 0), '', fmt(r), fmt(trd), `${dr}%`, fmt(it.total)
        ]
        doc.font('Helvetica').fontSize(7.5)
        cols.forEach((c, ci) => {
          doc.text(rowData[ci], dx + 2, ry + 4, { width: c.w - 4, align: c.a })
          dx += c.w
        })
      }
    }

    // Totals Row
    const tryy = tableBottom
    doc.fillColor('#E8E8E8').rect(ML, tryy, TR - ML, rowH).fill() // Fill grey

    // Draw full boundary box for totals row
    doc.strokeColor('#000000').lineWidth(0.5)
    doc.rect(ML, tryy, TR - ML, rowH).stroke()

    // Draw vertical cell dividers in totals row
    let ttx = ML
    cols.forEach(c => {
      doc.moveTo(ttx, tryy).lineTo(ttx, tryy + rowH).stroke()
      ttx += c.w
    })

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
    doc.text(String(totalQty), ML + 204, tryy + 4, { width: 42, align: 'center' })
    doc.text(String(items.reduce((s, x) => s + (x.bonus || 0), 0)), ML + 246, tryy + 4, { width: 36, align: 'center' })
    doc.text(fmt(totalRetail), ML + 316, tryy + 4, { width: 54, align: 'right' })
    doc.text(fmt(totalTrade), ML + 370, tryy + 4, { width: 54, align: 'right' })
    doc.text(fmt(invoiceData.grand_total - invoiceData.gst_amount), ML + 472, tryy + 4, { width: 51, align: 'right' })

    // ── Footer Area (No gap, uniform grey) ──────────────────────────────
    const fy = tryy + rowH
    const footerH = 70
    doc.fillColor('#E8E8E8').rect(ML, fy, TR - ML, footerH).fill()

    // Draw boundary for footer + Separator line between Totals and Footer
    doc.strokeColor('#000000').lineWidth(0.5)
    doc.rect(ML, fy, TR - ML, footerH).stroke()
    doc.moveTo(ML, fy).lineTo(TR, fy).stroke() // Explicit separator line

    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.5).text('Remarks:', ML + 4, fy + 4)

    const gy = fy + 20
    doc.font('Helvetica-Bold').fontSize(8)
    doc.text(`GST ${settings.gst_rate || 0}.00 %:`, TR - 180, gy, { width: 100, align: 'right' })
    doc.text(fmt(invoiceData.gst_amount), TR - 70, gy, { width: 68, align: 'right' })

    doc.text('AGST:', TR - 180, gy + 12, { width: 100, align: 'right' })
    doc.text('0.00', TR - 70, gy + 12, { width: 68, align: 'right' })

    // Line under AGST
    doc.moveTo(TR - 140, gy + 22).lineTo(TR - 5, gy + 22).stroke()

    // Amount in words
    doc.font('Helvetica-Bold').fontSize(9)
      .text(`PK Rs. ${toWords(invoiceData.grand_total)}`, ML + 4, fy + 52)

    // Grand Total (Large and flush in the corner)
    doc.font('Helvetica-Bold').fontSize(16)
      .text(Math.round(invoiceData.grand_total).toLocaleString(), TR - 135, fy + 45, { width: 130, align: 'right' })

    doc.end()
  })
}

module.exports = { generateInvoicePDF }
