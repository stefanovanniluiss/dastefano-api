// api/checkout.js  – SDK v1.x (latest)
const { MercadoPagoConfig, Preference } = require('mercadopago');

// 1. SDK config
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN            // ← LIVE token
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  console.log('RAW BODY:', req.body);

  // 2. Parse body (Vercel no lo hace por ti)
  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }

  const { items } = payload || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items_missing' });
  }

  // 3. Crear preferencia
  const preference = new Preference(mp);
  try {
    const resp = await preference.create({
      items,
      back_urls: {
        success: 'https://dastefano.cl/gracias',
        failure: 'https://dastefano.cl/error',
        pending:  'https://dastefano.cl/pendiente'
      },
      auto_return: 'approved',
      notification_url: 'https://api.dastefano.cl/api/webhook'
    });

    // 4. Responder con el link de pago
    res.json({ init_point: resp.init_point });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'checkout_fail' });
  }
};
