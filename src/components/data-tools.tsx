'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Download, Upload, X, Loader2, FileSpreadsheet, Check, Users, CreditCard, Wallet } from 'lucide-react';

type DataType = 'clients' | 'loans' | 'payments';

const LABELS: Record<string, string> = {
  clients: 'Clientes',
  loans: 'Préstamos',
  payments: 'Pagos',
};

const ICONS: Record<string, React.ReactNode> = {
  clients: <Users className="h-4 w-4" />,
  loans: <CreditCard className="h-4 w-4" />,
  payments: <Wallet className="h-4 w-4" />,
};

async function fetchAll(endpoint: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`/api/${endpoint}?limit=99999`);
  if (!res.ok) throw new Error(`Error al obtener ${endpoint}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data.clients) return data.clients;
  if (data.loans) return data.loans;
  if (data.payments) return data.payments;
  return [];
}

function flattenForExport(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items.map(item => {
    const flat: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      if (val === null || val === undefined) flat[key] = '';
      else if (typeof val === 'object' && !Array.isArray(val)) {
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          flat[`${key}_${k}`] = v ?? '';
        }
      } else {
        flat[key] = val;
      }
    }
    return flat;
  });
}

export default function DataToolsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [exporting, setExporting] = useState<DataType | null>(null);
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<DataType>('clients');
  const [importPreview, setImportPreview] = useState<Record<string, string>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async (type: DataType) => {
    setExporting(type);
    try {
      const data = await fetchAll(type);
      if (!data.length) {
        toast({ title: 'Sin datos', description: `No hay ${LABELS[type].toLowerCase()} para exportar` });
        return;
      }
      const flat = flattenForExport(data);
      const ws = XLSX.utils.json_to_sheet(flat);
      const colWidths = Object.keys(flat[0] || {}).map(key => ({
        wch: Math.max(key.length, ...flat.map(r => String(r[key] || '').length).slice(0, 100))
      }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, LABELS[type]);
      XLSX.writeFile(wb, `kc-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: 'Exportado', description: `${LABELS[type]} exportados a Excel` });
    } catch {
      toast({ title: 'Error', description: `No se pudo exportar ${LABELS[type].toLowerCase()}`, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
      if (!data.length) {
        toast({ title: 'Archivo vacío', description: 'El archivo no contiene datos', variant: 'destructive' });
        return;
      }
      setImportPreview(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo leer el archivo', variant: 'destructive' });
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview?.length) return;
    setImporting(true);
    let ok = 0, err = 0;
    for (const row of importPreview) {
      try {
        let body: Record<string, unknown> = {};
        let endpoint = '';
        if (importType === 'clients') {
          body = {
            name: row.name || row.Nombre || '',
            documentType: row.documentType || row.TipoDocumento || 'dni',
            documentNumber: row.documentNumber || row.NumeroDocumento || row.DNI || '',
            phone: row.phone || row.Telefono || '',
            address: row.address || row.Direccion || '',
            creditScore: parseInt(row.creditScore || row.ScoreCredito || '50'),
          };
          if (!body.name) { err++; continue; }
          endpoint = '/api/clients';
        } else if (importType === 'loans') {
          body = {
            clientId: row.clientId || row.ClienteID || row.client_id || '',
            amount: parseFloat(row.amount || row.Monto || row.monto || '0'),
            interestRate: parseFloat(row.interestRate || row.TasaInteres || row.interest_rate || '0'),
            term: parseInt(row.term || row.Plazo || row.plazo || '1'),
            startDate: row.startDate || row.FechaInicio || row.start_date || new Date().toISOString().slice(0, 10),
          };
          if (!body.clientId || !body.amount) { err++; continue; }
          endpoint = '/api/loans';
        } else if (importType === 'payments') {
          body = {
            loanId: row.loanId || row.PrestamoID || row.loan_id || '',
            amount: parseFloat(row.amount || row.Monto || row.monto || '0'),
            paymentDate: row.paymentDate || row.FechaPago || row.payment_date || new Date().toISOString().slice(0, 10),
            paymentMethod: row.paymentMethod || row.MetodoPago || row.payment_method || 'cash',
          };
          if (!body.loanId || !body.amount) { err++; continue; }
          endpoint = '/api/payments';
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) ok++; else err++;
      } catch {
        err++;
      }
    }
    toast({
      title: 'Importación completada',
      description: `${ok} ${LABELS[importType].toLowerCase()} importados, ${err} errores`,
      variant: err > 0 ? 'destructive' : 'default',
    });
    setImportPreview(null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#05060b]/80 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-input/50 dark:border-emerald-500/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-input/50">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-foreground dark:text-foreground">Exportar / Importar</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-background/70 dark:hover:bg-white/10">
            <X className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-3 flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-500" />
              Exportar a Excel
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['clients', 'loans', 'payments'] as DataType[]).map(type => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => handleExport(type)}
                  disabled={exporting === type}
                  className="h-16 sm:h-20 flex-row sm:flex-col gap-2 sm:gap-1 border-input hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {exporting === type ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  ) : (
                    <Download className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />
                  )}
                  <span className="text-xs sm:text-sm">{LABELS[type]}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-input/50 pt-6">
            <h3 className="text-sm font-semibold text-foreground/80 dark:text-foreground/80 mb-3 flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-500" />
              Importar desde Excel
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['clients', 'loans', 'payments'] as DataType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setImportType(type); setImportPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    importType === type
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'bg-[#05060b]/50 text-muted-foreground border border-slate-700/50 hover:border-emerald-500/20 hover:text-emerald-400'
                  }`}
                >
                  {ICONS[type]}
                  {LABELS[type]}
                </button>
              ))}
            </div>
            {!importPreview ? (
              <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-slate-700/50 cursor-pointer hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all">
                <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground dark:text-muted-foreground">Seleccionar archivo Excel</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-foreground/70 dark:text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-500" />
                  {importPreview.length} registros encontrados
                </div>
                <div className="max-h-40 overflow-y-auto border border-input rounded-lg text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-background/50 dark:bg-[#05060b]/70">
                        {Object.keys(importPreview[0]).slice(0, 5).map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground dark:text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-input/50">
                          {Object.values(row).slice(0, 5).map((v, j) => (
                            <td key={j} className="px-3 py-2 text-foreground/80 dark:text-foreground/80 truncate max-w-[120px]">{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleImportConfirm}
                    disabled={importing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Importar {importPreview.length} registros
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setImportPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                    disabled={importing}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
