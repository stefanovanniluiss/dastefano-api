// api/checkout.js — Mercado Pago SDK v1.x (latest)

const { MercadoPagoConfig, Preference } = require('mercadopago');

/* 1 ▸ Configura el SDK con tu Access Token LIVE (o TEST) */
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

/* 2 ▸ Handler de la Serverless Function */
module.exports = async (req, res) => {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  /* 3 ▸ Inspecciona lo que llega */
  console.log('RAW BODY:', req.body);

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items_missing' });
  }

  // Limpia currency_id interno si el front lo envió
  const cleanItems = items.map(({ currency_id, ...rest }) => rest);

  /* 4 ▸ Crear preferencia (SDK v1.x requiere wrapper "body") */
  const preference = new Preference(mp);

  try {
    const resp = await preference.create({
      body: {
        items: cleanItems,
        currency_id: 'CLP',
        back_urls: {
          success: 'https://dastefano.cl/gracias',
          failure: 'https://dastefano.cl/error',
          pending:  'https://dastefano.cl/pendiente'
        },
        auto_return: 'approved',
        notification_url: 'https://api.dastefano.cl/api/webhook'
      }
    });

    /* 5 ▸ Devolver link de pago */
    return res.json({ init_point: resp.init_point });
  } catch (err) {
    console.error('MP Error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
