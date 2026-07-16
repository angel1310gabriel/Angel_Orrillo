import { NextRequest, NextResponse } from 'next/server';
import { findMany, findFirst, collections } from '@/lib/firestore-db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const collectorId = searchParams.get('collectorId');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysLater = new Date(today.getTime() + 2 * 86400000);

    const todayStr = today.toISOString().split('T')[0];
    const twoDaysStr = twoDaysLater.toISOString().split('T')[0];

    // Get payment schedules
    const schedules = await findMany(collections.paymentSchedules, { status: 'pending' });

    // Client-side date filter for dueDate between today and two days later
    const filteredSchedules = schedules.filter((s: any) => {
      if (!s.dueDate) return false;
      const due = typeof s.dueDate === 'string' ? s.dueDate : new Date(s.dueDate).toISOString().split('T')[0];
      return due >= todayStr && due <= twoDaysStr;
    });

    // Resolve loan and client info
    const reminders = await Promise.all(
      filteredSchedules
        .filter(async (s: any) => {
          if (!collectorId) return true;
          const loan = await findFirst(collections.loans, { id: s.loanId });
          return loan && loan.collectorId === collectorId;
        })
        .map(async (s: any) => {
          const loan = s.loanId ? await findFirst(collections.loans, { id: s.loanId }) : null;
          let client = null;
          if (loan?.clientId) {
            client = await findFirst(collections.clients, { id: loan.clientId });
          }
          return {
            id: s.id,
            clientName: client?.name || 'Desconocido',
            clientPhone: client?.phone || '',
            loanId: s.loanId,
            installmentNumber: s.installmentNumber,
            amount: Number(s.amount) || 0,
            dueDate: typeof s.dueDate === 'string' ? s.dueDate : s.dueDate?.toISOString?.().split('T')[0],
          };
        })
    );

    // Re-apply collector filter post Promise.all
    let filteredForCollector = reminders;
    if (collectorId) {
      const collectorLoans = await findMany(collections.loans, { collectorId });
      const collectorLoanIds = new Set(collectorLoans.map((l: any) => l.id));
      filteredForCollector = reminders.filter((r) => collectorLoanIds.has(r.loanId));
    }

    // Sort by dueDate ascending
    filteredForCollector.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return NextResponse.json(filteredForCollector);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ error: 'Error al obtener recordatorios' }, { status: 500 });
  }
}
