import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { useState } from 'react';
import ModalShell from './ModalShell';

describe('ModalShell', () => {
  test('renders children and applies modal token classes and max-h-[85vh] overflow-y-auto', () => {
    render(
      <ModalShell panelClassName="shadow-xl max-h-[90vh] overflow-hidden">
        <div>Modal Content</div>
      </ModalShell>
    );

    const dialog = screen.getByRole('dialog');
    const panel = dialog.firstElementChild as HTMLElement;

    expect(screen.getByText('Modal Content')).toBeInTheDocument();
    expect(panel.className).toContain('shadow-modal');
    expect(panel.className).toContain('border-border');
    expect(panel.className).toContain('bg-surface');
    expect(panel.className).toContain('max-h-[85vh]');
    expect(panel.className).toContain('overflow-y-auto');
    expect(panel.className).toContain('shadow-modal');
    expect(panel.className).not.toContain('shadow-xl');
    expect(panel.className).not.toContain('max-h-[90vh]');
    expect(panel.className).not.toContain('overflow-hidden');
  });

  test('locks body scroll while open and restores on unmount', () => {
    document.body.style.overflow = 'auto';

    const { unmount } = render(
      <ModalShell>
        <div>Modal Content</div>
      </ModalShell>
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
  });

  test('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <ModalShell onClose={handleClose}>
        <div>Modal Content</div>
      </ModalShell>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when backdrop is clicked, but not when panel is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ModalShell onClose={handleClose}>
        <div data-testid="panel-content">Modal Content</div>
      </ModalShell>
    );

    // Clicking inside panel does not close
    fireEvent.click(screen.getByTestId('panel-content'));
    expect(handleClose).not.toHaveBeenCalled();

    // Clicking backdrop closes
    fireEvent.click(screen.getByRole('dialog'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('returns focus to trigger element on close', () => {
    function TestComponent() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button data-testid="trigger-btn" onClick={() => setOpen(true)}>
            Open Modal
          </button>
          {open && (
            <ModalShell onClose={() => setOpen(false)}>
              <button data-testid="inside-btn">Inside</button>
            </ModalShell>
          )}
        </div>
      );
    }

    render(<TestComponent />);
    const triggerBtn = screen.getByTestId('trigger-btn');
    triggerBtn.focus();
    expect(document.activeElement).toBe(triggerBtn);

    fireEvent.click(triggerBtn);
    expect(document.activeElement).toBe(screen.getByRole('dialog').firstElementChild);

    // Close modal via Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(triggerBtn);
  });

  test('focus trap cycles Tab navigation inside modal', () => {
    render(
      <ModalShell>
        <button data-testid="first-btn">First</button>
        <button data-testid="second-btn">Second</button>
      </ModalShell>
    );

    const firstBtn = screen.getByTestId('first-btn');
    const secondBtn = screen.getByTestId('second-btn');

    // Tab from the panel enters the focus trap at its first control.
    const dialog = screen.getByRole('dialog');
    const panel = dialog.firstElementChild as HTMLElement;

    expect(document.activeElement).toBe(panel);
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstBtn);

    secondBtn.focus();
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstBtn);

    // Shift+Tab from first element cycles to last element
    fireEvent.keyDown(panel, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(secondBtn);
  });
});
