import type { HierarchyAggregation } from '@/engine/types';

interface HierarchyBarProps {
  aggregation: HierarchyAggregation;
}

const SECTOR_COLORS: Record<string, string> = {
  Upstream: '#1E3A5F',
  'Downstream & Infrastructure': '#D4A843',
  CCS: '#2D8A4E',
};

export function HierarchyBar({ aggregation }: HierarchyBarProps) {
  const totalNpv = aggregation.npv as number;
  if (totalNpv === 0) return null;

  return (
    <div className="space-y-3">
      {/* Root bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-text-primary">{aggregation.key}</span>
          <span className="text-xs font-data font-medium">${(totalNpv / 1e6).toFixed(1)}M</span>
        </div>
        <div className="h-6 bg-content-alt flex overflow-hidden">
          {aggregation.children.map((sector) => {
            const sectorNpv = sector.npv as number;
            const pct = totalNpv !== 0 ? Math.max(0, (sectorNpv / totalNpv) * 100) : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={sector.key}
                className="h-full flex items-center justify-center text-[9px] text-white font-medium"
                style={{
                  width: `${pct}%`,
                  backgroundColor: SECTOR_COLORS[sector.key] ?? '#6B7280',
                }}
                title={`${sector.key}: $${(sectorNpv / 1e6).toFixed(1)}M`}
              >
                {pct > 15 ? sector.key : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sector breakdown */}
      {aggregation.children.map((sector) => {
        const sectorNpv = sector.npv as number;
        if (sectorNpv === 0 && sector.children.length === 0) return null;
        const color = SECTOR_COLORS[sector.key] ?? '#6B7280';

        return (
          <div key={sector.key} className="pl-4 border-l-2" style={{ borderColor: color }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-text-secondary">{sector.key}</span>
              <span className="text-[11px] font-data">${(sectorNpv / 1e6).toFixed(1)}M</span>
            </div>
            {sector.children.map((type) => (
              <div key={type.key} className="pl-3 space-y-0.5">
                {type.children.map((proj) => {
                  const projNpv = proj.npv as number;
                  const barPct = totalNpv !== 0
                    ? Math.max(0, Math.min(100, (Math.abs(projNpv) / Math.abs(totalNpv)) * 100))
                    : 0;
                  return (
                    <div key={proj.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary w-[140px] truncate">
                        {proj.key}
                      </span>
                      <div className="flex-1 h-3 bg-content-alt">
                        <div
                          className="h-full"
                          style={{
                            width: `${barPct}%`,
                            backgroundColor: projNpv >= 0 ? color : '#C0392B',
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-data w-[60px] text-right">
                        ${(projNpv / 1e6).toFixed(0)}M
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
