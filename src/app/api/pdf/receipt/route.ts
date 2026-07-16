import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { findById, collections } from '@/lib/firestore-db';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(amount);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId requerido' }, { status: 400 });
    }

    const payment = await findById(collections.payments, paymentId);
    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    const loan = payment.loan_id ? await findById(collections.loans, payment.loan_id) : null;
    const client = loan?.client_id ? await findById(collections.clients, loan.client_id) : null;
    const collector = loan?.collector_id ? await findById(collections.profiles, loan.collector_id) : null;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([400, 600]); // Ticket size
    const { width, height } = page.getSize();
    const margin = 20;
    let y = height - margin;

    const drawText = (text: string, x: number, y: number, size = 9, bold = false, align: 'left' | 'center' | 'right' = 'left') => {
      const textWidth = font.widthOfTextAtSize(text, size);
      let finalX = x;
      if (align === 'center') finalX = x - textWidth / 2;
      if (align === 'right') finalX = x - textWidth;
      page.drawText(text, { x: finalX, y, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
    };

    const drawLine = (y: number) => {
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    };

    // Header
    drawText('RECIBO DE PAGO', width / 2, y, 14, true, 'center');
    y -= 18;
    drawText('KC Cobranzas', width / 2, y, 9, false, 'center');
    y -= 12;
    drawText(`RUC: 20123456789`, width / 2, y, 8, false, 'center');
    y -= 20;
    drawLine(y);
    y -= 15;

    // Recibo info
    drawText(`N° Recibo: ${paymentId.slice(0, 8).toUpperCase()}`, margin, y, 9, true);
    drawText(`Fecha: ${formatDateTime(payment.payment_date)}`, width - margin, y, 9, false, 'right');
    y -= 18;

    // Client info
    drawText(`Cliente: ${client?.name || '—'}`, margin, y, 9, true);
    y -= 15;
    drawText(`DNI: ${client?.document_number || '—'}`, margin, y, 9);
    drawText(`Tel: ${client?.phone || '—'}`, width - margin, y, 9, false, 'right');
    y -= 18;

    // Loan info
    drawText(`Préstamo: ${loan?.id?.slice(0, 8).toUpperCase() || '—'}`, margin, y, 9);
    drawText(`Cuota: ${payment.installment_number || '—'}`, width - margin, y, 9, false, 'right');
    y -= 20;
    drawLine(y);
    y -= 15;

    // Amount
    drawText('MONTO PAGADO', width / 2, y, 11, true, 'center');
    y -= 20;
    drawText(formatCurrency(payment.amount), width / 2, y, 24, true, 'center');
    y -= 30;
    drawLine(y);
    y -= 15;

    // Payment method
    const methodLabels: Record<string, string> = { cash: 'Efectivo', plin: 'Plin', transfer: 'Transferencia', qr: 'QR', pos: 'POS' };
    drawText(`Método: ${methodLabels[payment.payment_method] || payment.payment_method}`, margin, y, 9, true);
    y -= 18;

    // Collector
    if (collector?.name) {
      drawText(`Cobrador: ${collector.name}`, margin, y, 9);
      y -= 15;
    }

    // Observation
    if (payment.observation) {
      drawText(`Obs: ${payment.observation}`, margin, y, 8, false);
      y -= 15;
    }

    y -= 10;
    drawLine(y);
    y -= 15;

    // Footer
    drawText('¡Gracias por su pago!', width / 2, y, 10, true, 'center');
    y -= 15;
    drawText('Este recibo es válido como comprobante', width / 2, y, 7, false, 'center');
    y -= 12;
    drawText(`Generado: ${new Date().toLocaleString('es-PE')}`, width / 2, y, 7, false, 'center');

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="recibo-${paymentId.slice(0,8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF receipt error:', error);
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 });
  }
}
