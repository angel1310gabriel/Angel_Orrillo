'use client';
import { useState, useEffect, useCallback } from 'react';

interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
}

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setCompanies(list);

        // Restore saved selection
        const saved = localStorage.getItem('kc-company-id');
        if (saved && list.find((c: Company) => c.id === saved)) {
          setCompany(list.find((c: Company) => c.id === saved) || null);
        } else if (list.length > 0) {
          setCompany(list[0]);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const selectCompany = (c: Company) => {
    setCompany(c);
    localStorage.setItem('kc-company-id', c.id);
  };

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  return { company, companies, loading, selectCompany, refresh: fetchCompanies };
}
