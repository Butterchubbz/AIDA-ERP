import { useEffect, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';

interface ModalShellProps {
  children: ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
  onClose?: () => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  // 1. Lock body scroll while open & save previous active element
  useEffect(() => {
    previousActiveElementRef.current = (document.activeElement as HTMLElement) || null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first focusable element inside the modal or the panel itself
    if (panelRef.current) {
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panelRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      previousActiveElementRef.current?.focus?.();
    };
  }, []);

  // 2. Esc-to-close handler
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

  // 3. Focus trap (Tab cycles inside)
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;

    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && el.style.display !== 'none');

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const firstElement = focusables[0];
    const lastElement = focusables[focusables.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement || document.activeElement === panelRef.current) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  const defaultPanelClasses =
    'w-full max-w-3xl rounded-xl border border-border bg-surface p-6 text-primary shadow-modal max-h-[85vh] overflow-y-auto';

  const effectivePanelClass = panelClassName
    ? `${panelClassName} ${!panelClassName.includes('max-h-') ? 'max-h-[85vh]' : ''} ${!panelClassName.includes('overflow-') ? 'overflow-y-auto' : ''}`
        .trim()
        .replace(/\s+/g, ' ')
    : defaultPanelClasses;

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
