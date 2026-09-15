require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const Razorpay = require('razorpay');
const path = require('path');

const app = express();

if (!process.env.DASHBOARD_USER || !process.env.DASHBOARD_PASS) {
  console.error('DASHBOARD_USER and DASHBOARD_PASS must be set in the environment.');
  process.exit(1);
}

app.use(basicAuth({
  users: { [process.env.DASHBOARD_USER]: process.env.DASHBOARD_PASS },
  challenge: true,
  realm: 'Razorpay Refund Dashboard',
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.get('/api/payments', async (req, res) => {
  try {
    const { from, to, count = 100, skip = 0 } = req.query;
    const options = { count: parseInt(count), skip: parseInt(skip) };
    if (from) options.from = parseInt(from);
    if (to) options.to = parseInt(to);

    const payments = await razorpay.payments.all(options);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const payment = await razorpay.payments.fetch(req.params.id);
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/:id/refunds', async (req, res) => {
  try {
    const refunds = await razorpay.payments.fetchMultipleRefund(req.params.id);
    res.json(refunds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refund', async (req, res) => {
  try {
    const { payment_id, amount, notes } = req.body;
    if (!payment_id) return res.status(400).json({ error: 'payment_id is required' });

    const refundOptions = {};
    if (amount) refundOptions.amount = Math.round(amount * 100);
    if (notes) refundOptions.notes = notes;

    const refund = await razorpay.payments.refund(payment_id, refundOptions);
    res.json({ success: true, refund });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refund/bulk', async (req, res) => {
  try {
    const { refunds } = req.body;
    if (!refunds || !Array.isArray(refunds)) {
      return res.status(400).json({ error: 'refunds array is required' });
    }

    const results = [];
    for (const item of refunds) {
      try {
        const refundOptions = {};
        if (item.amount) refundOptions.amount = Math.round(item.amount * 100);
        if (item.notes) refundOptions.notes = item.notes;

        const refund = await razorpay.payments.refund(item.payment_id, refundOptions);
        results.push({ payment_id: item.payment_id, success: true, refund });
      } catch (err) {
        results.push({ payment_id: item.payment_id, success: false, error: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/refunds', async (req, res) => {
  try {
    const { from, to, count = 100, skip = 0 } = req.query;
    const options = { count: parseInt(count), skip: parseInt(skip) };
    if (from) options.from = parseInt(from);
    if (to) options.to = parseInt(to);

    const refunds = await razorpay.refunds.all(options);
    res.json(refunds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Razorpay Refund Dashboard running at http://localhost:${PORT}`);
});
