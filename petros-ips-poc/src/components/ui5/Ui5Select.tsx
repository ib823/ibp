// ════════════════════════════════════════════════════════════════════════
// Select Adapter — wraps @ui5/webcomponents-react Select to preserve the
// shadcn-style `{ value, onValueChange, options }` API while rendering in
// SAP Fiori Horizon.
//
// Replaces the multi-part shadcn pattern:
//   <Select value onValueChange>
//     <SelectTrigger><SelectValue placeholder/></SelectTrigger>
//     <SelectContent>
//       <SelectItem value="a">A</SelectItem>
//     </SelectContent>
//   </Select>
//
// with a single call:
//   <Select value onValueChange options={[{ value: 'a', label: 'A' }]} />
// ════════════════════════════════════════════════════════════════════════

import { Select as Ui5BaseSelect, Option } from '@ui5/webcomponents-react';
import type { SelectPropTypes } from '@ui5/webcomponents-react';
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: ReactNode;
}

interface AdapterProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  disabled,
  'aria-label': ariaLabel,
}: AdapterProps) {
  const handleChange: SelectPropTypes['onChange'] = (e) => {
    // UI5 fires `detail.selectedOption` as the DOM Option element.
    // Its `value` attribute holds the payload.
    const selectedOption = e.detail.selectedOption as HTMLElement | undefined;
    const next = selectedOption?.getAttribute('value');
    if (onValueChange && next != null) {
      onValueChange(next);
    }
  };

  // UI5 Select has no native placeholder. When no value is selected we
  // prepend an empty Option that displays the placeholder text.
  const showPlaceholder = placeholder != null && (value === undefined || value === '');

  return (
    <Ui5BaseSelect
      onChange={handleChange}
      className={className}
      disabled={disabled}
      accessibleName={ariaLabel}
    >
      {showPlaceholder && (
        <Option value="" selected>
          {placeholder}
        </Option>
      )}
      {options.map((opt) => (
        <Option key={opt.value} value={opt.value} selected={opt.value === value}>
          {opt.label}
        </Option>
      ))}
    </Ui5BaseSelect>
  );
}
