const mercadopago = require('mercadopago');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  let payload;
  try {
    // req.body puede venir ya parseado (objeto) o como string
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    return res.status(400).json({ error: 'bad_request', message: 'Bad JSON format' });
  }

  const { items } = payload || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'bad_request', message: 'items missing' });
  }

  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

  try {
    const pref = await mercadopago.preferences.create({
      items,
      back_urls: {
        success: 'https://dastefano.cl/gracias',
        failure: 'https://dastefano.cl/error',
        pending: 'https://dastefano.cl/pendiente'
      },
      auto_return: 'approved',
      notification_url: 'https://api.dastefano.cl/api/webhook'
    });

    return res.json({ init_point: pref.body.init_point });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'checkout-fail' });
  }
};
