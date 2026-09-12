const money = value => `KSh ${Number(value || 0).toLocaleString()}`;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

export async function getReceiptSettings() {
  try {
    const response = await fetch('/api/settings/paybill');
    const data = await response.json();
    return data.settings || {};
  } catch (error) {
    return {};
  }
}

export function receiptData(order, settings = {}) {
  return {
    businessName: settings.receipt_business_name || 'Crystal Crest',
    address: settings.receipt_address || '',
    phone: settings.receipt_phone || '',
    email: settings.receipt_email || '',
    footer: settings.receipt_footer || 'Thank you for shopping with Crystal Crest.',
    orderNumber: order.order_number || order.id || '',
    customer: order.full_name || 'Walk-in Customer',
    payment: order.payment_method || 'M-Pesa',
    status: order.payment_status || 'paid',
    date: new Date(order.created_at || Date.now()).toLocaleString(),
    items: (order.items || []).map(item => ({
      name: item.name || item.prod_name || 'Item',
      quantity: Number(item.quantity || 1),
      price: Number(item.price_at_purchase ?? item.price ?? 0)
    })),
    subtotal: Number(order.subtotal || 0),
    shipping: Number(order.shipping || 0),
    total: Number(order.total || 0)
  };
}

function receiptMarkup(receipt) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(receipt.orderNumber)}</title><style>
    body{font-family:Arial,sans-serif;color:#171717;margin:0;padding:28px;max-width:720px}h1{margin:0 0 4px;font-size:24px}h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px}.muted{color:#666;font-size:12px}.row{display:flex;justify-content:space-between;gap:20px;padding:7px 0;font-size:13px}.total{font-size:17px;font-weight:700;border-top:2px solid #222;margin-top:8px;padding-top:10px}.center{text-align:center}.items{border-top:1px solid #ddd}.footer{margin-top:28px;border-top:1px solid #ddd;padding-top:12px}.no-print{margin-top:24px;padding:10px 16px;cursor:pointer}@media print{.no-print{display:none}body{padding:0}}
  </style></head><body>
  <div class="center"><h1>${escapeHtml(receipt.businessName)}</h1><div class="muted">${escapeHtml(receipt.address)}</div><div class="muted">${escapeHtml(receipt.phone)} ${escapeHtml(receipt.email)}</div></div>
  <h2>Receipt ${escapeHtml(receipt.orderNumber)}</h2><div class="row"><span>Date</span><strong>${escapeHtml(receipt.date)}</strong></div><div class="row"><span>Customer</span><strong>${escapeHtml(receipt.customer)}</strong></div><div class="row"><span>Payment</span><strong>${escapeHtml(receipt.payment)} (${escapeHtml(receipt.status)})</strong></div>
  <h2>Items</h2><div class="items">${receipt.items.map(item => `<div class="row"><span>${escapeHtml(item.quantity)} x ${escapeHtml(item.name)}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join('')}</div>
  <div class="row"><span>Subtotal</span><strong>${money(receipt.subtotal)}</strong></div><div class="row"><span>Shipping</span><strong>${receipt.shipping ? money(receipt.shipping) : 'FREE'}</strong></div><div class="row total"><span>Total Paid</span><strong>${money(receipt.total)}</strong></div>
  <div class="footer center muted">${escapeHtml(receipt.footer)}</div><button class="no-print" onclick="window.print()">Print Receipt</button></body></html>`;
}

export function printReceipt(order, settings = {}) {
  const popup = window.open('', '_blank', 'width=760,height=900');
  if (!popup) return false;
  popup.document.write(receiptMarkup(receiptData(order, settings)));
  popup.document.close();
  popup.focus();
  popup.onload = () => popup.print();
  return true;
}

export async function downloadReceiptPdf(order, settings = {}) {
  const receipt = receiptData(order, settings);
  if (!window.jspdf?.jsPDF) {
    printReceipt(order, settings);
    return false;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 18;
  const line = (text, size = 10, bold = false) => { pdf.setFontSize(size); pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.text(String(text), 18, y); y += size * 0.55 + 3; };
  line(receipt.businessName, 18, true); line(receipt.address, 9); line(`${receipt.phone} ${receipt.email}`, 9); y += 5;
  line(`Receipt ${receipt.orderNumber}`, 13, true); line(`Date: ${receipt.date}`, 9); line(`Customer: ${receipt.customer}`, 9); line(`Payment: ${receipt.payment} (${receipt.status})`, 9); y += 5;
  line('Items', 12, true);
  receipt.items.forEach(item => line(`${item.quantity} x ${item.name} - ${money(item.price * item.quantity)}`, 9));
  y += 4; line(`Subtotal: ${money(receipt.subtotal)}`, 10); line(`Shipping: ${receipt.shipping ? money(receipt.shipping) : 'FREE'}`, 10); line(`TOTAL PAID: ${money(receipt.total)}`, 13, true); y += 8; line(receipt.footer, 9);
  pdf.save(`receipt-${receipt.orderNumber}.pdf`);
  return true;
}
