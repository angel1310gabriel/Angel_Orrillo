'use client';

import { useCompany } from '@/hooks/use-company';
import { Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CompanySelector() {
  const { company, companies, selectCompany } = useCompany();

  return (
    <Select
      value={company?.id || ''}
      onValueChange={(id) => {
        const c = companies.find((c) => c.id === id);
        if (c) selectCompany(c);
      }}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs border-slate-200 dark:border-slate-700">
        <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
        <SelectValue placeholder="Compañía" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-xs">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
