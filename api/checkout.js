// api/checkout.js  —  versión con CORS estricto y respuesta 204 al pre-flight

const { MercadoPagoConfig, Preference } = require('mercadopago');

/* SDK */
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

/* Utilidad para poner cabeceras CORS */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://dastefano.cl'); // usa '*' mientras pruebas
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  /* --- PRE-FLIGHT ----------------------------------------------------- */
  if (req.method === 'OPTIONS') {
    setCORS(res);
    return res.status(204).end();          // 204 = sin contenido pero OK
  }

  /* --- SÓLO POST ------------------------------------------------------ */
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  setCORS(res);                            // CORS para la respuesta POST
  console.log('RAW BODY:', req.body);

  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items_missing' });
  }

  const cleanItems = items.map(({ currency_id, ...r }) => r);
  const preference = new Preference(mp);

  try {
    const { init_point } = await preference.create({
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

    return res.json({ init_point });
  } catch (err) {
    console.error('MP Error:', err);
    return res.status(500).json({ error: 'checkout_fail' });
  }
};
