module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  console.log('Webhook received:', req.body);
  res.json({ received: true });
};
