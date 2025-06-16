const { MercadoPagoConfig, Preference } = require('mercadopago');

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const preference = new Preference(mp);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { items } = req.body;
  const resp = await preference.create({
    items,
    back_urls: {
      success: 'https://dastefano.cl/gracias',
      failure: 'https://dastefano.cl/error',
      pending: 'https://dastefano.cl/pendiente'
    },
    auto_return: 'approved',
    notification_url: 'https://api.dastefano.cl/api/webhook'
  });
  res.json({ init_point: resp.sandbox_init_point || resp.init_point });
};
