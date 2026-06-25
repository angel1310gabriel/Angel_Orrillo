'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Check, CheckSquare, Square, Trash2, Download, Mail, Bell, RotateCcw, UserPlus,
  MoreHorizontal, X, Loader2, AlertTriangle
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/format-helpers';

interface BulkAction {
  label: string;
  icon: React.ReactNode;
  action: (selectedIds: string[]) => Promise<void>;
  variant?: 'default' | 'destructive' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}

interface BulkActionsProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  actions: BulkAction[];
  totalCount?: number;
  className?: string;
  selectAllEnabled?: boolean;
  allIds?: string[];
}

export default function BulkActions({
  selectedIds,
  onSelectionChange,
  actions,
  totalCount,
  className = '',
  selectAllEnabled = true,
  allIds,
}: BulkActionsProps) {
  const [open, setOpen] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const handleSelectAll = useCallback(() => {
    if (selectAllEnabled && allIds) {
      if (selectAll) {
        onSelectionChange([]);
      } else {
        onSelectionChange(allIds);
      }
      setSelectAll(!selectAll);
    }
  }, [selectAll, selectAllEnabled, allIds, onSelectionChange]);

  const isIndeterminate = selectedIds.length > 0 && selectAllEnabled && allIds && selectedIds.length < allIds.length;

  if (selectedIds.length === 0 && !open) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 animate-slide-up ${className}`}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            className="shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            size="sm"
          >
            <CheckSquare className="h-4 w-4" />
            <span>{selectedIds.length} seleccionados</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 min-w-[220px]">
          <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Acciones para {selectedIds.length} elemento{selectedIds.length !== 1 ? 's' : ''}
            </p>
          </div>
          {actions.map((action, i) => (
            <DropdownMenuItem
              key={i}
              className={`flex items-center gap-2 ${action.variant === 'destructive' ? 'text-red-600 dark:text-red-400' : ''} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={async () => {
                if (action.disabled) return;
                await action.action(selectedIds);
                onSelectionChange([]);
                setOpen(false);
              }}
              disabled={action.disabled}
            >
              {action.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon}
              {action.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-slate-500 dark:text-slate-400"
            onClick={() => { onSelectionChange([]); setOpen(false); }}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar selección
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled = false,
  className = '',
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);

  return (
    <label className={`inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
        indeterminate
          ? 'bg-emerald-600 border-emerald-600'
          : checked
            ? 'bg-emerald-600 border-emerald-600'
            : 'border-slate-300 dark:border-slate-600'
      } ${disabled ? 'opacity-50' : ''}`}>
        {indeterminate ? (
          <div className="w-2.5 h-0.5 bg-white" />
        ) : checked ? (
          <Check className="w-3 h-3 text-white" />
        ) : null}
      </div>
    </label>
  );
}

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map(i => i.id));
    }
  }, [items, selectedIds]);

  const clear = useCallback(() => setSelectedIds([]), []);

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const isAllSelected = selectedIds.length === items.length && items.length > 0;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < items.length;

  return {
    selectedIds,
    setSelectedIds,
    toggle,
    toggleAll,
    clear,
    isSelected,
    isAllSelected,
    isIndeterminate,
    count: selectedIds.length,
  };
}