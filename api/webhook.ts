import { VercelRequest, VercelResponse } from '@vercel/node';

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).end();
  console.log('Webhook:', req.body);
  // TODO: guardar en DB / enviar mail
  return res.json({ received: true });
};
