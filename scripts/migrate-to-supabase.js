const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Configuration ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://etedxnlemuauwkxctcav.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0ZWR4bmxlbXVhdXdreGN0Y2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTY4NjksImV4cCI6MjA5MDYzMjg2OX0.dKIf1tmSiYgGDLraTHOUEalZDZ-4rg_Jc8Jvn9u-wVk';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATA_DIR = path.join(__dirname, '..', 'tayyebi_app_data', 'Data');

// ── Helpers ────────────────────────────────────────────────────────────────
const readJSON = (filename) => {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
};

async function migrate() {
  console.log('🚀 Starting Migration to Supabase...');

  // 1. Migrate Products
  const products = readJSON('products.json');
  if (products.length > 0) {
    console.log(`📦 Migrating ${products.length} Products...`);
    const formattedProducts = products.map(p => ({
      code: String(p['Code']),
      name: p['ITEM NAME'],
      price: parseFloat(p['NEW PRICE']) || 0
    }));
    const { error } = await supabase.from('products').upsert(formattedProducts, { onConflict: 'code' });
    if (error) console.error('❌ Products Error:', error.message);
    else console.log('✅ Products Migrated!');
  }

  // 2. Migrate Customers
  const customers = readJSON('customers.json');
  if (customers.length > 0) {
    console.log(`👥 Migrating ${customers.length} Customers...`);
    const formattedCustomers = customers.map(c => ({
      trader_id: String(c['TraderID']),
      company: c['Company'],
      sales_man: c['Sales Man'],
      contact_person: c['ContactPerson'],
      mobile: c['Mobile'],
      work_phone: c['WorkPhone'],
      area: c['Area'],
      address: c['Address'],
      city: c['City'],
      zone: c['Zone'],
      bulk_discount: parseFloat(c['Bulk (Discount % )']) || 0,
      special_discount: parseFloat(c['Special (Discount % )']) || 0
    }));
    const { error } = await supabase.from('customers').upsert(formattedCustomers, { onConflict: 'trader_id' });
    if (error) console.error('❌ Customers Error:', error.message);
    else console.log('✅ Customers Migrated!');
  }

  // 3. Migrate Settings
  const settings = readJSON('settings.json');
  if (Object.keys(settings).length > 0) {
    console.log('⚙️ Migrating Settings...');
    const formattedSettings = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from('app_settings').upsert(formattedSettings);
    if (error) console.error('❌ Settings Error:', error.message);
    else console.log('✅ Settings Migrated!');
  }

  // 4. Migrate History (Invoices + Items)
  const history = readJSON('history.json');
  if (history.length > 0) {
    console.log(`📄 Migrating ${history.length} Invoices...`);
    for (const inv of history) {
      // a. Insert Invoice
      const { error: invErr } = await supabase.from('invoices').upsert({
        invoice_number: inv.invoice_number,
        date: inv.date,
        inv_type: inv.inv_type || inv.invoice_type,
        payment_terms: inv.payment_terms,
        stock_from: inv.stock_from,
        po_number: inv.po_number,
        challan_number: inv.challan_number,
        customer_name: inv.customer_name,
        address: inv.address,
        contact: inv.contact,
        phone: inv.phone,
        subtotal: inv.subtotal,
        gst_amount: inv.gst_amount,
        grand_total: inv.grand_total,
        saved_at: inv.saved_at || new Date().toISOString()
      }, { onConflict: 'invoice_number' });

      if (invErr) {
        console.error(`❌ Invoice #${inv.invoice_number} Error:`, invErr.message);
        continue;
      }

      // b. Insert Items
      if (inv.items && inv.items.length > 0) {
        const formattedItems = inv.items.map(item => ({
          invoice_id: inv.invoice_number,
          code: item.code,
          name: item.name,
          qty: item.qty,
          bonus: item.bonus,
          retail: item.retail,
          disc_r: item.disc_r || item.discount, // Handle both formats
          gst_r: item.gst_r || 0,
          exp: item.exp || '',
          disc_a: item.disc_a,
          disc_t: item.disc_t || item.total,
          sub: item.sub || item.total,
          gst_a: item.gst_a,
          gst_t: item.gst_t,
          total: item.total
        }));
        const { error: itemsErr } = await supabase.from('invoice_items').insert(formattedItems);
        if (itemsErr) console.error(`❌ Items for #${inv.invoice_number} Error:`, itemsErr.message);
      }
    }
    console.log('✅ History Migrated!');
  }

  console.log('🏁 Migration Finished!');
}

migrate();
