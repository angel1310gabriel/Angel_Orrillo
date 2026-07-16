import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, updateDoc, collections } from '@/lib/firestore-db';

const KEYS = ['payment_qr_plin', 'payment_bank_name', 'payment_bank_cci', 'payment_bank_cuenta', 'payment_phone_plin'];

export async function GET() {
  try {
    const allSettings = await findMany(collections.settings);
    const settings = allSettings.filter((s: any) => KEYS.includes(s.key));
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
    const upserts = KEYS.map(async (key) => {
      const val = body[key];
      if (val === undefined) return;
      const existing = await findFirst(collections.settings, { key });
      if (existing) {
        await updateDoc(collections.settings, existing.id, { value: String(val) });
      } else {
        await createDoc(collections.settings, { key, value: String(val) });
      }
    });
    await Promise.all(upserts);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
