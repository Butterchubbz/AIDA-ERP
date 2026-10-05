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

  test('renders defaults without className and merges caller classes last', () => {
    render(
      <>
        <Card>Default card</Card>
        <Card className="bg-rose-500 p-6">Customized card</Card>
      </>
    );

    const defaultCard = screen.getByText('Default card') as HTMLElement;
    const customizedCard = screen.getByText('Customized card') as HTMLElement;

    expect(defaultCard.className).toContain('bg-surface');
    expect(defaultCard.className).toContain('p-card');
    expect(customizedCard.className).toContain('bg-rose-500');
    expect(customizedCard.className).toContain('p-6');
    expect(customizedCard.className).not.toContain('bg-surface');
    expect(customizedCard.className).not.toContain('p-card');
  });
});
