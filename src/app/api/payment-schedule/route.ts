import { NextRequest, NextResponse } from 'next/server';
import { findMany, findById, createDoc, updateDoc, collections } from '@/lib/firestore-db';

function toISO(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (val instanceof Date) return val.toISOString();
  if (val && typeof val === 'object' && 'toDate' in val) return (val as any).toDate().toISOString();
  return String(val);
}

// GET /api/payment-schedule - List payment schedule entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (loanId) where.loanId = loanId;
    if (status) where.status = status;

    const schedules = await findMany(collections.paymentSchedules, where, { field: 'installmentNumber', direction: 'asc' });

    const mapped = schedules.map((item: any) => ({
      id: item.id,
      loanId: item.loanId,
      installmentNumber: item.installmentNumber,
      amount: item.amount,
      dueDate: toISO(item.dueDate),
      status: item.status,
      createdAt: toISO(item.createdAt),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    return NextResponse.json({ error: 'Error al obtener calendario de pagos' }, { status: 500 });
  }
}

// POST /api/payment-schedule - Generate schedule for a loan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loanId, totalAmount, numInstallments, startDate, frequency } = body;

    if (!loanId || !totalAmount || !numInstallments || !startDate) {
      return NextResponse.json({ error: 'Faltan campos requeridos: loanId, totalAmount, numInstallments, startDate' }, { status: 400 });
    }

    const installmentAmount = totalAmount / numInstallments;
    const start = new Date(startDate);
    const entries: Record<string, unknown>[] = [];

    for (let i = 0; i < numInstallments; i++) {
      const dueDate = new Date(start);

      if (frequency === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + i);
      } else if (frequency === 'biweekly') {
        dueDate.setDate(dueDate.getDate() + 15 * i);
      } else if (frequency === 'weekly') {
        dueDate.setDate(dueDate.getDate() + 7 * i);
      } else {
        dueDate.setMonth(dueDate.getMonth() + i);
      }

      entries.push({
        loanId,
        installmentNumber: i + 1,
        amount: installmentAmount,
        dueDate: dueDate.toISOString(),
        status: 'pending',
      });
    }

    const created = await Promise.all(
      entries.map((entry) =>
        createDoc(collections.paymentSchedules, {
          loanId: entry.loanId,
          installmentNumber: entry.installmentNumber,
          amount: entry.amount,
          dueDate: entry.dueDate,
          status: entry.status,
        })
      )
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error generating payment schedule:', error);
    return NextResponse.json({ error: 'Error al generar calendario de pagos' }, { status: 500 });
  }
}

// PATCH /api/payment-schedule?id=xxx - Update a schedule entry status
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Se requiere el campo status' }, { status: 400 });
    }

    await updateDoc(collections.paymentSchedules, id, { status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating payment schedule:', error);
    return NextResponse.json({ error: 'Error al actualizar calendario de pagos' }, { status: 500 });
  }
}
