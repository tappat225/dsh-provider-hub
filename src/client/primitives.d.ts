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
  export const IconChevronDownOutline14: FC<{ size?: number; className?: string }>;
}
