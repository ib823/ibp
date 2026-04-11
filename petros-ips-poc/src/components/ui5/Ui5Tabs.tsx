// ════════════════════════════════════════════════════════════════════════
// Tabs Adapter — wraps @ui5/webcomponents-react TabContainer/Tab with a
// shadcn-style props-driven API and LAZY content rendering.
//
//   <Tabs
//     activeTab="economics"            // optional controlled mode
//     defaultTab="economics"           // optional initial uncontrolled
//     onTabChange={setActiveTab}
//     tabs={[
//       { key: 'economics', label: 'Economics', icon: 'simulate', content: <X/> },
//       { key: 'phases',    label: 'Phases',    icon: 'org-chart', content: <Y/> },
//     ]}
//   />
//
// CRITICAL: Only the ACTIVE tab's `content` is rendered. Inactive tabs
// receive `null` children. This prevents heavy children (Recharts trees,
// analytical tables, comparison engines) from mounting and running their
// hooks while they're not visible — which was causing the Versions tab
// on the Economics page to freeze the browser when first clicked.
// ════════════════════════════════════════════════════════════════════════

import { TabContainer, Tab } from '@ui5/webcomponents-react';
import type { TabContainerPropTypes } from '@ui5/webcomponents-react';
import { useState, type ReactNode } from 'react';

export interface TabDef {
  key: string;
  label: string;
  icon?: string;
  content: ReactNode;
  'data-tour'?: string;
}

interface AdapterProps {
  tabs: TabDef[];
  /** Controlled selected key. If omitted, the adapter manages its own state. */
  activeTab?: string;
  /** Uncontrolled initial key. Ignored if `activeTab` is provided. */
  defaultTab?: string;
  onTabChange?: (key: string) => void;
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  defaultTab,
  onTabChange,
  className,
}: AdapterProps) {
  // Internal state for uncontrolled usage. We initialize once from
  // defaultTab (or the first tab's key).
  const [internalKey, setInternalKey] = useState<string>(
    () => activeTab ?? defaultTab ?? tabs[0]?.key ?? '',
  );

  // When the parent passes `activeTab` we use it directly (controlled mode).
  const currentKey = activeTab ?? internalKey;

  const handleTabSelect: TabContainerPropTypes['onTabSelect'] = (e) => {
    const target = e.detail.tab as HTMLElement | undefined;
    const key = target?.getAttribute('data-key');
    if (!key) return;
    // Update internal state so uncontrolled usage still re-renders
    setInternalKey(key);
    onTabChange?.(key);
  };

  return (
    <TabContainer onTabSelect={handleTabSelect} className={className}>
      {tabs.map((tab) => {
        const isActive = tab.key === currentKey;
        return (
          <Tab
            key={tab.key}
            data-key={tab.key}
            text={tab.label}
            icon={tab.icon}
            selected={isActive}
            data-tour={tab['data-tour']}
          >
            {/*
              Lazy render: only the active tab's content is instantiated.
              Switching tabs unmounts the previous content and mounts the
              new one, so each view's hooks run cleanly when it becomes
              visible — no more simultaneous mounting of all 3 tabs.
            */}
            {isActive ? tab.content : null}
          </Tab>
        );
      })}
    </TabContainer>
  );
}
