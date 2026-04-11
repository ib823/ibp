import { getEntry } from '@/lib/educational-content';
import type { EducationalEntry } from '@/lib/educational-content';
import { cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';

interface EduTooltipProps {
  /** The element ID (e.g., "D-01", "E-17") OR a pre-resolved entry */
  entryId?: string;
  entry?: EducationalEntry;
  children: ReactNode;
  /** Override tooltip text (optional) */
  text?: string;
}

/**
 * Educational tooltip wrapper.
 *
 * UI5 web components don't ship a dedicated Tooltip component. Rather than
 * using <Popover> with manual hover handlers (which has timing issues and
 * fails on mobile), we attach the tooltip text as a native `title`
 * attribute on the child element. This works on every browser, supports
 * long-press on mobile, and requires zero runtime.
 *
 * If the child is a React element we clone it with a `title` prop. If it
 * is a fragment, text, or multiple children, we wrap in a <span>.
 */
export function EduTooltip({ entryId, entry: entryProp, children, text }: EduTooltipProps) {
  const entry = entryProp ?? (entryId ? getEntry(entryId) : undefined);
  const tooltipText = text ?? entry?.tooltip;

  if (!tooltipText) return <>{children}</>;

  // Prefer attaching the title to the existing element (no extra DOM node)
  if (isValidElement(children)) {
    const element = children as ReactElement<{ title?: string }>;
    // Don't overwrite an existing title
    if (element.props?.title) return <>{children}</>;
    return cloneElement(element, { title: tooltipText });
  }

  // Fallback: wrap in a span so the browser can render the title
  return <span title={tooltipText}>{children}</span>;
}
