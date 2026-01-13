/**
 * Tests for GlossaryTerm component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlossaryTerm } from './GlossaryTerm';

describe('GlossaryTerm', () => {
  it('should render children text', () => {
    render(
      <GlossaryTerm termId="test-term">
        Test Term
      </GlossaryTerm>
    );
    expect(screen.getByText('Test Term')).toBeInTheDocument();
  });

  it('should render as a button', () => {
    render(
      <GlossaryTerm termId="test-term">
        Test Term
      </GlossaryTerm>
    );
    const button = screen.getByTestId('glossary-term-test-term');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('should call onClick with termId when clicked', () => {
    const onClick = vi.fn();
    render(
      <GlossaryTerm termId="test-term" onClick={onClick}>
        Test Term
      </GlossaryTerm>
    );
    fireEvent.click(screen.getByTestId('glossary-term-test-term'));
    expect(onClick).toHaveBeenCalledWith('test-term');
  });

  it('should not error if onClick not provided', () => {
    render(
      <GlossaryTerm termId="test-term">
        Test Term
      </GlossaryTerm>
    );
    const button = screen.getByTestId('glossary-term-test-term');
    expect(() => fireEvent.click(button)).not.toThrow();
  });

  it('should have proper styling classes', () => {
    render(
      <GlossaryTerm termId="test-term">
        Test Term
      </GlossaryTerm>
    );
    const button = screen.getByTestId('glossary-term-test-term');
    expect(button.className).toContain('text-blue-600');
    expect(button.className).toContain('underline');
    expect(button.className).toContain('cursor-help');
  });

  it('should accept custom className', () => {
    render(
      <GlossaryTerm termId="test-term" className="custom-class">
        Test Term
      </GlossaryTerm>
    );
    const button = screen.getByTestId('glossary-term-test-term');
    expect(button.className).toContain('custom-class');
  });

  it('should have proper accessibility attributes', () => {
    render(
      <GlossaryTerm termId="test-term">
        Test Term
      </GlossaryTerm>
    );
    const button = screen.getByTestId('glossary-term-test-term');
    expect(button).toHaveAttribute('aria-label', 'Learn about Test Term');
  });

  it('should work with different term IDs', () => {
    render(
      <>
        <GlossaryTerm termId="double-entry">Double Entry</GlossaryTerm>
        <GlossaryTerm termId="debit-credit">Debit & Credit</GlossaryTerm>
      </>
    );
    expect(screen.getByTestId('glossary-term-double-entry')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-term-debit-credit')).toBeInTheDocument();
  });

  it('should handle multiple clicks', () => {
    const onClick = vi.fn();
    render(
      <GlossaryTerm termId="test-term" onClick={onClick}>
        Test Term
      </GlossaryTerm>
    );
    const button = screen.getByTestId('glossary-term-test-term');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('should render complex children', () => {
    render(
      <GlossaryTerm termId="test-term">
        <span>Complex</span> <strong>Children</strong>
      </GlossaryTerm>
    );
    expect(screen.getByText('Complex')).toBeInTheDocument();
    expect(screen.getByText('Children')).toBeInTheDocument();
  });
});
