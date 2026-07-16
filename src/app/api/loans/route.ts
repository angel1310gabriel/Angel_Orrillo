import { NextRequest, NextResponse } from 'next/server';
import {
  findMany,
  findById,
  findFirst,
  createDoc,
  createMany,
  updateDoc,
  deleteDoc,
  collections,
} from '@/lib/firestore-db';

// GET /api/loans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const clientId = searchParams.get('clientId');
    const collectorId = searchParams.get('collectorId');
    const zoneId = searchParams.get('zoneId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (collectorId) where.collectorId = collectorId;
    if (zoneId) where.zoneId = zoneId;

    let loans = await findMany(
      collections.loans,
      Object.keys(where).length > 0 ? where : undefined,
      { field: 'createdAt', direction: 'desc' },
    );

    const total = loans.length;

    const skip = (page - 1) * limit;
    loans = loans.slice(skip, skip + limit);

    const loanIds = loans.map((l) => l.id as string);
    const clientIds = [...new Set(loans.map((l) => l.clientId as string).filter(Boolean))];
    const collectorIds = [...new Set(loans.map((l) => l.collectorId as string).filter(Boolean))];
    const zoneIds = [...new Set(loans.map((l) => l.zoneId as string).filter(Boolean))];

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

    const allZones = zoneIds.length > 0 ? await findMany(collections.zones) : [];
    const zoneMap: Record<string, Record<string, unknown>> = {};
    for (const z of allZones) {
      if (zoneIds.includes(z.id)) zoneMap[z.id] = z;
    }

    const allPayments = loanIds.length > 0 ? await findMany(collections.payments, { status: 'completed' }) : [];
    const paymentsByLoan: Record<string, Record<string, unknown>[]> = {};
    for (const p of allPayments) {
      const lid = p.loanId as string;
      if (loanIds.includes(lid)) {
        if (!paymentsByLoan[lid]) paymentsByLoan[lid] = [];
        paymentsByLoan[lid].push(p);
      }
    }
    for (const lid of Object.keys(paymentsByLoan)) {
      paymentsByLoan[lid].sort((a, b) => {
        const da = new Date(a.paymentDate as string).getTime();
        const db = new Date(b.paymentDate as string).getTime();
        return db - da;
      });
      paymentsByLoan[lid] = paymentsByLoan[lid].slice(0, 5);
    }

    const allLateFees = loanIds.length > 0 ? await findMany(collections.lateFees) : [];
    const lateFeesByLoan: Record<string, Record<string, unknown>[]> = {};
    for (const f of allLateFees) {
      const lid = f.loanId as string;
      if (loanIds.includes(lid)) {
        if (!lateFeesByLoan[lid]) lateFeesByLoan[lid] = [];
        lateFeesByLoan[lid].push(f);
      }
    }

    const allSchedules = loanIds.length > 0 ? await findMany(collections.paymentSchedules) : [];
    const schedulesByLoan: Record<string, Record<string, unknown>[]> = {};
    for (const s of allSchedules) {
      const lid = s.loanId as string;
      if (loanIds.includes(lid)) {
        if (!schedulesByLoan[lid]) schedulesByLoan[lid] = [];
        schedulesByLoan[lid].push(s);
      }
    }
    for (const lid of Object.keys(schedulesByLoan)) {
      schedulesByLoan[lid].sort((a, b) => (a.installmentNumber as number) - (b.installmentNumber as number));
      schedulesByLoan[lid] = schedulesByLoan[lid].slice(0, 5);
    }

    const loansWithProgress = loans.map((loan) => {
      const client = clientMap[loan.clientId as string];
      const collector = collectorMap[loan.collectorId as string];
      const zone = zoneMap[loan.zoneId as string];
      const clientLoans = paymentsByLoan[loan.id as string] || [];
      const pendingFees = (lateFeesByLoan[loan.id as string] || []).filter((f) => f.status === 'pending');
      const schedule = schedulesByLoan[loan.id as string] || [];

      const totalAmount = Number(loan.totalAmount) || 0;
      const amountPaid = Number(loan.amountPaid) || 0;
      const progressPercent = totalAmount > 0 ? (amountPaid / totalAmount) * 100 : 0;
      const remaining = totalAmount - amountPaid;
      const daysElapsed = loan.startDate
        ? Math.floor((Date.now() - new Date(loan.startDate as string).getTime()) / 86400000)
        : 0;
      const daysRemaining = loan.endDate
        ? Math.floor((new Date(loan.endDate as string).getTime() - Date.now()) / 86400000)
        : null;
      const isOverdue = daysRemaining !== null && daysRemaining < 0;

      return {
        ...loan,
        client: client ? {
          id: client.id,
          name: client.name,
          documentNumber: client.documentNumber,
          documentType: client.documentType,
          phone: client.phone,
          creditScore: client.creditScore,
        } : null,
        collector: collector ? { id: collector.id, name: collector.name } : null,
        zone: zone ? { id: zone.id, name: zone.name } : null,
        payments: clientLoans,
        lateFees: pendingFees,
        schedule,
        progressPercent: Math.min(100, Math.round(progressPercent * 100) / 100),
        remaining: Math.max(0, remaining),
        daysElapsed,
        daysRemaining,
        isOverdue,
        pendingLateFees: pendingFees.length,
      };
    });

    return NextResponse.json({
      loans: loansWithProgress,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: 'Error al obtener préstamos' }, { status: 500 });
  }
}

