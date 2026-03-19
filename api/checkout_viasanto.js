const { MercadoPagoConfig, Preference } = require('mercadopago');

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.VIASANTO_ALLOWED_ORIGIN || 'https://viasanto.cl');
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

  const {
    external_reference,
    items,
    email,
    notification_url,
    back_urls,
    metadata
  } = req.body || {};

  if (!external_reference || typeof external_reference !== 'string') {
    return res.status(400).json({ error: 'external_reference_missing' });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items_missing' });
  }
  if (!notification_url || typeof notification_url !== 'string') {
    return res.status(400).json({ error: 'notification_url_missing' });
  }
  if (!back_urls || !back_urls.success || !back_urls.failure || !back_urls.pending) {
    return res.status(400).json({ error: 'back_urls_missing' });
  }

  const cleanItems = items.map(({ currency_id, ...rest }) => rest);
  const preference = new Preference(mp);

  try {
    const created = await preference.create({
      body: {
        items: cleanItems,
        currency_id: 'CLP',
        payer: email ? { email } : undefined,
        back_urls,
        auto_return: 'approved',
        notification_url,
        external_reference,
        metadata: metadata && typeof metadata === 'object' ? metadata : {}
      }
    });

    return res.json({
      init_point: created.init_point,
      external_reference
    });
  } catch (err) {
    console.error('MP checkout_viasanto error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
