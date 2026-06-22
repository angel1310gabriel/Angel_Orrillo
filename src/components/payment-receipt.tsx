'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Share2, QrCode } from 'lucide-react';
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
  plin: 'Plin',
  transfer: 'Transferencia',
};

export default function PaymentReceipt({ open, onOpenChange, payment }: PaymentReceiptProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetch('/api/payment-settings').then(r => r.ok && r.json()).then(d => setSettings(d || {})).catch(() => {});
    }
  }, [open]);

  if (!payment) return null;

  const formattedDate = new Date(payment.date).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const qrUrl = payment.method === 'plin' ? settings.payment_qr_plin : null;
  const phoneNum = payment.method === 'plin' ? settings.payment_phone_plin : null;

  const paymentDetails: string[] = [];
  if (payment.method === 'plin' && phoneNum) {
    paymentDetails.push(`Número: ${phoneNum}`);
  }
  if (payment.method === 'transfer') {
    if (settings.payment_bank_name) paymentDetails.push(`Banco: ${settings.payment_bank_name}`);
    if (settings.payment_bank_cci) paymentDetails.push(`CCI: ${settings.payment_bank_cci}`);
    if (settings.payment_bank_cuenta) paymentDetails.push(`Cuenta de Ahorro: ${settings.payment_bank_cuenta}`);
  }

  const hour = new Date().getHours();
  let greeting = 'Buenos días';
  if (hour >= 12 && hour < 19) greeting = 'Buenas tardes';
  else if (hour >= 19) greeting = 'Buenas noches';

  const whatsappMessage = [
    `*KC Cobranzas - Comprobante de Pago*`,
    '',
    `${greeting} *${payment.clientName}*`,
    '',
    `Recibo: #${payment.id.slice(0, 8).toUpperCase()}`,
    `Fecha: ${formattedDate}`,
    '',
    `Monto del Préstamo: ${formatCurrency(payment.loanAmount)}`,
    `Método de Pago: ${METHOD_LABELS[payment.method] || payment.method}`,
    `Monto Pagado: ${formatCurrency(payment.amount)}`,
    ...(paymentDetails.length ? ['', ...paymentDetails] : []),
    ...(qrUrl ? ['', qrUrl] : []),
    '',
    `Pago realizado a nombre de *Keysy Otero Cañola*`,
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

          {payment.method === 'plin' && qrUrl && (
            <div className="flex flex-col items-center gap-2">
              <Separator />
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <QrCode className="h-3 w-3" /> Escanea el código QR para pagar
              </p>
              <img src={qrUrl} alt={`QR ${METHOD_LABELS[payment.method]}`} className="h-36 w-36 object-contain rounded-lg border" />
              {phoneNum && <p className="text-xs text-slate-500 dark:text-slate-400">Número: <span className="font-medium text-slate-900 dark:text-slate-100">{phoneNum}</span></p>}
            </div>
          )}

          {payment.method === 'transfer' && paymentDetails.length > 0 && (
            <div>
              <Separator />
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Datos Bancarios</p>
              <div className="space-y-1 text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                {paymentDetails.map((d, i) => (
                  <p key={i} className="text-slate-700 dark:text-slate-300">{d}</p>
                ))}
              </div>
            </div>
          )}

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
