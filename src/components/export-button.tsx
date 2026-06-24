'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  type: 'clients' | 'loans' | 'payments' | 'late-fees';
  label?: string;
}

export default function ExportButton({ type, label }: ExportButtonProps) {
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/export?type=${type}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Error',
          description: data.error || 'Error al exportar datos',
          variant: 'destructive',
        });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button onClick={handleExport}>
      <Download className="h-4 w-4" />
      {label || 'Exportar CSV'}
    </Button>
  );
}
