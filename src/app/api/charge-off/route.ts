import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, updateDoc, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    const where: Record<string, unknown> = {};
    if (loanId) where.loanId = loanId;

    const entries = await findMany(collections.chargeOffs, where, { field: 'createdAt', direction: 'desc' });
    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching charge-off history:', error);
    return NextResponse.json({ error: 'Error al obtener historial de castigos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, amountWrittenOff, reason, writtenOffBy, notes } = body;

    if (!loanId || amountWrittenOff === undefined) {
      return NextResponse.json({ error: 'loanId y amountWrittenOff son requeridos' }, { status: 400 });
    }

    const entry = await createDoc(collections.chargeOffs, {
      loanId,
      amountWrittenOff,
      reason: reason || null,
      writtenOffBy: writtenOffBy || null,
      notes: notes || null,
      recoveredAmount: null,
      recoveredAt: null,
    });

    await updateDoc(collections.loans, loanId, { status: 'charged_off' });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating charge-off:', error);
    return NextResponse.json({ error: 'Error al crear castigo' }, { status: 500 });
  }
}
