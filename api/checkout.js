// /api/checkout.js  (Vercel Serverless Function)

const { MercadoPagoConfig, Preference } = require('mercadopago');

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

function setCORS (res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dastefano.cl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  /* —— Pre-flight —— */
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  setCORS(res);

  /* —— Extrae datos del cuerpo —— */
  const {
    items,
    email,            // opcional
    uber_quote,       // string | null
    dropoff           // { address, lat, lng } | null
  } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items_missing' });
  }

  /* Limpia items (Mercado Pago clava CLP globalmente) */
  const cleanItems = items.map(({ currency_id, ...r }) => r);

  /* —— Construye metadata —— */
  const metadata = {};
  if (uber_quote)              metadata.uber_quote       = uber_quote;
  if (dropoff?.address)        metadata.dropoff_address  = dropoff.address;
  if (dropoff?.lat != null)    metadata.dropoff_lat      = dropoff.lat;
  if (dropoff?.lng != null)    metadata.dropoff_lng      = dropoff.lng;

  /* —— Genera referencia única —— */
  const external_reference =
    `pedido_${Date.now()}_${Math.floor(Math.random()*10000)}`;

  const preference = new Preference(mp);

  try {
    const { init_point } = await preference.create({
      body: {
        items: cleanItems,
        currency_id: 'CLP',
        payer: { email },                 // si viene
        back_urls: {
          success: 'https://dastefano.cl/gracias',
          failure: 'https://dastefano.cl/error',
          pending: 'https://dastefano.cl/pendiente'
        },
        auto_return: 'approved',
        notification_url: 'https://dastefano.cl/api/webhook.php',
        external_reference,
        metadata                          //  ←—— nuevo
      }
    });

    return res.json({ init_point, external_reference });
  } catch (err) {
    console.error('MP Error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
