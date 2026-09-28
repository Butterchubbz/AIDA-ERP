import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Card from './Card';

describe('Card component', () => {
  test('renders children correctly', () => {
    render(<Card><span>Card Content</span></Card>);
    expect(screen.getByText('Card Content')).toBeInTheDocument();
  });

  test('applies default semantic token classes', () => {
    const { container } = render(<Card>Content</Card>);
    const cardElement = container.firstElementChild as HTMLElement;

    expect(cardElement.className).toContain('bg-surface');
    expect(cardElement.className).toContain('rounded-lg');
    expect(cardElement.className).toContain('shadow-card');
    expect(cardElement.className).toContain('text-primary');
    expect(cardElement.className).toContain('p-card');
  });

  test('accepts className override and omits default padding when custom padding is specified', () => {
    const { container } = render(<Card className="p-6 my-custom-class">Content</Card>);
    const cardElement = container.firstElementChild as HTMLElement;

    expect(cardElement.className).toContain('my-custom-class');
    expect(cardElement.className).toContain('p-6');
    expect(cardElement.className).not.toContain('p-card');
  });
});
