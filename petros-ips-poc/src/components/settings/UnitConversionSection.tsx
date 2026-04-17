import { useState, useMemo, Fragment } from 'react';
import { useProjectStore } from '@/store/project-store';
import { Select } from '@/components/ui5/Ui5Select';
import { Dialog, Bar } from '@ui5/webcomponents-react';
import { Input } from '@/components/ui5/Ui5Input';
import { Label } from '@ui5/webcomponents-react';
import { Button } from '@/components/ui5/Ui5Button';
import { Trash2, Pencil, Check, X, ShieldAlert, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useAuthStore, useCurrentUser } from '@/store/auth-store';
import { can } from '@/engine/auth/types';
import { isConversionModified } from '@/engine/utils/unit-conversion';
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
  const resetConversion = useProjectStore((s) => s.resetUnitConversionToDefault);
  const recordAudit = useAuthStore((s) => s.recordAudit);
  const user = useCurrentUser();
  const canEdit = user ? can(user.role, 'connection.manage') || user.role === 'admin' : false;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFactor, setEditingFactor] = useState<string>('');
  const [confirmState, setConfirmState] = useState<
    | { kind: 'save'; conv: UnitConversion; newFactor: number }
    | { kind: 'reset'; conv: UnitConversion }
    | { kind: 'delete'; conv: UnitConversion }
    | null
  >(null);

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
    if (!canEdit) {
      toast.error('Your role does not permit conversion-factor edits.');
      return;
    }
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
    const conv = conversions.find((c) => c.id === editingId);
    if (!conv) return;
    if (factor === conv.factor) {
      setEditingId(null);
      return;
    }
    // Route destructive edits of System Defaults through the confirm dialog.
    if (conv.isDefault) {
      setConfirmState({ kind: 'save', conv, newFactor: factor });
    } else {
      commitSave(conv, factor);
    }
  };

  const commitSave = (conv: UnitConversion, factor: number) => {
    try {
      updateConversion(conv.id, factor);
      recordAudit({
        kind: 'connection.configured',
        targetId: `unit-conversion::${conv.id}`,
        targetLabel: `${conv.fromUnit} → ${conv.toUnit}`,
        detail: `Factor changed from ${conv.factor} to ${factor}`,
      });
      toast.success(`${conv.fromUnit} → ${conv.toUnit} factor updated to ${factor}.`);
      setEditingId(null);
      setConfirmState(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingFactor('');
  };

  const handleResetRequest = (c: UnitConversion) => {
    if (!canEdit) return;
    setConfirmState({ kind: 'reset', conv: c });
  };

  const commitReset = (conv: UnitConversion) => {
    try {
      resetConversion(conv.id);
      recordAudit({
        kind: 'connection.configured',
        targetId: `unit-conversion::${conv.id}`,
        targetLabel: `${conv.fromUnit} → ${conv.toUnit}`,
        detail: `Reset to System Default (${conv.defaultFactor ?? conv.factor})`,
      });
      toast.success(`${conv.fromUnit} → ${conv.toUnit} reset to System Default.`);
      setConfirmState(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDeleteRequest = (c: UnitConversion) => {
    if (!canEdit) return;
    setConfirmState({ kind: 'delete', conv: c });
  };

  const commitDelete = (conv: UnitConversion) => {
    try {
      removeConversion(conv.id);
      recordAudit({
        kind: 'connection.disconnected',
        targetId: `unit-conversion::${conv.id}`,
        targetLabel: `${conv.fromUnit} → ${conv.toUnit}`,
        detail: 'Custom conversion removed',
      });
      toast.success('Custom conversion removed');
      setConfirmState(null);
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
        <ShieldAlert size={16} className="text-amber shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-text-secondary leading-relaxed">
          <strong className="text-text-primary">Super-User Note:</strong> Edits to conversion factors are restricted to <strong>Admin</strong> role and write entries to the <a className="underline text-petrol" href="/audit">audit trail</a>.
          {!canEdit && (
            <> Your current role <strong>cannot</strong> edit — the pencil, reset, and delete controls are disabled.</>
          )}
          {' '}Changes take effect across the application immediately; a confirmation dialog protects System Default values.
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
                      const modified = isConversionModified(c);
                      return (
                        <tr key={c.id} className={cn(
                          'border-b border-border/30 hover:bg-content-alt/30',
                          modified && 'bg-petrol/5',
                        )}>
                          <td className="px-3 py-1.5 font-medium">
                            <span className="inline-flex items-center gap-1.5">
                              {c.fromUnit}
                              {isDisplayOnly && (
                                <span
                                  title="Display only — the engine uses a fixed ratio for this conversion. Editing this factor changes labels and exports but not revenue or reserves math."
                                  className="inline-flex items-center text-amber cursor-help"
                                  aria-label="Display-only conversion factor: edits affect labels and exports only, not revenue or reserves math."
                                >
                                  <AlertTriangle size={12} aria-hidden="true" />
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
                                'text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap',
                                modified
                                  ? 'bg-amber/10 text-amber border-amber/30'
                                  : c.isDefault
                                    ? 'bg-text-muted/10 text-text-muted border-transparent'
                                    : 'bg-petrol/10 text-petrol border-petrol/30',
                              )}
                              title={
                                modified
                                  ? `Modified from System Default (${c.defaultFactor}). Use the reset action to restore.`
                                  : c.isDefault
                                    ? 'Seeded default value — no changes on file.'
                                    : 'User-defined conversion added by a super-user.'
                              }
                            >
                              {modified ? `Modified (was ${c.defaultFactor})` : c.isDefault ? 'System Default' : 'User Defined'}
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
                                  disabled={!canEdit}
                                  className={cn(
                                    'p-1.5 rounded min-w-[32px] min-h-[32px] flex items-center justify-center',
                                    canEdit
                                      ? 'hover:bg-petrol/10 text-text-muted hover:text-petrol'
                                      : 'text-text-muted/40 cursor-not-allowed',
                                  )}
                                  aria-label={`Edit ${c.fromUnit} to ${c.toUnit} factor`}
                                  title={canEdit ? 'Edit factor' : 'Requires Admin role'}
                                >
                                  <Pencil size={13} aria-hidden="true" />
                                </button>
                                {modified && (
                                  <button
                                    onClick={() => handleResetRequest(c)}
                                    disabled={!canEdit}
                                    className={cn(
                                      'p-1.5 rounded min-w-[32px] min-h-[32px] flex items-center justify-center',
                                      canEdit
                                        ? 'hover:bg-amber/10 text-amber'
                                        : 'text-text-muted/40 cursor-not-allowed',
                                    )}
                                    aria-label={`Reset ${c.fromUnit} to ${c.toUnit} to System Default`}
                                    title="Reset to System Default"
                                  >
                                    <RotateCcw size={13} aria-hidden="true" />
                                  </button>
                                )}
                                {!c.isDefault && (
                                  <button
                                    onClick={() => handleDeleteRequest(c)}
                                    disabled={!canEdit}
                                    className={cn(
                                      'p-1.5 rounded min-w-[32px] min-h-[32px] flex items-center justify-center',
                                      canEdit
                                        ? 'hover:bg-danger/10 text-text-muted hover:text-danger'
                                        : 'text-text-muted/40 cursor-not-allowed',
                                    )}
                                    aria-label={`Delete ${c.fromUnit} to ${c.toUnit}`}
                                    title={canEdit ? 'Delete custom conversion' : 'Requires Admin role'}
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
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
            recordAudit({
              kind: 'connection.configured',
              targetId: `unit-conversion::custom::${input.fromUnit}-${input.toUnit}`,
              targetLabel: `${input.fromUnit} → ${input.toUnit}`,
              detail: `User-defined conversion added (factor ${input.factor})`,
            });
            toast.success(`Added ${input.fromUnit} → ${input.toUnit}`);
            setAddDialogOpen(false);
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <ConfirmDialog
        state={confirmState}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.kind === 'save') commitSave(confirmState.conv, confirmState.newFactor);
          else if (confirmState.kind === 'reset') commitReset(confirmState.conv);
          else if (confirmState.kind === 'delete') commitDelete(confirmState.conv);
        }}
      />
    </div>
  );
}

function ConfirmDialog({
  state,
  onCancel,
  onConfirm,
}: {
  state:
    | { kind: 'save'; conv: UnitConversion; newFactor: number }
    | { kind: 'reset'; conv: UnitConversion }
    | { kind: 'delete'; conv: UnitConversion }
    | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const open = state !== null;
  if (!open) return null;

  let title = '';
  let body: React.ReactNode = null;
  let confirmLabel = 'Confirm';
  let tone: 'petrol' | 'amber' | 'danger' = 'petrol';

  if (state.kind === 'save') {
    title = `Overwrite ${state.conv.fromUnit} → ${state.conv.toUnit}?`;
    body = (
      <>
        <p>You're about to change a <strong>System Default</strong> conversion factor. This affects every page that reads this conversion (formatters, exports, and downstream calculations when the factor drives engine math).</p>
        <ul className="mt-2 space-y-0.5 text-[11px] list-disc pl-4">
          <li>Current: <span className="font-data">{state.conv.factor}</span></li>
          <li>New: <span className="font-data text-petrol font-semibold">{state.newFactor}</span></li>
        </ul>
        <p className="mt-2">The action is logged in the audit trail under your identity.</p>
      </>
    );
    confirmLabel = 'Save factor';
    tone = 'petrol';
  } else if (state.kind === 'reset') {
    title = `Reset ${state.conv.fromUnit} → ${state.conv.toUnit}?`;
    body = (
      <>
        <p>Restore this conversion to its seeded System Default value of <span className="font-data font-semibold">{state.conv.defaultFactor}</span>?</p>
        <p className="mt-2">Current override: <span className="font-data text-amber">{state.conv.factor}</span>. The reset is logged in the audit trail.</p>
      </>
    );
    confirmLabel = 'Reset to default';
    tone = 'amber';
  } else {
    title = `Delete ${state.conv.fromUnit} → ${state.conv.toUnit}?`;
    body = (
      <p>Remove this user-defined conversion? This cannot be undone from this screen; you'd need to re-add it with the same values.</p>
    );
    confirmLabel = 'Delete';
    tone = 'danger';
  }

  const confirmClass =
    tone === 'danger'
      ? 'bg-danger hover:bg-danger/90 text-white'
      : tone === 'amber'
        ? 'bg-amber hover:bg-amber/90 text-white'
        : 'bg-petrol hover:bg-petrol-light text-white';

  return (
    <Dialog
      open={open}
      headerText={title}
      onClose={onCancel}
      footer={
        <Bar
          endContent={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn('h-9 px-3 text-xs font-semibold', confirmClass)}
              >
                {confirmLabel}
              </button>
            </div>
          }
        />
      }
    >
      <div className="p-4 text-xs text-text-primary leading-relaxed max-w-md">
        {body}
      </div>
    </Dialog>
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
