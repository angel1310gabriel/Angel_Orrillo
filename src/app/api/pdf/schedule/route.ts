import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const loanId = searchParams.get('loanId');

    if (!loanId) {
      return NextResponse.json({ error: 'loanId requerido' }, { status: 400 });
    }

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select(`
        *,
        clients!client_id (name, document_number, phone),
        profiles!collector_id (name)
      `)
      .eq('id', loanId)
      .single();

    if (loanError || !loan) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    const { data: schedule } = await supabase
      .from('payment_schedule')
      .select('*')
      .eq('loan_id', loanId)
      .order('installment_number', { ascending: true });

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;

    const drawText = (text: string, x: number, y: number, size = 9, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
    };

    const drawLine = (y: number, color = rgb(0.8, 0.8, 0.8)) => {
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color });
    };

    // Header
    drawText('CRONOGRAMA DE PAGOS', width / 2 - 60, y, 16, true, rgb(0.1, 0.4, 0.3));
    y -= 22;
    drawText(`Préstamo: ${loanId.slice(0, 8).toUpperCase()} | Cliente: ${loan.clients?.name || '—'}`, margin, y, 9);
    y -= 15;
    drawText(`DNI: ${loan.clients?.document_number || '—'} | Tel: ${loan.clients?.phone || '—'}`, margin, y, 9);
    y -= 15;
    drawText(`Capital: ${formatCurrency(loan.amount)} | Total: ${formatCurrency(loan.total_amount)} | Cuota: ${formatCurrency(loan.daily_payment)}`, margin, y, 9);
    y -= 15;
    drawText(`Frecuencia: ${loan.payment_frequency} | Cobrador: ${loan.profiles?.name || '—'}`, margin, y, 9);
    y -= 25;
    drawLine(y);
    y -= 10;

    // Table header
    const cols = [
      { x: margin, w: 35, label: '#' },
      { x: margin + 35, w: 80, label: 'Fecha venc.' },
      { x: margin + 115, w: 80, label: 'Monto' },
      { x: margin + 195, w: 70, label: 'Estado' },
      { x: margin + 265, w: 120, label: 'Pago real' },
      { x: margin + 385, w: 100, label: 'Diferencia' },
      { x: margin + 485, w: 70, label: 'Método' },
    ];

    cols.forEach(c => drawText(c.label, c.x, y, 8, true));
    y -= 12;
    drawLine(y);
    y -= 8;

    // Rows
    const paidPayments = await supabase
      .from('payments')
      .select('installment_number, amount, payment_method, payment_date')
      .eq('loan_id', loanId);

    const paymentMap = new Map(paidPayments.data?.map(p => [p.installment_number, p]) || []);

    schedule?.forEach((s) => {
      if (y < margin + 30) {
        pdfDoc.addPage();
        y = height - margin;
        cols.forEach(c => drawText(c.label, c.x, y, 8, true));
        y -= 12;
        drawLine(y);
        y -= 8;
      }

      const p = paymentMap.get(s.installment_number);
      const isOverdue = s.status === 'pending' && new Date(s.due_date) < new Date();

      drawText(String(s.installment_number), cols[0].x, y, 8);
      drawText(formatDate(s.due_date), cols[1].x, y, 8);
      drawText(formatCurrency(s.amount), cols[2].x, y, 8);

      const statusLabel = s.status === 'paid' ? 'Pagado' : isOverdue ? 'VENCIDO' : 'Pendiente';
      const statusColor = s.status === 'paid' ? rgb(0, 0.6, 0) : isOverdue ? rgb(0.8, 0, 0) : rgb(0.8, 0.5, 0);
      drawText(statusLabel, cols[3].x, y, 8, false, statusColor);

      drawText(p ? formatCurrency(p.amount) : '—', cols[4].x, y, 8);
      const diff = p ? p.amount - s.amount : 0;
      drawText(diff !== 0 ? (diff > 0 ? '+' : '') + formatCurrency(diff) : '—', cols[5].x, y, 8, false, diff > 0 ? rgb(0, 0.6, 0) : diff < 0 ? rgb(0.8, 0, 0) : rgb(0, 0, 0));

      drawText(p ? (p.payment_method === 'cash' ? 'Efectivo' : p.payment_method === 'plin' ? 'Plin' : p.payment_method) : '—', cols[6].x, y, 8);

      y -= 14;
    });

    // Summary
    y -= 10;
    drawLine(y, rgb(0.5, 0.5, 0.5));
    y -= 15;

    const totalPaid = schedule?.filter(s => s.status === 'paid').length || 0;
    const totalPending = schedule?.filter(s => s.status === 'pending').length || 0;
    const totalAmount = schedule?.reduce((sum, s) => sum + s.amount, 0) || 0;
    const paidAmount = paidPayments.data?.reduce((sum, p) => sum + p.amount, 0) || 0;

    drawText(`Total cuotas: ${schedule?.length || 0} | Pagadas: ${totalPaid} | Pendientes: ${totalPending}`, margin, y, 9, true);
    y -= 15;
    drawText(`Monto total: ${formatCurrency(totalAmount)} | Pagado: ${formatCurrency(paidAmount)} | Saldo: ${formatCurrency(totalAmount - paidAmount)}`, margin, y, 9, true);

    y -= 30;
    drawText(`Generado: ${new Date().toLocaleString('es-PE')}`, margin, y, 8, false, rgb(0.5, 0.5, 0.5));

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cronograma-${loanId.slice(0,8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF schedule error:', error);
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 });
  }
}