// api/checkout.js  — Mercado Pago SDK v1.x (latest)

/* ---------------------------------------------
 * 1. Importar y configurar el SDK
 * -------------------------------------------*/
const { MercadoPagoConfig, Preference } = require('mercadopago');

const mp = new MercadoPagoConfig({
  // ACCESS TOKEN LIVE o TEST definido en Vercel → Environment Variables
  accessToken: process.env.MP_ACCESS_TOKEN
});

/* ---------------------------------------------
 * 2. Handler de la Serverless Function
 * -------------------------------------------*/
module.exports = async (req, res) => {
  // Acepta sólo POST
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  // Vercel ya parsea el body a objeto JS
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items_missing' });
  }

  // Limpia cualquier currency_id dentro de los ítems (va a nivel raíz)
  const cleanItems = items.map(({ currency_id, ...rest }) => rest);

  /* -------------------------------------------
   * 3. Crear la Preferencia de pago
   * -----------------------------------------*/
  const preference = new Preference(mp);

  try {
    const resp = await preference.create({
      items: cleanItems,
      currency_id: 'CLP',                       // ← Moneda definida aquí
      back_urls: {
        success: 'https://dastefano.cl/gracias',
        failure: 'https://dastefano.cl/error',
        pending:  'https://dastefano.cl/pendiente'
      },
      auto_return: 'approved',
      notification_url: 'https://api.dastefano.cl/api/webhook'
    });

    // 4. Devolver al front el link de pago
    return res.json({ init_point: resp.init_point });
  } catch (err) {
    console.error('MP Error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
