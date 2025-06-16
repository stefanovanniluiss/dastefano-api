import { VercelRequest, VercelResponse } from '@vercel/node';
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN as string
});

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { items } = req.body;
    const pref = await mercadopago.preferences.create({
      items,
      back_urls: {
        success: 'https://dastefano.cl/gracias',
        failure: 'https://dastefano.cl/error',
        pending: 'https://dastefano.cl/pendiente'
      },
      auto_return: 'approved',
      notification_url: 'https://api.dastefano.cl/api/webhook'
    });
    return res.json({ init_point: pref.body.init_point });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'checkout-fail' });
  }
};
