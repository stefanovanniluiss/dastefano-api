/**
 *  POST  { dropoff: { address, lat, lng, name, phone } }
 *  ↪︎  { eta_minutes, fee_cents, quote_id }
 */
// /api/uber_quote.js  — Vercel serverless function (Node 18)

const ALLOWED_ORIGIN = 'https://dastefano.cl';  // o "*" mientras pruebas

const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 h
}

module.exports = async (req, res) => {
  setCORS(res);                            // ① SIEMPRE antes de salir

  if (req.method === 'OPTIONS') {          // ② pre-flight
    return res.status(200).end();          //   (headers ya puestos)
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  /* ----------------- lóg. normal ----------------- */
  try {
    const { dropoff } = req.body || {};
    if (!dropoff?.address) {
      return res.status(400).json({ error: 'bad_dropoff' });
    }

    // … getToken(), llamar a /delivery_quotes, etc. …

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'quote_fail' });
  }
};




let token, tokenExpires = 0;                               // cache en memoria

async function getToken () {
  if (token && Date.now() < tokenExpires) return token;

  const res = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id    : process.env.UBER_CLIENT_ID,
      client_secret: process.env.UBER_CLIENT_SECRET,
      grant_type   : 'client_credentials',
      scope        : 'eats.deliveries'
    })
  });
  const d = await res.json();
  token        = d.access_token;
  tokenExpires = Date.now() + (d.expires_in - 60) * 1000; // 1 min de margen
  return token;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).end('Only POST');

  const { dropoff } = req.body || {};
  if (!dropoff?.address || !dropoff?.lat || !dropoff?.lng)
      return res.status(400).json({ error:'bad_dropoff' });

  const access = await getToken();

  const quoteRes = await fetch(
    `https://api.uber.com/v2/customers/${process.env.UBER_CUSTOMER_ID}/delivery_quotes`,
    {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        'Authorization': `Bearer ${access}`
      },
      body: JSON.stringify({
        pickup: {
          nickname : process.env.UBER_PICKUP_NAME,
          address  : process.env.UBER_PICKUP_ADDR,
          location : { lat:+process.env.UBER_PICKUP_LAT, lng:+process.env.UBER_PICKUP_LNG },
          contact  : { first_name:'Da Stefano', last_name:'', phone_number:process.env.UBER_PICKUP_PHONE }
        },
        dropoff: {
          address  : dropoff.address,
          location : { lat:+dropoff.lat, lng:+dropoff.lng },
          contact  : { first_name: dropoff.name||'Cliente', last_name:'', phone_number: dropoff.phone||'' }
        }
      })
    });

  if (!quoteRes.ok) {
    const err = await quoteRes.text();
    console.error('Uber Quote ERR', err);
    return res.status(500).json({ error:'quote_fail' });
  }

  const q = await quoteRes.json();                         // <- fee & duration
  res.json({
    eta_minutes: q.duration,               // minutos totales aprox.
    fee_cents  : q.fee,                    // CLP en centavos
    quote_id   : q.id
  });
};
