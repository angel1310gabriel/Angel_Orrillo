'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Download, Upload, X, Loader2, FileSpreadsheet, Check } from 'lucide-react';

type ExportType = 'clients' | 'loans' | 'payments';

const LABELS: Record<string, string> = {
  clients: 'Clientes',
  loans: 'Préstamos',
  payments: 'Pagos',
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
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Record<string, string>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async (type: ExportType) => {
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
        const body: Record<string, unknown> = {
          name: row.name || row.Nombre || '',
          documentType: row.documentType || row.TipoDocumento || 'dni',
          documentNumber: row.documentNumber || row.NumeroDocumento || row.DNI || '',
          phone: row.phone || row.Telefono || '',
          address: row.address || row.Direccion || '',
          creditScore: parseInt(row.creditScore || row.ScoreCredito || '50'),
        };
        if (!body.name) { err++; continue; }
        const res = await fetch('/api/clients', {
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
      description: `${ok} importados, ${err} errores`,
      variant: err > 0 ? 'destructive' : 'default',
    });
    setImportPreview(null);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Exportar / Importar</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-500" />
              Exportar a Excel
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['clients', 'loans', 'payments'] as ExportType[]).map(type => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => handleExport(type)}
                  disabled={exporting === type}
                  className="h-16 sm:h-20 flex-row sm:flex-col gap-2 sm:gap-1 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {exporting === type ? (
                    <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                  ) : (
                    <Download className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                  )}
                  <span className="text-xs sm:text-sm">{LABELS[type]}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-500" />
              Importar Clientes desde Excel
            </h3>
            {!importPreview ? (
              <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors">
                <Upload className="h-6 w-6 text-slate-400 mb-2" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Seleccionar archivo Excel</span>
                <span className="text-xs text-slate-400 mt-1">.xlsx - Columnas: name, documentType, documentNumber, phone, address</span>
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
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Check className="h-4 w-4 text-emerald-500" />
                  {importPreview.length} registros encontrados
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        {Object.keys(importPreview[0]).slice(0, 5).map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          {Object.values(row).slice(0, 5).map((v, j) => (
                            <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{v}</td>
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
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500"
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
