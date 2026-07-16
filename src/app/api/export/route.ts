import { NextRequest, NextResponse } from 'next/server';
import { findMany, collections } from '@/lib/firestore-db';

function escapeCSV(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(rows: Record<string, unknown>[], headers: string[], keys: string[]): string {
  const lines: string[] = [headers.map(escapeCSV).join(',')];
  for (const row of rows) {
    lines.push(keys.map((k) => escapeCSV(row[k])).join(','));
  }
  return lines.join('\r\n');
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json({ error: 'Tipo de exportación inválido' }, { status: 400 });
    }

    let rows: Record<string, unknown>[];
    let headers: string[];
    let keys: string[];

    switch (type) {
      case 'clients': {
        headers = ['ID', 'Nombre', 'Documento', 'Teléfono', 'Dirección', 'Score', 'Estado', 'Creado'];
        keys = ['id', 'name', 'documentNumber', 'phone', 'address', 'creditScore', 'isActive', 'createdAt'];
        const clients = await findMany(collections.clients);
        rows = clients.map((c: any) => ({
          id: c.id,
          name: c.name,
          documentNumber: c.documentNumber,
          phone: c.phone,
          address: c.address,
          creditScore: c.creditScore,
          isActive: c.isActive ? 'Activo' : 'Inactivo',
          createdAt: c.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || c.createdAt,
        }));
        break;
      }
      case 'loans': {
        headers = ['ID', 'Cliente', 'Monto', 'Total', 'Pagado', 'Interés', 'Días', 'Estado', 'Creado'];
        keys = ['id', 'clientName', 'amount', 'totalAmount', 'amountPaid', 'interestRate', 'days', 'status', 'createdAt'];
        const loans = await findMany(collections.loans);
        const clientIds = [...new Set(loans.map((l: any) => l.clientId).filter(Boolean))];
        const clientsMap: Record<string, string> = {};
        for (const cid of clientIds) {
          const client = await findMany(collections.clients, { id: cid }).then(r => r[0]).catch(() => null);
          if (client) clientsMap[cid] = client.name;
        }
        rows = loans.map((l: any) => ({
          id: l.id,
          clientName: clientsMap[l.clientId] || '',
          amount: l.amount,
          totalAmount: l.totalAmount,
          amountPaid: l.amountPaid,
          interestRate: l.interestRate,
          days: l.days,
          status: l.status,
          createdAt: l.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || l.createdAt,
        }));
        break;
      }
      case 'payments': {
        headers = ['ID', 'Cliente', 'Préstamo', 'Monto', 'Método', 'Fecha Pago', 'Estado'];
        keys = ['id', 'clientName', 'loanAmount', 'amount', 'paymentMethod', 'paymentDate', 'status'];
        const payments = await findMany(collections.payments);
        const loanIds = [...new Set(payments.map((p: any) => p.loanId).filter(Boolean))];
        const loanMap: Record<string, any> = {};
        for (const lid of loanIds) {
          const loan = await findMany(collections.loans, { id: lid }).then(r => r[0]).catch(() => null);
          if (loan) {
            const client = await findMany(collections.clients, { id: loan.clientId }).then(r => r[0]).catch(() => null);
            loanMap[lid] = { amount: loan.amount, clientName: client?.name || '' };
          }
        }
        rows = payments.map((p: any) => ({
          id: p.id,
          clientName: loanMap[p.loanId]?.clientName || '',
          loanAmount: loanMap[p.loanId]?.amount || 0,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate?.toDate?.()?.toISOString?.()?.split('T')[0] || p.paymentDate,
          status: p.status,
        }));
        break;
      }
      case 'late-fees': {
        headers = ['ID', 'Cliente', 'Préstamo', 'Monto', 'Días Atraso', 'Estado', 'Creado'];
        keys = ['id', 'clientName', 'loanAmount', 'amount', 'daysLate', 'status', 'createdAt'];
        const lateFees = await findMany(collections.lateFees);
        const lfLoanIds = [...new Set(lateFees.map((f: any) => f.loanId).filter(Boolean))];
        const lfLoanMap: Record<string, any> = {};
        for (const lid of lfLoanIds) {
          const loan = await findMany(collections.loans, { id: lid }).then(r => r[0]).catch(() => null);
          if (loan) {
            const client = await findMany(collections.clients, { id: loan.clientId }).then(r => r[0]).catch(() => null);
            lfLoanMap[lid] = { amount: loan.amount, clientName: client?.name || '' };
          }
        }
        rows = lateFees.map((f: any) => ({
          id: f.id,
          clientName: lfLoanMap[f.loanId]?.clientName || '',
          loanAmount: lfLoanMap[f.loanId]?.amount || 0,
          amount: f.amount,
          daysLate: f.daysLate || f.daysLateNum || 0,
          status: f.status,
          createdAt: f.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || f.createdAt,
        }));
        break;
      }
      default:
        return NextResponse.json({ error: 'Tipo de exportación inválido' }, { status: 400 });
    }

    const csv = toCSV(rows, headers, keys);
    const filename = `${type}-${today()}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Export error:', err);
    return NextResponse.json({ error: 'Error al exportar datos' }, { status: 500 });
  }
}
