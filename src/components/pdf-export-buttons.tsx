'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, Receipt, Calendar } from 'lucide-react';

interface PdfExportButtonsProps {
  loanId?: string;
  paymentId?: string;
  className?: string;
}

export default function PdfExportButtons({ loanId, paymentId, className = '' }: PdfExportButtonsProps) {
  const download = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!loanId && !paymentId) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {loanId && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => download(`/api/pdf/contract?loanId=${loanId}`, `contrato-${loanId.slice(0,8)}.pdf`)}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
            title="Descargar contrato PDF"
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Contrato
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => download(`/api/pdf/schedule?loanId=${loanId}`, `cronograma-${loanId.slice(0,8)}.pdf`)}
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
            title="Descargar cronograma PDF"
          >
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Cronograma
          </Button>
        </>
      )}

      {paymentId && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => download(`/api/pdf/receipt?paymentId=${paymentId}`, `recibo-${paymentId.slice(0,8)}.pdf`)}
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
          title="Descargar recibo PDF"
        >
          <Receipt className="h-3.5 w-3.5 mr-1" />
          Recibo
        </Button>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          const url = paymentId
            ? `/api/pdf/receipt?paymentId=${paymentId}`
            : `/api/pdf/schedule?loanId=${loanId}`;
          window.open(url, '_blank');
        }}
        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
        title="Vista previa"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}