'use client';

import { useState, useEffect, useCallback } from 'react';

interface SavedFilter {
  id: string;
  name: string;
  tab: string;
  filters: Record<string, any>;
  createdAt: string;
  isDefault?: boolean;
}

const STORAGE_KEY = 'kc-saved-filters';

export function useSavedFilters(tab: string) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [currentFilters, setCurrentFilters] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFilters(parsed.filter((f: SavedFilter) => f.tab === tab));
      }
    } catch (e) {
      console.error('Error loading saved filters:', e);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  const saveFilter = useCallback((name: string, filterData: Record<string, any>, makeDefault = false) => {
    const newFilter: SavedFilter = {
      id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      tab,
      filters: filterData,
      createdAt: new Date().toISOString(),
      isDefault: makeDefault,
    };

    const updated = [...filters, newFilter];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      [...JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'), newFilter]
    ));
    setFilters(prev => [...prev, newFilter]);
    return newFilter;
  }, [filters, tab]);

  const updateFilter = useCallback((id: string, updates: Partial<SavedFilter>) => {
    const updated = filters.map(f => f.id === id ? { ...f, ...updates } : f);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').map((f: SavedFilter) =>
        f.id === id ? { ...f, ...updates } : f
      )
    ));
    setFilters(updated);
  }, [filters]);

  const deleteFilter = useCallback((id: string) => {
    const updated = filters.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter((f: SavedFilter) => f.id !== id)
    ));
    setFilters(updated);
  }, [filters]);

  const applyFilter = useCallback((id: string) => {
    const filter = filters.find(f => f.id === id);
    if (filter) {
      setCurrentFilters(filter.filters);
      return filter.filters;
    }
    return null;
  }, [filters]);

  const setDefaultFilter = useCallback((id: string) => {
    const allStored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const updated = allStored.map((f: SavedFilter) =>
      f.tab === tab ? { ...f, isDefault: f.id === id } : f
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFilters(prev => prev.map(f => ({ ...f, isDefault: f.id === id })));
  }, [tab]);

  const getDefaultFilter = useCallback(() => {
    return filters.find(f => f.isDefault) || null;
  }, [filters]);

  return {
    filters,
    currentFilters,
    setCurrentFilters,
    loading,
    saveFilter,
    updateFilter,
    deleteFilter,
    applyFilter,
    setDefaultFilter,
    getDefaultFilter,
  };
}

export function useTabFilters(tab: string, defaultFilters: Record<string, any> = {}) {
  const { filters, currentFilters, setCurrentFilters, loading, saveFilter, applyFilter, getDefaultFilter } = useSavedFilters(tab);

  useEffect(() => {
    if (!loading) {
      const defaultFilter = getDefaultFilter();
      if (defaultFilter) {
        setCurrentFilters(defaultFilter.filters);
      } else {
        setCurrentFilters(defaultFilters);
      }
    }
  }, [loading, getDefaultFilter, setCurrentFilters, defaultFilters]);

  const handleSave = (name: string, makeDefault = false) => {
    saveFilter(name, currentFilters, makeDefault);
  };

  const handleApply = (id: string) => {
    return applyFilter(id);
  };

  return {
    filters,
    currentFilters,
    setCurrentFilters,
    loading,
    handleSave,
    handleApply,
    saveFilter,
    applyFilter,
  };
}