import type { OrgHierarchy } from '@/engine/types';

// ── 4-Level Organisational Hierarchy ──────────────────────────────────
//
// Level 1: PETROS Group
//   Level 2: Upstream
//     Level 3: Operated
//       Level 4: SK-410 Gas Development
//       Level 4: SK-612 Deepwater Exploration
//       Level 4: Balingian Shallow Water
//       Level 4: Tukau Marginal
//     Level 3: Non-Operated
//       (no projects in POC)
//   Level 2: Downstream & Infrastructure
//     Level 3: Operated
//       (no projects in POC)
//   Level 2: CCS
//     Level 3: Operated
//       Level 4: M3 CCS Storage

export const PROJECT_HIERARCHY: readonly OrgHierarchy[] = [
  {
    businessEntity: 'PETROS Group',
    businessSector: 'Upstream',
    businessType: 'Operated',
    projectName: 'SK-410 Gas Development',
  },
  {
    businessEntity: 'PETROS Group',
    businessSector: 'Upstream',
    businessType: 'Operated',
    projectName: 'SK-612 Deepwater Exploration',
  },
  {
    businessEntity: 'PETROS Group',
    businessSector: 'Upstream',
    businessType: 'Operated',
    projectName: 'Balingian Shallow Water',
  },
  {
    businessEntity: 'PETROS Group',
    businessSector: 'Upstream',
    businessType: 'Operated',
    projectName: 'Tukau Marginal',
  },
  {
    businessEntity: 'PETROS Group',
    businessSector: 'CCS',
    businessType: 'Operated',
    projectName: 'M3 CCS Storage',
  },
];

// ── Hierarchy tree structure for navigation ───────────────────────────

export interface HierarchyNode {
  readonly label: string;
  readonly level: 'entity' | 'sector' | 'type' | 'project';
  readonly children: readonly HierarchyNode[];
  readonly projectId?: string;
}

export const HIERARCHY_TREE: HierarchyNode = {
  label: 'PETROS Group',
  level: 'entity',
  children: [
    {
      label: 'Upstream',
      level: 'sector',
      children: [
        {
          label: 'Operated',
          level: 'type',
          children: [
            { label: 'SK-410 Gas Development', level: 'project', children: [], projectId: 'sk-410' },
            { label: 'SK-612 Deepwater Exploration', level: 'project', children: [], projectId: 'sk-612' },
            { label: 'Balingian Shallow Water', level: 'project', children: [], projectId: 'balingian' },
            { label: 'Tukau Marginal', level: 'project', children: [], projectId: 'tukau' },
          ],
        },
        {
          label: 'Non-Operated',
          level: 'type',
          children: [],
        },
      ],
    },
    {
      label: 'Downstream & Infrastructure',
      level: 'sector',
      children: [
        {
          label: 'Operated',
          level: 'type',
          children: [],
        },
      ],
    },
    {
      label: 'CCS',
      level: 'sector',
      children: [
        {
          label: 'Operated',
          level: 'type',
          children: [
            { label: 'M3 CCS Storage', level: 'project', children: [], projectId: 'm3-ccs' },
          ],
        },
      ],
    },
  ],
};
