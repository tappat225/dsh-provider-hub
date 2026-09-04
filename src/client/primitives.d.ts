/**
 * Ambient declarations for the DSH renderer seed modules the client bundle
 * imports. The project does not install @deepseek-ai/dsh-client-ui-primitives
 * (the renderer's module system provides it at runtime, seed table
 * `dsh-web-frontend/dist/assets/*`), so tsc needs these shapes. Keep minimal:
 * only the components this page uses.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { FC } from 'react';

  export interface MenuProps {
    anchor: unknown;
    items?: Array<{
      id: string;
      label: unknown;
      icon?: unknown;
      disabled?: boolean;
      danger?: boolean;
      type?: 'separator' | 'label';
    }>;
    selectedId?: string;
    selectedIds?: string[];
    onSelect?: (id: string) => void;
    onClose?: () => void;
    open?: boolean;
    align?: 'start' | 'end';
    side?: 'top' | 'bottom';
    portal?: boolean;
    dense?: boolean;
    compact?: boolean;
    footer?: unknown;
    className?: string;
  }
  export const Menu: FC<MenuProps>;

  /** DSH button (variant/size/icon per the reference dsh-provider-hub usage). */
  export interface ButtonProps {
    variant?: 'primary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    icon?: unknown;
    className?: string;
    onClick?: (event: unknown) => void;
    'aria-label'?: string;
    title?: string;
    children?: unknown;
  }
  export const Button: FC<ButtonProps>;

  /** Small rounded status badge; `active` = tinted/accent state. */
  export const Pill: FC<{ active?: boolean; children?: unknown }>;

  /** Colored status dot: done=green, ongoing=blue, warning=amber, error=red. */
  export const StateDot: FC<{ state?: 'done' | 'error' | 'warning' | 'ongoing'; size?: number }>;

  export interface IconProps {
    size?: number;
    className?: string;
  }
  export const IconChevronDownOutline14: FC<IconProps>;
  export const IconPlusOutline16: FC<IconProps>;
  export const IconRefreshOutline16: FC<IconProps>;
  export const IconTrashOutline16: FC<IconProps>;
  export const IconLoadingOutline16: FC<IconProps>;
}
