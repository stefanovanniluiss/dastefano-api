const { MercadoPagoConfig, Preference } = require('mercadopago');

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dastefano.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  setCORS(res);
  console.log('RAW BODY:', req.body);

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items_missing' });
  }

  const cleanItems = items.map(({ currency_id, ...r }) => r);
  const preference = new Preference(mp);

  
  // ---- Genera el external_reference ----
  const external_reference = `pedido_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  try {
    const { init_point } = await preference.create({
      body: {
        items: cleanItems,
        currency_id: 'CLP',
        payer: {
          email: req.body.email || undefined
        },
        back_urls: {
          success: 'https://dastefano.cl/gracias',
          failure: 'https://dastefano.cl/error',
          pending:  'https://dastefano.cl/pendiente'
        },
        auto_return: 'approved',
        notification_url: 'https://api.dastefano.cl/api/webhook',
        external_reference      // <-- Esta línea nueva
      }
    });

    return res.json({ init_point, external_reference });
  } catch (err) {
    console.error('MP Error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
