'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/format-helpers';

export interface ReceiptPayment {
  id: string;
  amount: number;
  method: string;
  date: string;
  clientName: string;
  clientDoc: string;
  loanAmount: number;
  collectorName: string;
}

interface PaymentReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ReceiptPayment | null;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  transfer: 'Transferencia',
};

export default function PaymentReceipt({ open, onOpenChange, payment }: PaymentReceiptProps) {
  if (!payment) return null;

  const formattedDate = new Date(payment.date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const whatsappMessage = [
    '*KC Cobranzas - Comprobante de Pago*',
    '',
    `Recibo: #${payment.id.slice(0, 8).toUpperCase()}`,
    `Fecha: ${formattedDate}`,
    '',
    `Cliente: ${payment.clientName}`,
    `Documento: ${payment.clientDoc}`,
    '',
    `Monto del Préstamo: ${formatCurrency(payment.loanAmount)}`,
    `Método de Pago: ${METHOD_LABELS[payment.method] || payment.method}`,
    `Monto Pagado: ${formatCurrency(payment.amount)}`,
    '',
    `Cobrador: ${payment.collectorName}`,
    '',
    '¡Gracias por su pago!',
  ].join('\n');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm print:shadow-none print:border-0 [&>button:first-of-type]:z-10">
        <div className="space-y-4">
          <div className="text-center border-b pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">KC Cobranzas</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Comprobante de Pago</p>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Recibo #</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {payment.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Fecha</span>
              <span className="text-slate-900 dark:text-slate-100">{formattedDate}</span>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Cliente</p>
            <p className="font-medium text-slate-900 dark:text-slate-100">{payment.clientName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{payment.clientDoc}</p>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Préstamo</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(payment.loanAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Método de Pago</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {METHOD_LABELS[payment.method] || payment.method}
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total Pagado</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-300">
              {formatCurrency(payment.amount)}
            </span>
          </div>

          <Separator />

          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Cobrador</span>
            <span className="text-slate-900 dark:text-slate-100 font-medium">{payment.collectorName}</span>
          </div>

          <div className="text-center border-t pt-4">
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Gracias por su pago</p>
          </div>

          <div className="flex gap-2 pt-2 print:hidden">
            <Button variant="outline" className="flex-1" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank')}>
              <Share2 className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
