import { NextRequest, NextResponse } from 'next/server';
import mercadopago from 'mercadopago';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN!
});

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();
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
    return NextResponse.json({ init_point: pref.body.init_point });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'checkout-fail' }, { status: 500 });
  }
}

