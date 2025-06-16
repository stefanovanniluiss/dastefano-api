// api/checkout.js – MercadoPago SDK v1.x

const { MercadoPagoConfig, Preference } = require('mercadopago');

// 1- Configura el SDK con tu Access Token LIVE
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

module.exports = async (req, res) => {
  // Sólo permitimos POST
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  // 2- El body ya viene parseado como objeto en Vercel
  const payload = req.body;
  console.log('RAW BODY:', payload);

  // Validación básica
  const { items } = payload || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items_missing' });
  }

  // 3- Creamos la preferencia
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

    // 4- Respondemos con el link de pago
    return res.json({ init_point: resp.init_point });
  } catch (err) {
    console.error('MP Error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
