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

  n = Math.round(n)
  if (n === 0) return 'Zero'
  let result = ''
  if (n >= 10000000) { result += below1000(Math.floor(n / 10000000)) + 'Crore '; n %= 10000000 }
  if (n >= 100000)   { result += below1000(Math.floor(n / 100000))   + 'Lakh ';  n %= 100000  }
  if (n >= 1000)     { result += below1000(Math.floor(n / 1000))     + 'Thousand '; n %= 1000  }
  result += below1000(n)
  return result.trim() + ' Only'
}

function fmt(n) {
  return Number(n || 0).toFixed(2)
}

// ── Layout constants ──────────────────────────────────────────────────────────
const ML = 36, MR = 36
const rowH = 15
const ROWS_PAGE1 = 32  // rows on page 1
const ROWS_CONT  = 36  // rows on continuation pages (fits full header + totals + sigs)

const cols = [
  { l: 'Sr#',          w: 24,  a: 'center', ha: 'center' },
  { l: 'Item Name',    w: 180, a: 'left',   ha: 'center' },
  { l: 'Quantity',     w: 42,  a: 'center', ha: 'center' },
  { l: 'Bonus',        w: 36,  a: 'center', ha: 'center' },
  { l: 'Unit',         w: 34,  a: 'center', ha: 'center' },
  { l: 'Retail Price', w: 54,  a: 'right',  ha: 'center' },
  { l: 'Trade Price',  w: 54,  a: 'right',  ha: 'center' },
  { l: 'Discount',     w: 48,  a: 'center', ha: 'center' },
  { l: 'Total',        w: 51,  a: 'right',  ha: 'center' },
]

// ── Bottom bar: "Print: date time" left, "Page X of Y" right ─────────────────
function drawBottomBar(doc, ML, TR, PH, pageNum, totalPages, printDateTime) {
  const y = PH - 18
  doc.font('Helvetica').fontSize(7).fillColor('#888888')
  doc.text(`Print: ${printDateTime}`, ML, y, { width: 250 })
  doc.text(`Page ${pageNum} of ${totalPages}`, ML, y, { width: TR - ML, align: 'right' })
}

// ── Signature area: two lines with labels (last page only) ───────────────────
function drawSignatureArea(doc, y, ML, TR) {
  const lineY  = y + 22
  const labelY = y + 26
  const sigWidth = 180

  // Left — Tayyebi Dawakhana
  doc.moveTo(ML, lineY).lineTo(ML + sigWidth, lineY)
    .strokeColor('#000000').lineWidth(0.5).stroke()
  doc.font('Helvetica').fontSize(7.5).fillColor('#000000')
    .text('Tayyebi Dawakhana (Pvt) Ltd', ML, labelY, { width: sigWidth, align: 'center' })

  // Right — Receiver
  doc.moveTo(TR - sigWidth, lineY).lineTo(TR, lineY)
    .strokeColor('#000000').lineWidth(0.5).stroke()
  doc.text('Receiver Signature', TR - sigWidth, labelY, { width: sigWidth, align: 'center' })
}

