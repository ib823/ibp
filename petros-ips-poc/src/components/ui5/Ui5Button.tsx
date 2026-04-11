// ════════════════════════════════════════════════════════════════════════
// Button Adapter — wraps @ui5/webcomponents-react Button to preserve the
// shadcn/ui Button call-site API while rendering with SAP Fiori Horizon.
//
// IMPORTANT: Every prop passed to <Ui5BaseButton> is listed explicitly.
// UI5 web components reject unknown HTML attributes at runtime, so we
// never spread `...rest` onto the element.
// ════════════════════════════════════════════════════════════════════════

import { Button as Ui5BaseButton } from '@ui5/webcomponents-react';
import type { ButtonPropTypes } from '@ui5/webcomponents-react';
import type { ReactNode, MouseEvent } from 'react';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
type Size = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

const DESIGN_MAP: Record<Variant, ButtonPropTypes['design']> = {
  default: 'Emphasized',
  secondary: 'Default',
  outline: 'Default',
  ghost: 'Transparent',
  destructive: 'Negative',
  link: 'Transparent',
};

interface AdapterProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  disabled?: boolean;
  onClick?: (e?: MouseEvent<HTMLElement>) => void;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  /**
   * Optional SAP icon name (e.g. "refresh", "download", "simulate", "add").
   * Preferred over passing a Lucide icon as a child — UI5 renders the icon
   * inside its Shadow DOM with native flexbox alignment.
   */
  icon?: string;
  'aria-label'?: string;
  'data-tour'?: string;
}

export function Button({
  variant = 'default',
  size,
  className,
  children,
  disabled,
  onClick,
  title,
  icon,
  'aria-label': ariaLabel,
  'data-tour': dataTour,
}: AdapterProps) {
  // UI5 has no "size" prop. Layout sizing is achieved via Tailwind classes
  // on the outer custom-element wrapper.
  const sizeClass =
    size === 'sm' ? 'h-8 text-xs' :
    size === 'xs' ? 'h-6 text-[10px]' :
    size === 'lg' ? 'h-10' :
    size?.startsWith('icon') ? 'min-w-[36px] min-h-[36px]' :
    '';

  return (
    <Ui5BaseButton
      design={DESIGN_MAP[variant] ?? 'Default'}
      disabled={disabled}
      onClick={onClick as ButtonPropTypes['onClick']}
      className={[sizeClass, className].filter(Boolean).join(' ')}
      accessibleName={ariaLabel}
      tooltip={title}
      icon={icon}
      data-tour={dataTour}
    >
      {children}
    </Ui5BaseButton>
  );
}
