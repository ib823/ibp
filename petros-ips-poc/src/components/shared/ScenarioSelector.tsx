import { Select } from '@/components/ui5/Ui5Select';
import { useProjectStore } from '@/store/project-store';
import type { ScenarioVersion } from '@/engine/types';

const SCENARIOS = [
  { value: 'base', label: 'Base Case' },
  { value: 'high', label: 'High Case' },
  { value: 'low', label: 'Low Case' },
  { value: 'stress', label: 'Stress Test' },
];

export function ScenarioSelector() {
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const setActiveScenario = useProjectStore((s) => s.setActiveScenario);

  return (
    <Select
      value={activeScenario}
      onValueChange={(v) => setActiveScenario(v as ScenarioVersion)}
      options={SCENARIOS}
      className="w-[112px] sm:w-[140px]"
      aria-label="Price scenario"
    />
  );
}
