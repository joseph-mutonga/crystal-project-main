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

      const mismatchCbRes = await fetch('http://localhost:4312/api/payments/mpesa-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mismatch)
      });
      const mismatchCbData = await mismatchCbRes.json();
      console.log('MISMATCH CALLBACK', JSON.stringify(mismatchCbData));

      const mismatchStatusRes = await fetch(`http://localhost:4312/api/payments/stk-status/${orderId}`);
      const mismatchStatusData = await mismatchStatusRes.json();
      console.log('MISMATCH STATUS', JSON.stringify(mismatchStatusData));

      if (mismatchStatusData.payment_status !== 'failed') {
        throw new Error(`Expected payment_status to be failed for callback mismatch, got ${mismatchStatusData.payment_status}`);
      }

      const validSuccessCallback = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'merchant-success-1',
            CheckoutRequestID: pushData.checkoutRequestId,
            ResultCode: '0',
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1500 },
                { Name: 'MpesaReceiptNumber', Value: 'QHSTRING01' },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };

      const successCbRes = await fetch('http://localhost:4312/api/payments/mpesa-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSuccessCallback)
      });
      const successCbData = await successCbRes.json();
      console.log('SUCCESS CALLBACK', JSON.stringify(successCbData));

      const successStatusRes = await fetch(`http://localhost:4312/api/payments/stk-status/${orderId}`);
      const successStatusData = await successStatusRes.json();
      console.log('SUCCESS STATUS', JSON.stringify(successStatusData));

      if (successStatusData.payment_status !== 'paid') {
        throw new Error(`Expected valid string-coded success callback to mark order as paid, got ${successStatusData.payment_status}`);
      }

      const duplicateSuccessCbRes = await fetch('http://localhost:4312/api/payments/mpesa-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validSuccessCallback)
      });
      const duplicateSuccessCbData = await duplicateSuccessCbRes.json();
      console.log('DUPLICATE CALLBACK', JSON.stringify(duplicateSuccessCbData));

      const duplicateStatusRes = await fetch(`http://localhost:4312/api/payments/stk-status/${orderId}`);
      const duplicateStatusData = await duplicateStatusRes.json();
      console.log('DUPLICATE STATUS', JSON.stringify(duplicateStatusData));

      if (duplicateStatusData.payment_status !== 'paid') {
        throw new Error(`Expected duplicate callback to keep order as paid, got ${duplicateStatusData.payment_status}`);
      }

      console.log('Mismatch callback was rejected, valid string-coded success callback was accepted, and duplicate callback was ignored as required.');
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
