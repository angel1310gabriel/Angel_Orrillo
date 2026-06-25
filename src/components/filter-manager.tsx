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
      {showSaveButton && hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 gap-1"
        >
          <Save className="h-3.5 w-3.5" />
          Guardar filtro
        </Button>
      )}

      {showClearButton && hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 gap-1"
        >
          <FilterX className="h-3.5 w-3.5" />
          Limpiar
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 gap-1 ${filters.length > 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros guardados
            {filters.length > 0 && (
              <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0.5 rounded">
                {filters.length}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 min-w-[260px]">
          {filters.length === 0 ? (
            <div className="px-3 py-4 text-center text-slate-500 dark:text-slate-400 text-sm">
              <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p>No hay filtros guardados</p>
              <p className="text-xs mt-1">Aplica filtros y haz clic en "Guardar filtro"</p>
            </div>
          ) : (
            <>
              {defaultFilter && (
                <>
                  <DropdownMenuItem
                    className="bg-emerald-50/50 dark:bg-emerald-950/30"
                    onClick={() => handleApply(defaultFilter.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-current" />
                      <span className="font-medium">Predeterminado: {defaultFilter.name}</span>
                      <Check className="h-4 w-4 text-emerald-600 ml-auto" />
                    </div>
                  </DropdownMenuItem>
                  <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                </>
              )}
              {filters.map((filter) => (
                <DropdownMenuItem
                  key={filter.id}
                  className="relative"
                  onClick={() => editingId !== filter.id && handleApply(filter.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {filter.isDefault && <Star className="h-3.5 w-3.5 text-amber-500 fill-current" />}
                    <span className="truncate font-medium">{filter.name}</span>
                    {Object.keys(filter.filters).length > 0 && (
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {Object.keys(filter.filters).length} filtros
                      </span>
                    )}
                  </div>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!filter.isDefault && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSetDefault(filter.id); }}
                        className="p-1 text-slate-400 hover:text-amber-500"
                        title={filter.isDefault ? 'Predeterminado' : 'Establecer como predeterminado'}
                      >
                        <Star className={`h-3.5 w-3.5 ${filter.isDefault ? 'fill-current text-amber-500' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(filter); }}
                      className="p-1 text-slate-400 hover:text-emerald-600"
                      title="Renombrar"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(filter.id); }}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Guardar filtro actual</h3>
            <div className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del filtro</Label>
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Ej: Mis clientes en mora"
                  autoFocus
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Establecer como filtro predeterminado</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Renombrar filtro</h3>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setEditingId(null); setEditName(''); }}>Cancelar</Button>
              <Button onClick={handleUpdate}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}