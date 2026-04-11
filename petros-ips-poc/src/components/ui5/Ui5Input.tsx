// ════════════════════════════════════════════════════════════════════════
// Input Adapter — wraps @ui5/webcomponents-react Input to preserve the
// shadcn/ui Input call-site API (controlled value + onChange) while
// rendering in SAP Fiori Horizon.
//
// IMPORTANT: UI5 Input does NOT accept HTML-native `step`, `min`, or `max`
// attributes — `step` in particular is a read-only getter on the
// ui5-input custom element. Attempting to set them throws at runtime.
// We accept these props from callers for API parity, but apply the
// constraints inside the onInput handler instead of forwarding them to
// the component.
// ════════════════════════════════════════════════════════════════════════

import { Input as Ui5BaseInput } from '@ui5/webcomponents-react';
import type { InputPropTypes } from '@ui5/webcomponents-react';
import type { ChangeEvent } from 'react';

interface AdapterProps {
  type?: string;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** Numeric minimum — clamped in the onInput handler */
  min?: number;
  /** Numeric maximum — clamped in the onInput handler */
  max?: number;
  /** Numeric step — rounded in the onInput handler (not a getter-set) */
  step?: number | string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function Input({
  type = 'text',
  value,
  onChange,
  className,
  placeholder,
  disabled,
  readOnly,
  min,
  max,
  step,
  id,
  'aria-label': ariaLabel,
}: AdapterProps) {
  // Map HTML type → UI5 type
  const ui5Type =
    type === 'number' ? 'Number' :
    type === 'email' ? 'Email' :
    type === 'password' ? 'Password' :
    type === 'tel' ? 'Tel' :
    type === 'url' ? 'URL' :
    type === 'search' ? 'Search' :
    'Text';

  const handleInput: InputPropTypes['onInput'] = (e) => {
    if (!onChange) return;
    const target = e.target as unknown as HTMLInputElement;
    let raw = target.value;

    // For numeric inputs, apply min/max/step in JS since the UI5 component
    // rejects these attributes on its custom-element properties.
    if (ui5Type === 'Number' && raw !== '' && raw !== '-') {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed)) {
        let next = parsed;
        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);
        if (step !== undefined) {
          const stepNum = typeof step === 'string' ? parseFloat(step) : step;
          if (Number.isFinite(stepNum) && stepNum > 0) {
            next = Math.round(next / stepNum) * stepNum;
          }
        }
        raw = String(next);
      }
    }

    // Synthesize a React-style ChangeEvent so call sites continue to work
    // with `onChange={(e) => setX(Number(e.target.value))}`.
    const synthetic = {
      target: { ...target, value: raw },
      currentTarget: { ...target, value: raw },
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as ChangeEvent<HTMLInputElement>;
    onChange(synthetic);
  };

  return (
    <Ui5BaseInput
      type={ui5Type}
      value={value === undefined || value === null ? '' : String(value)}
      onInput={handleInput}
      placeholder={placeholder}
      disabled={disabled}
      readonly={readOnly}
      className={className}
      id={id}
      accessibleName={ariaLabel}
    />
  );
}
