import { useState, useMemo, Fragment } from 'react';
import { useProjectStore } from '@/store/project-store';
import { Select } from '@/components/ui5/Ui5Select';
import { Dialog, Bar } from '@ui5/webcomponents-react';
import { Input } from '@/components/ui5/Ui5Input';
import { Label } from '@ui5/webcomponents-react';
import { Button } from '@/components/ui5/Ui5Button';
import { Trash2, Pencil, Check, X, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui5/Ui5Toast';
import type { UnitConversion, UnitConversionCategory, UnitPreferences } from '@/engine/types';

const CATEGORY_LABELS: Record<UnitConversionCategory, string> = {
  volume_oil: 'Oil Volume',
  volume_gas: 'Gas Volume',
  mass: 'Mass',
  energy: 'Energy',
  currency: 'Currency',
  pressure: 'Pressure',
  length: 'Length',
};

const CATEGORY_ORDER: UnitConversionCategory[] = [
  'volume_oil',
  'volume_gas',
  'energy',
  'mass',
  'currency',
  'pressure',
  'length',
];

// Display unit options derived from default conversions
const PREFERENCE_OPTIONS: Record<keyof UnitPreferences, string[]> = {
  oilVolume: ['bbl', 'm³', 'litres', 'US gal'],
  gasVolume: ['MMscf', 'Bcf', 'kNm³', 'PJ', 'Tscf'],
  energy: ['MMBtu', 'GJ', 'MWh'],
  currency: ['USD', 'MYR'],
  mass: ['tonne', 'kg', 'lb'],
};

const PREFERENCE_LABELS: Record<keyof UnitPreferences, string> = {
  oilVolume: 'Oil Volume',
  gasVolume: 'Gas Volume',
  energy: 'Energy',
  currency: 'Currency',
  mass: 'Mass',
};

/**
 * Conversion factor IDs whose value is ALSO hardcoded inside the
 * calculation engine. Editing the factor in this table only affects
 * display labels / exports — not revenue or reserves math. See:
 *   - MMscf → MMBtu (1.055) is baked into gas revenue via MSCF_TO_MMBTU
 *     in `src/engine/fiscal/shared.ts:14` (used by `grossRevenueGas`).
 *   - Mscf → boe (1/6) is baked into `gasBcfToMmboe` at
 *     `src/engine/reserves/prms.ts:52`.
 */
const DISPLAY_ONLY_FACTOR_IDS = new Set<string>(['mmscf-mmbtu', 'mscf-boe']);

export function UnitConversionSection() {
  const conversions = useProjectStore((s) => s.unitConversions);
  const preferences = useProjectStore((s) => s.unitPreferences);
  const setUnitPreference = useProjectStore((s) => s.setUnitPreference);
  const addConversion = useProjectStore((s) => s.addUnitConversion);
  const updateConversion = useProjectStore((s) => s.updateUnitConversion);
  const removeConversion = useProjectStore((s) => s.removeUnitConversion);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFactor, setEditingFactor] = useState<string>('');

  const grouped = useMemo(() => {
    const out = new Map<UnitConversionCategory, UnitConversion[]>();
    for (const c of conversions) {
      const arr = out.get(c.category) ?? [];
      arr.push(c);
      out.set(c.category, arr);
    }
    return out;
  }, [conversions]);

  const handleStartEdit = (c: UnitConversion) => {
    setEditingId(c.id);
    setEditingFactor(String(c.factor));
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const factor = Number(editingFactor);
    if (!Number.isFinite(factor) || factor <= 0) {
      toast.error('Factor must be a positive number');
      return;
    }
    try {
      updateConversion(editingId, factor);
      toast.success('Conversion updated');
      setEditingId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingFactor('');
  };

  const handleDelete = (id: string) => {
    try {
      removeConversion(id);
      toast.success('Custom conversion removed');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Display Unit Preferences */}
      <div className="border border-border bg-white p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Display Unit Preferences
        </h4>
        <p className="text-xs text-text-muted mb-3">
          Choose the units used for display across the application. Calculations
          always run in the base units (bbl, MMscf, USD); these preferences only
          affect what you see.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(PREFERENCE_OPTIONS) as Array<keyof UnitPreferences>).map((key) => (
            <div key={key}>
              <Label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">
                {PREFERENCE_LABELS[key]}
              </Label>
              <Select
                value={preferences[key]}
                onValueChange={(v) => {
                  setUnitPreference(key, v);
                  toast.success(`${PREFERENCE_LABELS[key]} display switched to ${v}`);
                }}
                options={PREFERENCE_OPTIONS[key].map((opt) => ({ value: opt, label: opt }))}
                aria-label={PREFERENCE_LABELS[key]}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Super-user banner */}
      <div className="border border-amber/30 bg-amber/5 p-3 flex items-start gap-2">
        <ShieldAlert size={16} className="text-amber shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Super-User Note:</strong> In the
          production SAC implementation, conversion factors are managed by System
          Administrators with a change-approval workflow. All modifications are
          logged in the audit trail. This POC permits direct edits for
          demonstration purposes.
        </p>
      </div>

      {/* Conversion factor table */}
      <div className="border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Conversion Factors ({conversions.length})
          </h4>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-9"
            icon="add"
            onClick={() => setAddDialogOpen(true)}
          >
            Add Conversion
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-content-alt text-text-secondary">
                <th className="text-left px-3 py-1.5 font-semibold">From</th>
                <th className="text-left px-3 py-1.5 font-semibold">To</th>
                <th className="text-right px-3 py-1.5 font-semibold">Factor</th>
                <th className="text-left px-3 py-1.5 font-semibold">Category</th>
                <th className="text-left px-3 py-1.5 font-semibold">Source</th>
                <th className="text-right px-3 py-1.5 font-semibold w-[120px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const items = grouped.get(cat);
                if (!items || items.length === 0) return null;
                return (
                  <Fragment key={cat}>
                    <tr className="bg-content-alt/40">
                      <td colSpan={6} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                        {CATEGORY_LABELS[cat]}
                      </td>
                    </tr>
                    {items.map((c) => {
                      const isEditing = editingId === c.id;
                      const isDisplayOnly = DISPLAY_ONLY_FACTOR_IDS.has(c.id);
                      return (
                        <tr key={c.id} className="border-b border-border/30 hover:bg-content-alt/30">
                          <td className="px-3 py-1.5 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {c.fromUnit}
                              {isDisplayOnly && (
                                <span
                                  title="Display only — the engine uses a fixed ratio for this conversion. Editing this factor changes labels and exports but not revenue or reserves math."
                                  className="inline-flex items-center text-amber cursor-help"
                                  aria-label="Display-only conversion factor"
                                >
                                  <AlertTriangle size={12} />
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">{c.toUnit}</td>
                          <td className="text-right px-3 py-1.5 font-data">
                            {isEditing ? (
                              <Input
                                value={editingFactor}
                                onChange={(e) => setEditingFactor(e.target.value)}
                                type="number"
                                step="0.000001"
                                className="h-7 text-xs font-data text-right w-[110px] inline-block"
                              />
                            ) : (
                              c.factor.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 6,
                              })
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-text-muted">{CATEGORY_LABELS[c.category]}</td>
                          <td className="px-3 py-1.5">
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded',
                                c.isDefault
                                  ? 'bg-text-muted/15 text-text-muted'
                                  : 'bg-petrol/10 text-petrol',
                              )}
                            >
                              {c.isDefault ? 'System Default' : 'User Defined'}
                            </span>
                          </td>
                          <td className="text-right px-3 py-1.5">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={handleSaveEdit}
                                  className="p-1.5 rounded hover:bg-success/10 text-success min-w-[32px] min-h-[32px] flex items-center justify-center"
                                  aria-label="Save"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="p-1.5 rounded hover:bg-text-muted/10 text-text-muted min-w-[32px] min-h-[32px] flex items-center justify-center"
                                  aria-label="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleStartEdit(c)}
                                  className="p-1.5 rounded hover:bg-petrol/10 text-text-muted hover:text-petrol min-w-[32px] min-h-[32px] flex items-center justify-center"
                                  aria-label="Edit factor"
                                >
                                  <Pencil size={13} />
                                </button>
                                {!c.isDefault && (
                                  <button
                                    onClick={() => handleDelete(c.id)}
                                    className="p-1.5 rounded hover:bg-danger/10 text-text-muted hover:text-danger min-w-[32px] min-h-[32px] flex items-center justify-center"
                                    aria-label="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AddConversionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={(input) => {
          try {
            addConversion(input);
            toast.success(`Added ${input.fromUnit} → ${input.toUnit}`);
            setAddDialogOpen(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

interface AddConversionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: {
    fromUnit: string;
    toUnit: string;
    factor: number;
    category: UnitConversionCategory;
    description: string;
  }) => void;
}

function AddConversionDialog({ open, onOpenChange, onAdd }: AddConversionDialogProps) {
  const [fromUnit, setFromUnit] = useState('');
  const [toUnit, setToUnit] = useState('');
  const [factorStr, setFactorStr] = useState('');
  const [category, setCategory] = useState<UnitConversionCategory>('volume_oil');
  const [description, setDescription] = useState('');

  const reset = () => {
    setFromUnit('');
    setToUnit('');
    setFactorStr('');
    setCategory('volume_oil');
    setDescription('');
  };

  const handleSubmit = () => {
    const factor = Number(factorStr);
    if (!fromUnit.trim() || !toUnit.trim()) {
      toast.error('Both units are required');
      return;
    }
    if (!Number.isFinite(factor) || factor <= 0) {
      toast.error('Factor must be a positive number');
      return;
    }
    onAdd({
      fromUnit: fromUnit.trim(),
      toUnit: toUnit.trim(),
      factor,
      category,
      description: description.trim() || `${fromUnit.trim()} to ${toUnit.trim()}`,
    });
    reset();
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      headerText="Add Conversion Factor"
      onClose={handleClose}
      footer={
        <Bar
          endContent={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit}>Add</Button>
            </div>
          }
        />
      }
    >
      <div className="p-4 space-y-3 max-w-md">
        <p className="text-xs text-text-muted">
          Define a custom unit conversion. Validation enforces a positive factor and a unique pair.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">From Unit</Label>
            <Input value={fromUnit} onChange={(e) => setFromUnit(e.target.value)} placeholder="e.g. bbl" className="h-9 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">To Unit</Label>
            <Input value={toUnit} onChange={(e) => setToUnit(e.target.value)} placeholder="e.g. m³" className="h-9 text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Factor (multiply From by this to get To)</Label>
          <Input
            type="number"
            step="0.000001"
            value={factorStr}
            onChange={(e) => setFactorStr(e.target.value)}
            placeholder="e.g. 0.158987"
            className="h-9 text-xs font-data"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as UnitConversionCategory)}
            options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            aria-label="Conversion category"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-text-muted mb-1 block">Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Barrels to Cubic Meters" className="h-9 text-xs" />
        </div>
      </div>
    </Dialog>
  );
}
