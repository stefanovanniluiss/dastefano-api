// api/uber_quote.js

import axios from 'axios';

const CLIENT_ID     = process.env.UBER_CLIENT_ID;
const CLIENT_SECRET = process.env.UBER_CLIENT_SECRET;
const CUSTOMER_ID   = process.env.UBER_CUSTOMER_ID;

// 1) Función para obtener token OAuth2 (Client Credentials)
async function getUberToken() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope:      'eats.deliveries'
  });
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const resp = await axios.post(
    'https://login.uber.com/oauth/v2/token',
    params.toString(),
    { headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`
    }}
  );
  return resp.data.access_token;
}

// 2) Handler principal
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }
  // Esperamos pickup y dropoff en el body
  const { pickup, dropoff } = req.body;
  if (!pickup || !dropoff) {
    return res.status(400).json({ error: 'pickup_and_dropoff_required' });
  }

  try {
    // 3) Obtén token y crea el quote
    const token = await getUberToken();
    const quoteResp = await axios.post(
      `https://api.uber.com/v1/customers/${CUSTOMER_ID}/delivery_quotes`,
      {
        pickup_address:  JSON.stringify(pickup),
        dropoff_address: JSON.stringify(dropoff),
        pickup_latitude:  pickup.latitude,
        pickup_longitude: pickup.longitude,
        dropoff_latitude:  dropoff.latitude,
        dropoff_longitude: dropoff.longitude,
        // Opcionales: tiempos si los quieres programar
      },
      { headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`
      }}
    );

    const q = quoteResp.data;
    // La respuesta tiene fee (costo en CLP en tu caso tras conversión), dropoff_eta (timestamp ISO)
    // y duration (minutos aproximados) :contentReference[oaicite:0]{index=0}
    return res.status(200).json({
      fee:        q.fee,
      eta:        q.duration,        // minutos aproximados
      dropoffEta: q.dropoff_eta     // fecha/hora exacta en ISO
    });
  } catch (err) {
    console.error('Uber Quote error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'uber_quote_failed' });
  }
}
