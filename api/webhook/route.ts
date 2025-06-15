import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log('Webhook recibido:', body);
  // TODO: guardar pedido en base de datos / Sheet
  return NextResponse.json({ ok: true });
}
