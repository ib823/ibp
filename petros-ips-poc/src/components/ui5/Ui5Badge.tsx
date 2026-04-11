// ════════════════════════════════════════════════════════════════════════
// Badge Adapter — wraps @ui5/webcomponents-react Tag to preserve the
// shadcn/ui Badge call-site API while rendering with SAP Fiori Horizon
// colour schemes.
// ════════════════════════════════════════════════════════════════════════

import { Tag } from '@ui5/webcomponents-react';
import type { TagPropTypes } from '@ui5/webcomponents-react';
import type { ReactNode } from 'react';

type Variant = 'default' | 'secondary' | 'outline' | 'destructive';

// UI5 Tag colorScheme accepts numeric strings 1-10 mapping to predefined
// SAP Horizon palette tones. We use a modest subset that maps semantically
// to the shadcn variants we currently use.
const COLOR_SCHEME_MAP: Record<Variant, TagPropTypes['colorScheme']> = {
  default: '6',     // blue
  secondary: '8',   // gray
  outline: '10',    // neutral border
  destructive: '2', // red
};

interface AdapterProps {
  variant?: Variant;
  className?: string;
  children?: ReactNode;
  title?: string;
}

export function Badge({ variant = 'default', className, children, title }: AdapterProps) {
  return (
    <Tag
      colorScheme={COLOR_SCHEME_MAP[variant] ?? '6'}
      design="Set2"
      className={className}
      title={title}
    >
      {children}
    </Tag>
  );
}
