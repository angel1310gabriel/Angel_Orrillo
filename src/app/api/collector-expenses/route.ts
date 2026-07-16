import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, updateDoc, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (collectorId) where.collectorId = collectorId;
    if (status) where.status = status;

    const expenses = await findMany(collections.collectorExpenses, where, { field: 'createdAt', direction: 'desc' });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching collector expenses:', error);
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectorId, amount, category, description, expenseDate, receiptPhoto } = body;

    const expense = await createDoc(collections.collectorExpenses, {
      collectorId,
      amount,
      category,
      description,
      expenseDate,
      receiptPhoto: receiptPhoto || null,
      status: 'pending',
      approvedBy: null,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Error creating collector expense:', error);
    return NextResponse.json({ error: 'Error al crear gasto' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de gasto requerido' }, { status: 400 });
    }

    const body = await request.json();
    const { status, approvedBy } = body;

    await updateDoc(collections.collectorExpenses, id, { status, approvedBy });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating collector expense:', error);
    return NextResponse.json({ error: 'Error al actualizar gasto' }, { status: 500 });
  }
}