// ── Customer meta box (reused on page 1 and continuation pages) ──────────────
function drawCustomerBox(doc, invoiceData, settings, ML, TR, PW, my) {
  const boxH = 75
  const bannerWidth = 140, bannerHeight = 20
  const bannerX = (PW - bannerWidth) / 2
  const bannerY = my - bannerHeight

  doc.rect(bannerX, bannerY, bannerWidth, bannerHeight).fill('#00FBFF')
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
    .text('Invoice', bannerX, bannerY + 4, { width: bannerWidth, align: 'center' })

  doc.rect(ML, my, TR - ML, boxH).stroke('#000000').lineWidth(0.5)
  doc.moveTo(TR - 120, my).lineTo(TR - 120, my + boxH).stroke()

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
  doc.text('M/s:',                     ML + 4, my + 4)
  doc.text('Add:',                     ML + 4, my + 19)
  doc.text('Cont:',                    ML + 4, my + 34)
  doc.text('Purchase Order Number:',   ML + 4, my + 49)
  doc.text('Delivery Challan Number:', ML + 4, my + 64)

  doc.font('Helvetica-BoldOblique', 8).text(invoiceData.customer_name || '', ML + 30, my + 4)
  doc.text(invoiceData.address || '',                                          ML + 30, my + 19)
  doc.text(`Mr.  ${invoiceData.contact || ''}`,                               ML + 30, my + 34)
  doc.font('Helvetica', 8.5).text(invoiceData.po_number || '',                ML + 115, my + 49)
  doc.text(invoiceData.challan_number || '',                                   ML + 115, my + 64)

  doc.font('Helvetica-Bold').fontSize(8)
  doc.text(`NTN:  ${settings.company_ntn || ''}`,    ML + 275, my + 49)
  doc.text(`GST #:  ${settings.company_gst || ''}`,  ML + 275, my + 64)
  doc.text(`CNIC #:  ${settings.company_cnic || ''}`, ML + 275, my + 34)

  doc.font('Helvetica-Bold').text('Date:',      TR - 116, my + 4,  { width: 54, align: 'right' })
  doc.font('Helvetica-Bold').text('Invoice #:', TR - 116, my + 19, { width: 54, align: 'right' })
  doc.font('Helvetica-Bold').text('NTN #:',     TR - 116, my + 34, { width: 54, align: 'right' })
  doc.font('Helvetica-Bold').text('GST #:',     TR - 116, my + 49, { width: 54, align: 'right' })
  doc.font('Helvetica').text(invoiceData.date || '',             TR - 60, my + 4,  { width: 57, align: 'left' })
  doc.text(String(invoiceData.invoice_number || ''),             TR - 60, my + 19, { width: 57, align: 'left' })
  doc.text(settings.company_ntn || '',                           TR - 60, my + 34, { width: 57, align: 'left' })
  doc.text(settings.company_gst || '',                           TR - 60, my + 49, { width: 57, align: 'left' })

  return my + boxH  // returns y where table should start
}

// ── Table header row ──────────────────────────────────────────────────────────
function drawTableHeader(doc, ty, TR) {
  doc.rect(ML, ty, TR - ML, rowH).fill('#E8E8E8').stroke('#000000')
  let tx = ML
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000')
  cols.forEach(c => {
    doc.text(c.l, tx + 2, ty + 4, { width: c.w - 4, align: c.ha, lineBreak: false })
    tx += c.w
  })
}

// ── Table data rows ───────────────────────────────────────────────────────────
// structureRows = total row slots to draw (for vertical lines + border), may be > item count
function drawTableRows(doc, items, startIdx, count, tableStartY, TR, globalOffset, structureRows) {
  const fillRows   = structureRows || count
  const tableBottom = tableStartY + rowH + fillRows * rowH

  // Vertical column lines for full height
  let bx = ML
  cols.forEach(c => {
    doc.moveTo(bx, tableStartY).lineTo(bx, tableBottom).stroke('#000000').lineWidth(0.5)
    bx += c.w
  })
  doc.moveTo(TR, tableStartY).lineTo(TR, tableBottom).stroke()

  // Bottom border
  doc.moveTo(ML, tableBottom).lineTo(TR, tableBottom).strokeColor('#000000').lineWidth(0.5).stroke()

  let totalQty = 0, totalRetail = 0, totalTrade = 0

  for (let i = 0; i < count; i++) {
    const ry = tableStartY + rowH + i * rowH
    const it = items[startIdx + i]
    if (!it) continue

    const r = parseFloat(it.retail || 0)
    const q = parseFloat(it.qty || 0)
    totalQty    += q
    totalRetail += r * q
    totalTrade  += it.sub || 0

    const rowData = [
      String(globalOffset + i + 1),
      it.name,
      String(q),
      String(it.bonus || 0),
      '',
      fmt(r),
      fmt(it.tradePrice),
      `${it.disc_r}%`,
      fmt(it.total)
    ]
    let dx = ML
    doc.font('Helvetica').fontSize(7.5).fillColor('#000000')
    cols.forEach((c, ci) => {
      doc.text(rowData[ci], dx + 2, ry + 4, { width: c.w - 4, align: c.a, lineBreak: false, ellipsis: true })
      dx += c.w
    })
  }

  return { totalQty, totalRetail, totalTrade }
}

