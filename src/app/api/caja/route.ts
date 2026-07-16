import { NextRequest, NextResponse } from 'next/server';
import { findMany, createDoc, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    let movements = await findMany(collections.cajaMovements);

    if (startDate) {
      movements = movements.filter((m: any) => {
        const created = typeof m.createdAt === 'string' ? m.createdAt : '';
        return created >= startDate;
      });
    }
    if (endDate) {
      movements = movements.filter((m: any) => {
        const created = typeof m.createdAt === 'string' ? m.createdAt : '';
        return created <= endDate;
      });
    }
    if (type && (type === 'income' || type === 'expense')) {
      movements = movements.filter((m: any) => m.type === type);
    }

    movements.sort((a: any, b: any) => {
      const aDate = typeof a.createdAt === 'string' ? a.createdAt : '';
      const bDate = typeof b.createdAt === 'string' ? b.createdAt : '';
      return bDate.localeCompare(aDate);
    });

    const total = movements.length;
    movements = movements.slice(0, limit);

    return NextResponse.json({ movements, total });
  } catch (error) {
    console.error('[Caja] GET error:', error);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, amount, category, description, referenceType, referenceId, createdBy } = body;

    if (!type || !['income', 'expense'].includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido. Use income o expense' }, { status: 400 });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'Categoría requerida' }, { status: 400 });
    }

    const movement = await createDoc(collections.cajaMovements, {
      type,
      amount,
      category,
      description: description || null,
      referenceType: referenceType || null,
      referenceId: referenceId || null,
      createdBy: createdBy || null,
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('[Caja] POST error:', error);
    return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 });
  }
}
