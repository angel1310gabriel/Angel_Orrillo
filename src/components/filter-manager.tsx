'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Save, Filter, FilterX, Star, Trash2, ChevronDown, MoreHorizontal,
  Search, X, Check
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSavedFilters } from '@/hooks/use-saved-filters';

interface FilterManagerProps {
  tab: string;
  currentFilters: Record<string, any>;
  onFiltersChange: (filters: Record<string, any>) => void;
  className?: string;
  showSaveButton?: boolean;
  showClearButton?: boolean;
}

export default function FilterManager({
  tab,
  currentFilters,
  onFiltersChange,
  className = '',
  showSaveButton = true,
  showClearButton = true,
}: FilterManagerProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const {
    filters,
    saveFilter,
    applyFilter,
    deleteFilter,
    updateFilter,
    setDefaultFilter,
    getDefaultFilter,
  } = useSavedFilters(tab);

  const hasActiveFilters = Object.values(currentFilters).some(v => v !== '' && v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true));

  const handleSave = () => {
    if (!saveName.trim()) return;
    saveFilter(saveName.trim(), currentFilters, makeDefault);
    setSaveDialogOpen(false);
    setSaveName('');
    setMakeDefault(false);
  };

  const handleApply = (id: string) => {
    const newFilters = applyFilter(id);
    if (newFilters) onFiltersChange(newFilters);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este filtro guardado?')) {
      deleteFilter(id);
    }
  };

  const handleSetDefault = (id: string) => {
    setDefaultFilter(id);
  };

  const handleEdit = (filter: { id: string; name: string }) => {
    setEditingId(filter.id);
    setEditName(filter.name);
  };

  const handleUpdate = () => {
    if (!editName.trim() || !editingId) return;
    updateFilter(editingId, { name: editName.trim() });
    setEditingId(null);
    setEditName('');
  };

  const handleClear = () => {
    onFiltersChange({});
  };

  const defaultFilter = getDefaultFilter();
  const isCurrentDefault = defaultFilter && JSON.stringify(defaultFilter.filters) === JSON.stringify(currentFilters);

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {showClearButton && hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="border-input text-foreground/70 hover:bg-background/50 dark:border-emerald-500/5 dark:text-muted-foreground gap-1"
        >
          <FilterX className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}
    </div>
  );
}