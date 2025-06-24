/**
 *  /api/uber_quote.js  (Vercel · Node 18)
 *
 *  POST  { dropoff: { address, lat, lng, name, phone } }
 *     →  { eta_minutes, fee_cents, quote_id }
 *
 *  Usa las variables de entorno:
 *    UBER_CLIENT_ID, UBER_CLIENT_SECRET, UBER_CUSTOMER_ID
 *    UBER_PICKUP_NAME, UBER_PICKUP_ADDR, UBER_PICKUP_LAT, UBER_PICKUP_LNG, UBER_PICKUP_PHONE
 */

console.log('ID', process.env.UBER_CLIENT_ID.slice(0,6),
            'secret', process.env.UBER_CLIENT_SECRET.length,
            'cust', process.env.UBER_CUSTOMER_ID.slice(0,6));

const ALLOWED_ORIGIN = 'https://dastefano.cl';   // pon "*" sólo durante pruebas locales
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

/* ───────────  CORS helper ─────────── */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 h cache del pre-flight
}

/* ───────────  Token cache ─────────── */
let token = null;
let tokenExp = 0;                                 // epoch ms

async function getToken() {
  if (token && Date.now() < tokenExp - 60_000) return token; // reutiliza si faltan >60 s

  const rsp = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.UBER_CLIENT_ID,
      client_secret: process.env.UBER_CLIENT_SECRET,
      grant_type:    'client_credentials',
      scope:         'eats.deliveries'
    })
  });

  const data = await rsp.json();
  if (!data.access_token) throw new Error('Uber OAuth failed');

  token    = data.access_token;
  tokenExp = Date.now() + (data.expires_in || 0) * 1000;      // ms
  return token;
}

/* ───────────  Handler ─────────── */
module.exports = async (req, res) => {
  /* headers CORS en TODAS las salidas */
  setCORS(res);

  if (req.method === 'OPTIONS') return res.status(200).end(); // pre-flight OK
  if (req.method !== 'POST')    return res.status(405).end('Method Not Allowed');

  /* payload mínimo */
  const { dropoff } = req.body || {};
  if (!dropoff?.address || dropoff.lat == null || dropoff.lng == null) {
    return res.status(400).json({ error: 'bad_dropoff' });
  }

  try {
    /* 1 · token Uber */
    const access = await getToken();

    /* 2 · /delivery_quotes */
    const quoteRes = await fetch(
      `https://api.uber.com/v2/customers/${process.env.UBER_CUSTOMER_ID}/delivery_quotes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization : `Bearer ${access}`
        },
        body: JSON.stringify({
          pickup: {
            nickname: process.env.UBER_PICKUP_NAME,
            address : process.env.UBER_PICKUP_ADDR,
            location: {
              lat: +process.env.UBER_PICKUP_LAT,
              lng: +process.env.UBER_PICKUP_LNG
            },
            contact: {
              first_name  : 'Da Stefano',
              phone_number: process.env.UBER_PICKUP_PHONE
            }
          },
          dropoff: {
            address : dropoff.address,
            location: { lat: +dropoff.lat, lng: +dropoff.lng },
            contact : {
              first_name  : dropoff.name  || 'Cliente',
              phone_number: dropoff.phone || ''
            }
          }
        })
      }
    );

    if (!quoteRes.ok) {
      const txt = await quoteRes.text();
      console.error('Uber quote error:', quoteRes.status, txt);
      return res.
        .status(quoteRes.status)          // pasa el mismo status
        .json({ error:'quote_fail', detail: txt });
    }

    /* 3 · Respuesta final */
    const q = await quoteRes.json();
    return res.json({
      eta_minutes: q.duration,   // minutos totales aprox.
      fee_cents : q.fee,         // CLP en centavos
      quote_id  : q.id
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
};