// ── Totals row + footer ───────────────────────────────────────────────────────
function drawTotalsAndFooter(doc, invoiceData, settings, totals, ty, TR) {
  // Totals row
  doc.fillColor('#E8E8E8').rect(ML, ty, TR - ML, rowH).fill()
  doc.strokeColor('#000000').lineWidth(0.5).rect(ML, ty, TR - ML, rowH).stroke()
  let ttx = ML
  cols.forEach(c => {
    doc.moveTo(ttx, ty).lineTo(ttx, ty + rowH).stroke()
    ttx += c.w
  })
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
  doc.text(String(totals.totalQty), ML + 204, ty + 4, { width: 42, align: 'center' })
  doc.text(String(invoiceData.items.reduce((s, x) => s + (x.bonus || 0), 0)), ML + 246, ty + 4, { width: 36, align: 'center' })
  doc.text(fmt(totals.totalRetail), ML + 316, ty + 4, { width: 54, align: 'right' })
  doc.text(fmt(totals.totalTrade),  ML + 370, ty + 4, { width: 54, align: 'right' })
  doc.text(fmt(invoiceData.grand_total - invoiceData.gst_amount), ML + 472, ty + 4, { width: 51, align: 'right' })

  // Footer box
  const fy = ty + rowH
  const footerH = 70
  doc.fillColor('#E8E8E8').rect(ML, fy, TR - ML, footerH).fill()
  doc.strokeColor('#000000').lineWidth(0.5).rect(ML, fy, TR - ML, footerH).stroke()
  doc.moveTo(ML, fy).lineTo(TR, fy).stroke()

  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.5).text('Remarks:', ML + 4, fy + 4)

  const gy = fy + 20
  doc.font('Helvetica-Bold').fontSize(8)
  doc.text(`GST ${parseFloat(settings.gst_rate ?? 1.0).toFixed(2)} %:`, TR - 180, gy, { width: 100, align: 'right' })
  doc.text(fmt(invoiceData.gst_amount), TR - 70, gy, { width: 68, align: 'right' })
  doc.text('AGST:', TR - 180, gy + 12, { width: 100, align: 'right' })
  doc.text('0.00',  TR - 70,  gy + 12, { width: 68, align: 'right' })
  doc.moveTo(TR - 140, gy + 22).lineTo(TR - 5, gy + 22).stroke()

  doc.font('Helvetica-Bold').fontSize(9)
    .text(`PK Rs. ${toWords(invoiceData.grand_total)}`, ML + 4, fy + 52)
  doc.font('Helvetica-Bold').fontSize(16)
    .text(Math.round(invoiceData.grand_total).toLocaleString(), TR - 135, fy + 45, { width: 130, align: 'right' })

  return fy + footerH  // y after footer ends
}

