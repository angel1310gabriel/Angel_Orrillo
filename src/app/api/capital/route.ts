import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, createDoc, collections } from '@/lib/firestore-db';

// GET /api/capital - Get capital history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const skip = (page - 1) * limit;

    const allMovements = await findMany(collections.capitalMovements);
    allMovements.sort((a: any, b: any) => {
      const aDate = typeof a.createdAt === 'string' ? a.createdAt : '';
      const bDate = typeof b.createdAt === 'string' ? b.createdAt : '';
      return bDate.localeCompare(aDate);
    });

    const total = allMovements.length;
    const movements = allMovements.slice(skip, skip + limit);

    const lastMovement = movements.length > 0 ? movements[0] : null;
    const currentCapital = lastMovement?.newCapital || 0;

    const inyeccionMovements = await findMany(collections.capitalMovements, { type: 'INYECCION' });
    const totalInjections = inyeccionMovements.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

    const retiroMovements = await findMany(collections.capitalMovements, { type: 'RETIRO' });
    const totalWithdrawals = retiroMovements.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

    const prestamoMovements = await findMany(collections.capitalMovements, { type: 'PRESTAMO' });
    const totalLoansOut = prestamoMovements.reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

    const activeLoans = await findMany(collections.loans, { status: 'active' });
    const moraLoans = await findMany(collections.loans, { status: 'mora' });
    const activeLoansOut = [...activeLoans, ...moraLoans].reduce((sum: number, l: any) => sum + (l.amount || 0), 0);

    return NextResponse.json({
      currentCapital,
      summary: {
        totalInjections,
        totalWithdrawals,
        totalLoansOut,
        activeLoansOut,
      },
      movements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching capital:', error);
    return NextResponse.json({ error: 'Error al obtener capital' }, { status: 500 });
  }
}

// POST /api/capital - Add capital injection or withdrawal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, amount, description } = body;

    if (!type || !amount) {
      return NextResponse.json({ error: 'Tipo y monto son requeridos' }, { status: 400 });
    }

    if (!['INYECCION', 'RETIRO'].includes(type)) {
      return NextResponse.json({ error: 'Tipo debe ser INYECCION o RETIRO' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    const recentMovements = await findMany(collections.capitalMovements, undefined, { field: 'createdAt', direction: 'desc' }, 1);
    const lastMovement = recentMovements[0] || null;
    const previousCapital = lastMovement?.newCapital || 0;

    let newCapital: number;
    if (type === 'INYECCION') {
      newCapital = previousCapital + amount;
    } else {
      if (amount > previousCapital) {
        return NextResponse.json(
          { error: `Capital insuficiente. Disponible: S/${previousCapital.toFixed(2)}` },
          { status: 400 }
        );
      }
      newCapital = previousCapital - amount;
    }

    const movement = await createDoc(collections.capitalMovements, {
      type,
      amount,
      previousCapital,
      newCapital,
      description: description || `${type === 'INYECCION' ? 'Inyección' : 'Retiro'} de capital: S/${amount}`,
    });

    await createDoc(collections.auditLogs, {
      action: 'CREATE',
      entityType: 'capital',
      entityId: movement.id,
      entityName: `${type === 'INYECCION' ? 'Inyección' : 'Retiro'} de Capital`,
      severity: type === 'RETIRO' ? 'warning' : 'info',
      notes: `${type === 'INYECCION' ? 'Inyección' : 'Retiro'} de S/${amount}. Capital: S/${previousCapital} → S/${newCapital}`,
      changes: JSON.stringify({ type, amount, previousCapital, newCapital }),
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error('Error creating capital movement:', error);
    return NextResponse.json({ error: 'Error al registrar movimiento de capital' }, { status: 500 });
  }
}
