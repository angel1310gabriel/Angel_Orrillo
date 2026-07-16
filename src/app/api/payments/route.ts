import { NextRequest, NextResponse } from 'next/server';
import {
  findMany,
  findById,
  createDoc,
  updateDoc,
  deleteDoc,
  collections,
} from '@/lib/firestore-db';

// GET /api/payments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');
    const clientId = searchParams.get('clientId');
    const collectorId = searchParams.get('collectorId');
    const date = searchParams.get('date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { status: 'completed' };
    if (loanId) where.loanId = loanId;
    if (collectorId) where.collectorId = collectorId;
    if (clientId) where.clientId = clientId;

    let payments = await findMany(collections.payments, where, { field: 'paymentDate', direction: 'desc' });

    if (date) {
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const nextDay = new Date(dateObj.getTime() + 86400000);
      payments = payments.filter((p) => {
        const pd = new Date(p.paymentDate as string).getTime();
        return pd >= dateObj.getTime() && pd < nextDay.getTime();
      });
    }

    const total = payments.length;

    const skip = (page - 1) * limit;
    payments = payments.slice(skip, skip + limit);

    const loanIds = [...new Set(payments.map((p) => p.loanId as string).filter(Boolean))];
    const collectorIds = [...new Set(payments.map((p) => p.collectorId as string).filter(Boolean))];

    const allLoans = loanIds.length > 0 ? await findMany(collections.loans) : [];
    const loanMap: Record<string, Record<string, unknown>> = {};
    for (const l of allLoans) {
      if (loanIds.includes(l.id)) loanMap[l.id] = l;
    }

    const clientIds = [...new Set(Object.values(loanMap).map((l) => l.clientId as string).filter(Boolean))];
    const allClients = clientIds.length > 0 ? await findMany(collections.clients) : [];
    const clientMap: Record<string, Record<string, unknown>> = {};
    for (const c of allClients) {
      if (clientIds.includes(c.id)) clientMap[c.id] = c;
    }

    const allCollectors = collectorIds.length > 0 ? await findMany(collections.profiles) : [];
    const collectorMap: Record<string, Record<string, unknown>> = {};
    for (const c of allCollectors) {
      if (collectorIds.includes(c.id)) collectorMap[c.id] = c;
    }

    const enrichedPayments = payments.map((payment) => {
      const loan = loanMap[payment.loanId as string];
      const client = loan ? clientMap[loan.clientId as string] : null;
      const collector = collectorMap[payment.collectorId as string];

      return {
        ...payment,
        loan: loan ? {
          ...loan,
          client: client ? {
            id: client.id,
            name: client.name,
            documentNumber: client.documentNumber,
            documentType: client.documentType,
            phone: client.phone,
          } : null,
        } : null,
        collector: collector ? { id: collector.id, name: collector.name } : null,
      };
    });

    return NextResponse.json({
      payments: enrichedPayments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Error al obtener pagos' }, { status: 500 });
  }
}

// POST /api/payments
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      loanId,
      amount,
      collectorId,
      paymentMethod,
      observation,
      proofPhoto,
      gpsLatitude,
      gpsLongitude,
    } = body;

    if (!loanId || !amount) {
      return NextResponse.json({ error: 'Préstamo y monto son requeridos' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    const loan = await findById(collections.loans, loanId);
    if (!loan) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    if (loan.status !== 'active' && loan.status !== 'mora') {
      return NextResponse.json({ error: 'El préstamo no está activo' }, { status: 400 });
    }

    const loanClient = await findById(collections.clients, loan.clientId as string);
    if (!loanClient) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const totalAmount = Number(loan.totalAmount) || 0;
    const amountPaid = Number(loan.amountPaid) || 0;
    const remaining = totalAmount - amountPaid;
    const paymentAmount = Math.min(amount, remaining);

    const payment = await createDoc(collections.payments, {
      loanId,
      collectorId: collectorId || null,
      clientId: loanClient.id,
      amount: paymentAmount,
      interest: 0,
      paymentMethod: paymentMethod || 'cash',
      status: 'completed',
      observation: observation || null,
      proofPhoto: proofPhoto || null,
      gpsLatitude: gpsLatitude || null,
      gpsLongitude: gpsLongitude || null,
      paymentDate: new Date().toISOString(),
    });

    const newAmountPaid = amountPaid + paymentAmount;
    const newStatus = newAmountPaid >= totalAmount ? 'completed' : loan.status;

    await updateDoc(collections.loans, loanId, {
      amountPaid: newAmountPaid,
      status: newStatus,
    });

    if (newStatus === 'completed') {
      const pendingSchedules = await findMany(collections.paymentSchedules, { loanId, status: 'pending' });
      for (const schedule of pendingSchedules) {
        await updateDoc(collections.paymentSchedules, schedule.id, { status: 'paid' });
      }

      const currentScore = Number(loanClient.creditScore) || 50;
      await updateDoc(collections.clients, loanClient.id, {
        creditScore: Math.min(100, currentScore + 10),
      });

      const movements = await findMany(collections.capitalMovements, undefined, { field: 'createdAt', direction: 'desc' }, 1);
      const currentCapital = Number(movements[0]?.newCapital) || 0;
      await createDoc(collections.capitalMovements, {
        type: 'RETIRO',
        amount: paymentAmount,
        previousCapital: currentCapital,
        newCapital: currentCapital + paymentAmount,
        description: `Pago final - Préstamo completado de ${loanClient.name}`,
      });
    } else {
      if (loan.status === 'mora') {
        const currentScore = Number(loanClient.creditScore) || 50;
        await updateDoc(collections.clients, loanClient.id, {
          creditScore: Math.min(100, currentScore + 2),
        });
      }

      const schedules = await findMany(collections.paymentSchedules, { loanId, status: 'pending' }, { field: 'installmentNumber', direction: 'asc' }, 1);
      if (schedules.length > 0) {
        await updateDoc(collections.paymentSchedules, schedules[0].id, { status: 'paid' });
      }
    }

    await createDoc(collections.auditLogs, {
      action: 'CREATE',
      entityType: 'payment',
      entityId: payment.id,
      entityName: `Pago S/${paymentAmount} - ${loanClient.name}`,
      severity: 'info',
      notes: `Pago registrado: S/${paymentAmount} para ${loanClient.name} (${paymentMethod || 'efectivo'})${newStatus === 'completed' ? ' - PRÉSTAMO COMPLETADO' : ''}`,
      changes: JSON.stringify({
        loanId,
        amount: paymentAmount,
        previousAmountPaid: amountPaid,
        newAmountPaid,
        loanStatus: newStatus,
      }),
    });

    const collectorData = collectorId ? await findById(collections.profiles, collectorId) : null;

    return NextResponse.json({
      ...payment,
      loan: {
        ...loan,
        client: {
          id: loanClient.id,
          name: loanClient.name,
          documentNumber: loanClient.documentNumber,
          documentType: loanClient.documentType,
          phone: loanClient.phone,
        },
      },
      collector: collectorData ? { id: collectorData.id, name: collectorData.name } : null,
      loanStatus: newStatus,
      loanCompleted: newStatus === 'completed',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Error al registrar pago' }, { status: 500 });
  }
}

// DELETE /api/payments
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const payment = await findById(collections.payments, id);
    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const loan = await findById(collections.loans, payment.loanId as string);
    const loanClient = loan ? await findById(collections.clients, loan.clientId as string) : null;

    if (loan) {
      const amountPaid = Number(loan.amountPaid) || 0;
      const paymentAmount = Number(payment.amount) || 0;
      const newAmountPaid = Math.max(0, amountPaid - paymentAmount);
      const totalAmount = Number(loan.totalAmount) || 0;
      const newStatus = newAmountPaid >= totalAmount ? 'completed' : (newAmountPaid > 0 ? 'active' : 'active');

      await updateDoc(collections.loans, payment.loanId as string, {
        amountPaid: newAmountPaid,
        status: newStatus,
      });
    }

    await deleteDoc(collections.payments, id);

    await createDoc(collections.auditLogs, {
      action: 'DELETE',
      entityType: 'payment',
      entityId: id,
      entityName: `Pago S/${payment.amount} - ${loanClient?.name || ''}`,
      severity: 'warning',
      notes: `Pago eliminado: S/${payment.amount} de ${loanClient?.name || ''}`,
    }).catch(() => {});

    return NextResponse.json({ message: 'Pago eliminado', loanId: payment.loanId, amount: payment.amount });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Error al eliminar pago' }, { status: 500 });
  }
}
