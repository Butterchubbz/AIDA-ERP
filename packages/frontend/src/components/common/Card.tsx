import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
}

/**
 * Standard Card component based on semantic design tokens:
 * - background: surface (slate-800)
 * - border-radius: rounded-lg
 * - padding: card padding (p-card / 1rem / p-4)
 * - shadow: card shadow (shadow-card / shadow-lg)
 * - text: text-primary (slate-100)
 *
 * Accepts className overrides for layout, sizing, or bespoke styling.
 */
export default function Card({ children, className = '', ...rest }: CardProps) {
  const hasPaddingOverride = /\bp(?:[xytrbl])?-\w+/.test(className);
  const paddingClass = hasPaddingOverride ? '' : 'p-card';

  return (
    <div
      className={`bg-surface rounded-lg shadow-card text-primary ${paddingClass} ${className}`.trim().replace(/\s+/g, ' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
