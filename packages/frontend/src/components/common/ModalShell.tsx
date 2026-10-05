import { useEffect, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['modal'],
    },
    conflictingClassGroups: {
      'overflow-y': ['overflow'],
    },
  },
});

interface ModalShellProps {
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  onClose?: () => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalShell({
  children,
  panelClassName,
  backdropClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4',
  onClose,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;

    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return !el.closest('[hidden], [aria-hidden="true"]') && style.display !== 'none' && style.visibility !== 'hidden';
    });

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusables[0];
    const lastElement = focusables[focusables.length - 1];

    const activeElement = document.activeElement;
    if (e.shiftKey && (activeElement === firstElement || activeElement === panelRef.current || !focusables.includes(activeElement as HTMLElement))) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && (activeElement === lastElement || activeElement === panelRef.current || !focusables.includes(activeElement as HTMLElement))) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  const defaultPanelClasses =
    'w-full max-w-3xl rounded-xl border border-border bg-surface p-6 text-primary shadow-modal max-h-[85vh] overflow-y-auto';

  const effectivePanelClass = twMerge(
    defaultPanelClasses,
    panelClassName,
    'shadow-modal max-h-[85vh] overflow-y-auto'
  );

  return (
    <div
      className={backdropClassName}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={effectivePanelClass}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
