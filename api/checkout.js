const mercadopago = require('mercadopago');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN });

  try {
    const { items } = req.body;
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
    res.json({ init_point: pref.body.init_point });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'checkout-fail' });
  }
};

