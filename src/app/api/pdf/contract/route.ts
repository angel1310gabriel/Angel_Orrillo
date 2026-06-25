import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ContractData {
  loanId: string;
  clientName: string;
  clientDni: string;
  clientPhone: string;
  clientAddress?: string;
  amount: number;
  interestRate: number;
  totalAmount: number;
  days: number;
  numCuotas: number;
  dailyPayment: number;
  startDate: string;
  endDate: string;
  paymentFrequency: string;
  collectorName?: string;
  zoneName?: string;
  guarantors?: { name: string; dni: string; phone: string }[];
}

async function fetchContractData(loanId: string): Promise<ContractData | null> {
  const { data: loan, error } = await supabase
    .from('loans')
    .select(`
      *,
      clients!client_id (
        name,
        document_number,
        document_type,
        phone,
        address
      ),
      profiles!collector_id (name),
      zones!zone_id (name)
    `)
    .eq('id', loanId)
    .single();

  if (error || !loan) return null;

  const { data: guarantors } = await supabase
    .from('guarantors')
    .select('name, document_number, phone')
    .eq('loan_id', loanId);

  return {
    loanId: loan.id,
    clientName: loan.clients?.name || '',
    clientDni: loan.clients?.document_number || '',
    clientPhone: loan.clients?.phone || '',
    clientAddress: loan.clients?.address || '',
    amount: loan.amount,
    interestRate: loan.interest_rate,
    totalAmount: loan.total_amount,
    days: loan.days,
    numCuotas: loan.num_cuotas,
    dailyPayment: loan.daily_payment,
    startDate: loan.start_date,
    endDate: loan.end_date,
    paymentFrequency: loan.payment_frequency,
    collectorName: loan.profiles?.name || '',
    zoneName: loan.zones?.name || '',
    guarantors: guarantors || [],
  };
}

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

    const data = await fetchContractData(loanId);
    if (!data) {
      return NextResponse.json({ error: 'Préstamo no encontrado' }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    // Helper functions
    const drawText = (text: string, x: number, y: number, size = 10, bold = false, color = rgb(0, 0, 0)) => {
      page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
    };

    const drawLine = (y: number) => {
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    };

    // Header
    drawText('CONTRATO DE PRÉSTAMO', width / 2 - 70, y, 18, true, rgb(0.1, 0.4, 0.3));
    y -= 25;
    drawText('KC Cobranzas - Sistema de Gestión', width / 2 - 80, y, 10, false, rgb(0.4, 0.4, 0.4));
    y -= 30;
    drawLine(y);
    y -= 20;

    // Loan info
    drawText('DATOS DEL PRÉSTAMO', margin, y, 12, true);
    y -= 20;

    const fields = [
      ['N° Contrato:', data.loanId.slice(0, 8).toUpperCase()],
      ['Fecha:', formatDate(data.startDate)],
      ['Vencimiento:', formatDate(data.endDate)],
      ['Frecuencia:', data.paymentFrequency === 'daily' ? 'Diaria' : data.paymentFrequency === 'weekly' ? 'Semanal' : 'Mensual'],
    ];

    fields.forEach(([label, value]) => {
      drawText(label, margin, y, 10, true);
      drawText(value, margin + 120, y, 10);
      y -= 18;
    });
    y -= 10;

    // Client info
    drawText('DATOS DEL CLIENTE', margin, y, 12, true);
    y -= 20;

    const clientFields = [
      ['Nombre:', data.clientName],
      ['DNI:', data.clientDni],
      ['Teléfono:', data.clientPhone],
      ['Dirección:', data.clientAddress || '—'],
    ];

    clientFields.forEach(([label, value]) => {
      drawText(label, margin, y, 10, true);
      drawText(value, margin + 120, y, 10);
      y -= 18;
    });
    y -= 10;

    // Guarantors
    if (data.guarantors && data.guarantors.length > 0) {
      drawText('GARANTES', margin, y, 12, true);
      y -= 20;
      data.guarantors.forEach((g, i) => {
        drawText(`${i + 1}. ${g.name}`, margin, y, 10, false, rgb(0.2, 0.2, 0.2));
        drawText(`DNI: ${g.dni} | Tel: ${g.phone}`, margin + 10, y - 14, 9, false, rgb(0.4, 0.4, 0.4));
        y -= 28;
      });
      y -= 10;
    }

    // Financial details
    drawLine(y);
    y -= 20;
    drawText('DETALLE FINANCIERO', margin, y, 12, true);
    y -= 20;

    const finFields = [
      ['Capital:', formatCurrency(data.amount)],
      ['Tasa interés:', `${data.interestRate}%`],
      ['Interés:', formatCurrency(data.totalAmount - data.amount)],
      ['Total a pagar:', formatCurrency(data.totalAmount)],
      ['Plazo:', `${data.days} días`],
      ['N° Cuotas:', `${data.numCuotas}`],
      [`Cuota ${data.paymentFrequency === 'daily' ? 'diaria' : 'semanal'}:`, formatCurrency(data.dailyPayment)],
    ];

    finFields.forEach(([label, value]) => {
      drawText(label, margin, y, 10, true);
      drawText(value, margin + 120, y, 10);
      y -= 18;
    });
    y -= 10;

    // Schedule summary
    drawText('CRONOGRAMA RESUMIDO', margin, y, 12, true);
    y -= 20;

    // Table header
    const colWidths = [40, 100, 100, 100, 100];
    const colStart = [margin, margin + 40, margin + 140, margin + 240, margin + 340];
    const headers = ['#', 'Fecha venc.', 'Monto', 'Estado', 'Observ.'];

    drawLine(y);
    y -= 3;
    headers.forEach((h, i) => drawText(h, colStart[i], y, 9, true));
    y -= 15;
    drawLine(y);
    y -= 10;

    // Generate sample schedule (first 10)
    const { data: schedule } = await supabase
      .from('payment_schedule')
      .select('installment_number, due_date, amount, status')
      .eq('loan_id', loanId)
      .order('installment_number', { ascending: true })
      .limit(10);

    schedule?.forEach((s) => {
      if (y < margin + 50) return;
      drawText(String(s.installment_number), colStart[0], y, 9);
      drawText(formatDate(s.due_date), colStart[1], y, 9);
      drawText(formatCurrency(s.amount), colStart[2], y, 9);
      const statusLabel = s.status === 'paid' ? 'Pagado' : s.status === 'pending' ? 'Pendiente' : 'Vencido';
      drawText(statusLabel, colStart[3], y, 9, false, s.status === 'paid' ? rgb(0, 0.6, 0) : s.status === 'pending' ? rgb(0.8, 0.5, 0) : rgb(0.8, 0, 0));
      y -= 16;
    });

    y -= 20;
    drawLine(y);
    y -= 20;

    // Signatures
    drawText('FIRMAS', margin, y, 12, true);
    y -= 30;
    drawText('________________________', margin, y, 10);
    drawText('CLIENTE', margin + 20, y - 15, 9, true);
    drawText('________________________', width / 2 + 20, y, 10);
    drawText('REPRESENTANTE KC COBRANZAS', width / 2 + 40, y - 15, 9, true);
    y -= 50;
    drawText(`Generado automáticamente el ${new Date().toLocaleDateString('es-PE')}`, margin, y, 8, false, rgb(0.5, 0.5, 0.5));

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="contrato-${loanId.slice(0,8)}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF contract error:', error);
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 });
  }
}