// POST /api/loans
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      clientId,
      collectorId,
      zoneId,
      amount,
      interestRate,
      days,
      numCuotas: numCuotasInput,
      dailyPayment: dailyPaymentInput,
      paymentFrequency,
      restDays,
      startDate,
      notes,
      guarantors,
    } = body;

    if (!clientId || !amount || !interestRate || !days) {
      return NextResponse.json(
        { error: 'Cliente, monto, tasa de interés y días son requeridos' },
        { status: 400 },
      );
    }

    if (amount <= 0) {
      return NextResponse.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 });
    }

    if (interestRate < 0 || interestRate > 100) {
      return NextResponse.json({ error: 'La tasa de interés debe estar entre 0 y 100' }, { status: 400 });
    }

    const client = await findById(collections.clients, clientId);
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const clientLoans = await findMany(collections.loans, { clientId });
    const activeLoan = clientLoans.find((l) => l.status === 'active' || l.status === 'mora');
    if (activeLoan) {
      return NextResponse.json(
        { error: 'El cliente ya tiene un préstamo activo. Debe completar o cancelar el préstamo anterior.' },
        { status: 409 },
      );
    }

    const interestAmount = amount * (interestRate / 100);
    const totalAmount = amount + interestAmount;
    const numCuotas = numCuotasInput || days;
    const dailyPayment = dailyPaymentInput || Math.round((totalAmount / days) * 100) / 100;
    const loanStartDate = startDate ? new Date(startDate) : new Date();
    const loanEndDate = new Date(loanStartDate.getTime() + days * 86400000);

    const movements = await findMany(collections.capitalMovements, undefined, { field: 'createdAt', direction: 'desc' }, 1);
    const lastCapitalMovement = movements[0];
    const currentCapital = Number(lastCapitalMovement?.newCapital) || 0;

    if (currentCapital < amount) {
      return NextResponse.json(
        { error: `Capital insuficiente. Disponible: S/${currentCapital.toFixed(2)}, Necesario: S/${amount.toFixed(2)}` },
        { status: 400 },
      );
    }

    const loan = await createDoc(collections.loans, {
      clientId,
      collectorId: collectorId || null,
      zoneId: zoneId || client.zoneId || null,
      amount,
      totalAmount,
      interest: interestAmount,
      days,
      dailyPayment,
      paymentFrequency: paymentFrequency || 'daily',
      numCuotas,
      amountPaid: 0,
      startDate: loanStartDate.toISOString(),
      endDate: loanEndDate.toISOString(),
      status: 'active',
      creditApproved: true,
      notes: notes || null,
      restDays: restDays ? (Array.isArray(restDays) ? restDays.join(',') : String(restDays)) : '',
      createdBy: collectorId || null,
    });

    const restSet = new Set((restDays ? String(restDays).split(',').map(Number) : []).filter((n) => !isNaN(n)));
    const nextBiz = (d: Date) => {
      const d2 = new Date(d);
      while (restSet.has(d2.getDay())) d2.setDate(d2.getDate() + 1);
      return d2;
    };
    const scheduleItems = Array.from({ length: numCuotas }, (_, i) => {
      const offset = paymentFrequency === 'weekly' ? (i + 1) * 7 : (i + 1);
      const dueDate = nextBiz(new Date(loanStartDate.getTime() + offset * 86400000));
      return {
        loanId: loan.id,
        installmentNumber: i + 1,
        amount: dailyPayment,
        dueDate: dueDate.toISOString(),
        status: 'pending',
      };
    });
    await createMany(collections.paymentSchedules, scheduleItems);

    const newCapital = currentCapital - amount;
    await createDoc(collections.capitalMovements, {
      type: 'PRESTAMO',
      amount,
      previousCapital: currentCapital,
      newCapital,
      description: `Préstamo creado para ${client.name} - ${days} cuotas de S/${dailyPayment}`,
    });

    await updateDoc(collections.clients, clientId, {
      creditScore: Math.max(0, (Number(client.creditScore) || 50) - 2),
    });

    if (guarantors && Array.isArray(guarantors)) {
      for (const g of guarantors) {
        if (g.name) {
          await createDoc(collections.guarantors, {
            clientId,
            name: g.name,
            documentNumber: g.documentNumber || null,
            documentType: g.documentType || null,
            phone: g.phone || null,
            address: g.address || null,
          });
        }
      }
    }

    await createDoc(collections.auditLogs, {
      action: 'CREATE',
      entityType: 'loan',
      entityId: loan.id,
      entityName: `Préstamo ${client.name} - S/${amount}`,
      severity: 'info',
      notes: `Préstamo creado: S/${amount} a ${client.name}, ${days} cuotas de S/${dailyPayment}, interés ${interestRate}%`,
      changes: JSON.stringify({
        amount,
        totalAmount,
        interest: interestAmount,
        days,
        dailyPayment,
        clientId,
        startDate: loanStartDate,
        endDate: loanEndDate,
      }),
    });

    const clientData = await findById(collections.clients, clientId);
    const collectorData = collectorId ? await findById(collections.profiles, collectorId) : null;
    const loanZone = loan.zoneId ? await findById(collections.zones, loan.zoneId) : null;

    return NextResponse.json({
      ...loan,
      client: clientData ? { id: clientData.id, name: clientData.name, documentNumber: clientData.documentNumber, documentType: clientData.documentType, phone: clientData.phone } : null,
      collector: collectorData ? { id: collectorData.id, name: collectorData.name } : null,
      zone: loanZone ? { id: loanZone.id, name: loanZone.name } : null,
      schedule: scheduleItems.map((s, i) => ({ ...s, id: `temp-${i}` })),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json({ error: 'Error al crear préstamo' }, { status: 500 });
  }
}

