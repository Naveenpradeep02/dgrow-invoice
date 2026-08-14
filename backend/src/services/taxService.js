const { numberToWordsIndian } = require('./wordsService');

function calculateInvoiceTotals(invoiceData) {
  const {
    invoice_type = 'GST',
    items = [],
    place_of_supply = 'Tamil Nadu',
    company_state = 'Tamil Nadu'
  } = invoiceData;

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let processedItems = [];

  // Determine if Inter-state (IGST) or Intra-state (CGST + SGST)
  const isInterstate = place_of_supply && !place_of_supply.toLowerCase().includes(company_state.toLowerCase());
  const isGstInvoice = (invoice_type === 'GST' || invoice_type === 'GST_CLIENT');

  items.forEach((item, index) => {
    const qty = parseFloat(item.quantity) || 1;
    const rate = parseFloat(item.rate) || 0;
    const discount = parseFloat(item.discount) || 0;
    const gstRate = isGstInvoice ? (parseFloat(item.gst_rate) || 18.0) : 0;

    const lineGross = qty * rate;
    const lineTaxable = Math.max(0, lineGross - discount);
    const lineTax = (lineTaxable * gstRate) / 100;
    const lineTotal = lineTaxable + lineTax;

    subtotal += lineGross;
    totalDiscount += discount;
    totalTaxable += lineTaxable;

    processedItems.push({
      item_order: index + 1,
      service_id: item.service_id || null,
      description: item.description,
      hsn_sac: item.hsn_sac || '998311',
      quantity: qty,
      rate: rate,
      discount: discount,
      gst_rate: gstRate,
      taxable_amount: parseFloat(lineTaxable.toFixed(2)),
      tax_amount: parseFloat(lineTax.toFixed(2)),
      total_amount: parseFloat(lineTotal.toFixed(2))
    });
  });

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isGstInvoice) {
    // Average or dominant rate calculation for display breakdown
    const totalTax = processedItems.reduce((acc, curr) => acc + curr.tax_amount, 0);

    if (isInterstate) {
      igstRate = processedItems.length > 0 ? processedItems[0].gst_rate : 18;
      igstAmount = totalTax;
    } else {
      const halfTax = totalTax / 2;
      cgstRate = processedItems.length > 0 ? processedItems[0].gst_rate / 2 : 9;
      cgstAmount = halfTax;
      sgstRate = processedItems.length > 0 ? processedItems[0].gst_rate / 2 : 9;
      sgstAmount = halfTax;
    }
  }

  const rawGrandTotal = totalTaxable + cgstAmount + sgstAmount + igstAmount;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = parseFloat((roundedGrandTotal - rawGrandTotal).toFixed(2));
  const amountInWords = numberToWordsIndian(roundedGrandTotal);

  return {
    invoice_type,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(totalDiscount.toFixed(2)),
    taxable_amount: parseFloat(totalTaxable.toFixed(2)),
    cgst_rate: parseFloat(cgstRate.toFixed(2)),
    cgst_amount: parseFloat(cgstAmount.toFixed(2)),
    sgst_rate: parseFloat(sgstRate.toFixed(2)),
    sgst_amount: parseFloat(sgstAmount.toFixed(2)),
    igst_rate: parseFloat(igstRate.toFixed(2)),
    igst_amount: parseFloat(igstAmount.toFixed(2)),
    round_off: roundOff,
    grand_total: roundedGrandTotal,
    amount_in_words: amountInWords,
    items: processedItems
  };
}

module.exports = {
  calculateInvoiceTotals
};
