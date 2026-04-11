import { SegmentedButton, SegmentedButtonItem } from '@ui5/webcomponents-react';
import type { SegmentedButtonPropTypes } from '@ui5/webcomponents-react';
import type { TimeGranularity } from '@/engine/types';

interface GranularityToggleProps {
  value: TimeGranularity;
  onChange: (g: TimeGranularity) => void;
  className?: string;
}

/**
 * Three-way segmented control (Monthly / Quarterly / Yearly) wrapping UI5
 * SegmentedButton to render SAP Fiori Horizon styling.
 */
export function GranularityToggle({ value, onChange, className }: GranularityToggleProps) {
  const handleSelectionChange: SegmentedButtonPropTypes['onSelectionChange'] = (e) => {
    const selected = e.detail.selectedItems?.[0] as HTMLElement | undefined;
    const key = selected?.getAttribute('data-key') as TimeGranularity | null;
    if (key) onChange(key);
  };

  return (
    <SegmentedButton
      accessibleName="Time granularity"
      className={className}
      onSelectionChange={handleSelectionChange}
    >
      <SegmentedButtonItem data-key="monthly" selected={value === 'monthly'}>
        Monthly
      </SegmentedButtonItem>
      <SegmentedButtonItem
        data-key="quarterly"
        selected={value === 'quarterly'}
        tooltip="Quarterly"
      >
        Qtr
      </SegmentedButtonItem>
      <SegmentedButtonItem data-key="yearly" selected={value === 'yearly'}>
        Yearly
      </SegmentedButtonItem>
    </SegmentedButton>
  );
}