// ── Main PDF generator ────────────────────────────────────────────────────────
function generateInvoicePDF(invoiceData, settings, outputPath, copyLabel = 'Original') {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0 })
    const stream = fs.createWriteStream(outputPath)
    doc.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)

    const PW = doc.page.width   // 595
    const PH = doc.page.height  // 842
    const TR = PW - MR

    // Capture print timestamp once for all pages
    const now   = new Date()
    const pad   = n => String(n).padStart(2, '0')
    const hours = now.getHours()
    const ampm  = hours >= 12 ? 'PM' : 'AM'
    const h12   = hours % 12 || 12
    const printDateTime = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(h12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`

    const items = invoiceData.items || []

    // Split items into page chunks
    const pages = []
    pages.push(items.slice(0, ROWS_PAGE1))
    let rest = items.slice(ROWS_PAGE1)
    while (rest.length > 0) {
      pages.push(rest.slice(0, ROWS_CONT))
      rest = rest.slice(ROWS_CONT)
    }
    const totalPages = pages.length

    // Running totals across all pages
    let grandTotalQty = 0, grandTotalRetail = 0, grandTotalTrade = 0

    // ── PAGE 1 ─────────────────────────────────────────────────────────────────
    const headerTop = 20
    const logoAbsPath = path.join(__dirname, 'logo.png')

    if (fs.existsSync(logoAbsPath)) {
      doc.image(logoAbsPath, ML, headerTop, { width: 150 })
    } else {
      doc.font('Helvetica-Bold').fontSize(24).fillColor('#1a1a1a')
        .text('Tayyebi', ML, headerTop)
    }

    doc.font('Helvetica').fontSize(7).fillColor('#333333')
    const addrLines = [
      settings.company_address || '11 B-4, Commercial Area, Nazimabad No. 2, Karachi Pakistan.',
      settings.company_phone   || '021-36600703-4, 36689036, 36602189',
      settings.company_fax     || 'Fax: 021-36602684',
      settings.company_web     || 'www.tayyebi.com.pk'
    ]
    let ay = headerTop
    addrLines.forEach(line => {
      doc.text(line, ML, ay, { width: TR - ML, align: 'right' })
      ay += 10
    })
    doc.font('Helvetica').fontSize(8).fillColor('#333333')
      .text(copyLabel, ML, headerTop + 62)

    // Customer box — shifted up 23px vs original to free space at bottom
    const ty = drawCustomerBox(doc, invoiceData, settings, ML, TR, PW, 115)

    // Table — compute structureRows so table bottom aligns exactly with footer top
    const maxFooterY1 = PH - 18 - 8 - 126
    const structRows1 = totalPages === 1
      ? Math.floor((maxFooterY1 - ty - rowH) / rowH)
      : ROWS_PAGE1
    const footerY1 = ty + rowH + structRows1 * rowH

    drawTableHeader(doc, ty, TR)
    const t1 = drawTableRows(doc, items, 0, pages[0].length, ty, TR, 0, structRows1)
    grandTotalQty    += t1.totalQty
    grandTotalRetail += t1.totalRetail
    grandTotalTrade  += t1.totalTrade

    if (totalPages === 1) {
      const afterFooter = drawTotalsAndFooter(doc, invoiceData, settings,
        { totalQty: grandTotalQty, totalRetail: grandTotalRetail, totalTrade: grandTotalTrade },
        footerY1, TR)
      drawSignatureArea(doc, afterFooter + 6, ML, TR)
    }

    drawBottomBar(doc, ML, TR, PH, 1, totalPages, printDateTime)

    // ── CONTINUATION PAGES ─────────────────────────────────────────────────────
    let itemOffset = pages[0].length

    for (let p = 1; p < totalPages; p++) {
      doc.addPage()
      const isLastPage  = p === totalPages - 1
      const pageItems   = pages[p]

      // Full customer meta box (no logo/company info) — starts at top of page
      const contBoxTop = 22  // banner sits at y=2, box at y=22
      const contTy     = drawCustomerBox(doc, invoiceData, settings, ML, TR, PW, contBoxTop)

      // Table — compute structureRows so table bottom aligns exactly with footer top
      const maxFooterYC = PH - 18 - 8 - 126
      const structRowsCont = isLastPage
        ? Math.floor((maxFooterYC - contTy - rowH) / rowH)
        : ROWS_CONT
      const footerYC = contTy + rowH + structRowsCont * rowH

      drawTableHeader(doc, contTy, TR)
      const tc = drawTableRows(doc, items, itemOffset, pageItems.length, contTy, TR, itemOffset, structRowsCont)
      grandTotalQty    += tc.totalQty
      grandTotalRetail += tc.totalRetail
      grandTotalTrade  += tc.totalTrade

      if (isLastPage) {
        const afterFooter = drawTotalsAndFooter(doc, invoiceData, settings,
          { totalQty: grandTotalQty, totalRetail: grandTotalRetail, totalTrade: grandTotalTrade },
          footerYC, TR)
        drawSignatureArea(doc, afterFooter + 6, ML, TR)
      }

      drawBottomBar(doc, ML, TR, PH, p + 1, totalPages, printDateTime)
      itemOffset += pageItems.length
    }

    doc.end()
  })
}

module.exports = { generateInvoicePDF }
