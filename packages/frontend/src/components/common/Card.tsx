import type { HTMLAttributes, ReactNode } from 'react';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['card'],
    },
  },
});

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
  return (
    <div
      className={twMerge('bg-surface rounded-lg p-card shadow-card border border-border text-primary', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