// PUT /api/loans
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, notes, collectorId, cancellationReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const existing = await findById(collections.loans, id);
    if (!existing) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    const existingClient = await findById(collections.clients, existing.clientId as string);

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (collectorId !== undefined) updateData.collectorId = collectorId;

    if (status === 'completed' && Number(existing.amountPaid) < Number(existing.totalAmount)) {
      return NextResponse.json(
        { error: 'No se puede completar un préstamo que no está totalmente pagado' },
        { status: 400 },
      );
    }

    if (status === 'cancelled' && existing.status !== 'cancelled') {
      updateData.cancellationReason = cancellationReason || null;
      updateData.cancelledBy = null;
      updateData.cancelledAt = new Date().toISOString();
      const remaining = Number(existing.amount) - Number(existing.amountPaid);
      if (remaining > 0) {
        const movements = await findMany(collections.capitalMovements, undefined, { field: 'createdAt', direction: 'desc' }, 1);
        const currentCapital = Number(movements[0]?.newCapital) || 0;
        await createDoc(collections.capitalMovements, {
          type: 'RETIRO',
          amount: remaining,
          previousCapital: currentCapital,
          newCapital: currentCapital + remaining,
          description: `Préstamo cancelado - reintegro de ${existingClient?.name || ''}`,
        });
      }
      const currentScore = Number(existingClient?.creditScore) || 50;
      await updateDoc(collections.clients, existing.clientId as string, {
        creditScore: Math.max(0, currentScore - 15),
      });
    }

    const loan = await updateDoc(collections.loans, id, updateData);

    const collectorData = loan.collectorId ? await findById(collections.profiles, loan.collectorId as string) : null;

    await createDoc(collections.auditLogs, {
      action: 'UPDATE',
      entityType: 'loan',
      entityId: id,
      entityName: `Préstamo ${existingClient?.name || id}`,
      severity: status === 'cancelled' ? 'critical' : status === 'completed' ? 'info' : 'warning',
      notes: `Préstamo actualizado: estado ${existing.status} → ${status || existing.status}`,
      changes: JSON.stringify({ field: 'status', oldValue: existing.status, newValue: status }),
    });

    return NextResponse.json({
      ...loan,
      client: existingClient ? { id: existingClient.id, name: existingClient.name, documentNumber: existingClient.documentNumber, documentType: existingClient.documentType, phone: existingClient.phone } : null,
      collector: collectorData ? { id: collectorData.id, name: collectorData.name } : null,
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json({ error: 'Error al actualizar préstamo' }, { status: 500 });
  }
}

// DELETE /api/loans
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const loan = await findById(collections.loans, id);
    if (!loan) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    if (loan.status !== 'cancelled' && loan.status !== 'completed') {
      return NextResponse.json({ error: 'Solo se pueden eliminar préstamos cancelados o completados' }, { status: 400 });
    }

    const loanClient = await findById(collections.clients, loan.clientId as string);

    await deleteDoc(collections.loans, id);

    await createDoc(collections.auditLogs, {
      action: 'DELETE',
      entityType: 'loan',
      entityId: id,
      entityName: `Préstamo ${loanClient?.name || id}`,
      severity: 'warning',
      notes: `Préstamo eliminado: ${loanClient?.name || ''} - S/${loan.amount}`,
    }).catch(() => {});

    return NextResponse.json({ message: 'Préstamo eliminado' });
  } catch (error) {
    console.error('Error deleting loan:', error);
    return NextResponse.json({ error: 'Error al eliminar préstamo' }, { status: 500 });
  }
}
