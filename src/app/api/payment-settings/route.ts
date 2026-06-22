import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const KEYS = ['payment_qr_plin', 'payment_bank_name', 'payment_bank_cci', 'payment_bank_cuenta', 'payment_phone_plin'];

export async function GET() {
  try {
    const settings = await db.setting.findMany({
      where: { key: { in: KEYS } },
    });
    const data: Record<string, string> = {};
    for (const s of settings) data[s.key] = s.value;
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const upserts = KEYS.map((key) => {
      const val = body[key];
      if (val === undefined) return null;
      return db.setting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) },
      });
    }).filter(Boolean);
    await Promise.all(upserts);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
