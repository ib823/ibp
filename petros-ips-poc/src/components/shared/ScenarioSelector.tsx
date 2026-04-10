import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectStore } from '@/store/project-store';
import type { ScenarioVersion } from '@/engine/types';

const SCENARIOS: { value: ScenarioVersion; label: string }[] = [
  { value: 'base', label: 'Base Case' },
  { value: 'high', label: 'High Case' },
  { value: 'low', label: 'Low Case' },
  { value: 'stress', label: 'Stress Test' },
];

export function ScenarioSelector() {
  const activeScenario = useProjectStore((s) => s.activeScenario);
  const setActiveScenario = useProjectStore((s) => s.setActiveScenario);

  return (
    <Select value={activeScenario} onValueChange={(v) => setActiveScenario(v as ScenarioVersion)}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCENARIOS.map((s) => (
          <SelectItem key={s.value} value={s.value} className="text-xs">
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
