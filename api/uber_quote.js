/**
 *  /api/uber_quote.js  (Vercel • Node 18)
 *
 *  POST  { dropoff:{ address, lat, lng, name?, phone? } }
 *   ↪︎   { eta_minutes, fee_cents, quote_id }
 *
 *  Env-vars usadas
 *  ──────────────────────────────────────────────────────────────
 *   UBER_CLIENT_ID          UBER_CLIENT_SECRET   UBER_CUSTOMER_ID
 *   UBER_PICKUP_NAME        UBER_PICKUP_ADDR
 *   UBER_PICKUP_LAT         UBER_PICKUP_LNG      UBER_PICKUP_PHONE
 */

const ALLOWED_ORIGIN = 'https://dastefano.cl';   // usa "*" solo en localhost
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

/* ─────────────── helpers CORS ─────────────── */
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 h cache pre-flight
}

/* ─────────────── logging de envs clave ─────────────── */
console.log('[boot] env-check →',
  'id',      process.env.UBER_CLIENT_ID?.slice(0, 6)  || 'MISSING',
  'secret',  process.env.UBER_CLIENT_SECRET?.length   || 0,
  'cust',    process.env.UBER_CUSTOMER_ID?.slice(0, 6) || 'MISSING');

/* ─────────────── cache de token ─────────────── */
let token = null;
let tokenExp = 0;            // epoch ms de expiración

async function getToken() {
  if (token && Date.now() < tokenExp - 60_000) {   // margen 60 s
    console.log('[token] reutilizado  (expira en',
                Math.round((tokenExp - Date.now()) / 1000), 's)');
    return token;
  }

  console.log('[token] solicitando nuevo');
  const rsp = await fetch('https://auth.uber.com/oauth/v2/token', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      client_id    : process.env.UBER_CLIENT_ID,
      client_secret: process.env.UBER_CLIENT_SECRET,
      grant_type   : 'client_credentials',
      scope        : 'eats.deliveries'
    })
  });

  const data = await rsp.json();
  if (!data.access_token) {
    console.error('[token] fallo →', data);
    throw new Error('Uber OAuth failed');
  }

  token    = data.access_token;
  tokenExp = Date.now() + (data.expires_in || 0) * 1000;
  console.log('[token] OK – expira en', data.expires_in, 's');
  return token;
}

/* ─────────────── handler principal ─────────────── */
module.exports = async (req, res) => {
  setCORS(res);                             // en TODAS las respuestas

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).end('Method Not Allowed');

  /* -------- validación básica del body -------- */
  const { dropoff } = req.body || {};
  if (!dropoff?.address || dropoff.lat == null || dropoff.lng == null) {
    console.warn('[400] bad_dropoff →', dropoff);
    return res.status(400).json({ error: 'bad_dropoff' });
  }

  try {
    /* 1 · token Uber */
    const access = await getToken();

    /* 2 · arma payload /delivery_quotes */
    const payload = {
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
    };

    console.log('[quote] payload →', JSON.stringify(payload));

    /* 3 · /delivery_quotes */
    const url = `https://api.uber.com/v1/customers/${process.env.UBER_CUSTOMER_ID}/delivery_quotes`;
    const quoteRes = await fetch(url, {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${access}`
      },
      body: JSON.stringify(payload)
    });

    /* 4 · manejo de error HTTP de Uber */
    if (!quoteRes.ok) {
      const txt = await quoteRes.text();
      console.error('[quote] Uber respondió',
                   quoteRes.status, txt.slice(0, 500));
      return res
        .status(quoteRes.status)           // propagamos status original
        .json({ error: 'quote_fail', detail: txt });
    }

    /* 5 · éxito */
    const q = await quoteRes.json();
    console.log('[quote] OK → fee', q.fee, 'cents · eta', q.duration, 'min');
    return res.json({
      eta_minutes: q.duration,
      fee_cents  : q.fee,
      quote_id   : q.id
    });
  } catch (err) {
    console.error('[500] exception →', err);
    return res.status(500).json({ error: 'internal' });
  }
};
