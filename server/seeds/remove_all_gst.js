const { db, initializeDB, run, all } = require('../config/db');

async function removeAllGst() {
  await initializeDB();
  console.log('--- REMOVING ALL GST FROM PRODUCTS & BILLS ---');

  // 1. Zero out gstRate on all products
  const productResult = await run('UPDATE products SET gstRate = 0');
  console.log('Updated products to 0% GST.');

  // 2. Fix all sale items (remove gstRate and taxAmount, set total = quantity * price)
  await run('UPDATE sale_items SET gstRate = 0, taxAmount = 0, reportGstTax = 0, total = ROUND(quantity * price, 2)');
  console.log('Updated all sale items to 0% GST.');

  // 3. Fix all sales headers (grandTotal = subtotal, zero taxes)
  await run(`
    UPDATE sales 
    SET taxAmount = 0, 
        cgstAmount = 0, 
        sgstAmount = 0, 
        reportGstTax = 0, 
        grandTotal = subtotal,
        amountPaid = subtotal
  `);
  console.log('Updated all sales invoices to 0% GST.');

  // 4. Fix quotation items and quotations
  await run('UPDATE quotation_items SET gstRate = 0, taxAmount = 0, total = ROUND(quantity * price, 2)');
  await run('UPDATE quotations SET taxAmount = 0, grandTotal = subtotal');
  console.log('Updated all quotations to 0% GST.');

  // Verify
  const sampleProduct = await all('SELECT name, retailPrice, gstRate FROM products LIMIT 5');
  console.log('Sample Products:', sampleProduct);

  const sampleSale = await all('SELECT invoiceNo, subtotal, taxAmount, grandTotal, amountPaid FROM sales ORDER BY id DESC LIMIT 5');
  console.log('Recent Sales:', sampleSale);

  console.log('--- ALL GST SUCCESSFULLY REMOVED ---');
  process.exit(0);
}

removeAllGst().catch(err => {
  console.error('Error removing GST:', err);
  process.exit(1);
});
