const express = require('express');

async function run() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/payments', require('../server/routes/payments'));

  const server = app.listen(4312, async () => {
    try {
      const orderId = 'mpesa-mismatch-test-order';

      const pushRes = await fetch('http://localhost:4312/api/payments/mpesa-stk-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, phone: '0712345678', amount: 1500 })
      });
      const pushData = await pushRes.json();
      console.log('PUSH', JSON.stringify(pushData));

      const mismatch = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-mismatch-1',
            CheckoutRequestID: pushData.checkoutRequestId,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1600 },
                { Name: 'MpesaReceiptNumber', Value: 'QH123456789' },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };

      const cbRes = await fetch('http://localhost:4312/api/payments/mpesa-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mismatch)
      });
      const cbData = await cbRes.json();
      console.log('CALLBACK', JSON.stringify(cbData));

      const statusRes = await fetch(`http://localhost:4312/api/payments/stk-status/${orderId}`);
      const statusData = await statusRes.json();
      console.log('STATUS', JSON.stringify(statusData));

      if (statusData.payment_status !== 'failed') {
        throw new Error(`Expected payment_status to be failed for callback mismatch, got ${statusData.payment_status}`);
      }

      console.log('Mismatch callback was rejected as required.');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('TEST FAILED:', err.message);
      server.close();
      process.exit(1);
    }
  });
}

run();
