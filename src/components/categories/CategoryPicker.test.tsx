/**
 * CategoryPicker Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CategoryPicker } from './CategoryPicker';
import { CategoryType } from '../../db/schema/categories.schema';
import type { Category } from '../../db/schema/categories.schema';

describe('CategoryPicker', () => {
  const mockCategories: Category[] = [
    {
      id: '1',
      company_id: 'company1',
      name: 'Income',
      type: CategoryType.INCOME,
      parent_id: null,
      description: null,
      color: '#10B981',
      icon: 'trending-up',
      active: true,
      is_system: true,
      sort_order: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { 'device1': 1 },
    },
    {
      id: '2',
      company_id: 'company1',
      name: 'Salary',
      type: CategoryType.INCOME,
      parent_id: '1',
      description: null,
      color: '#10B981',
      icon: 'briefcase',
      active: true,
      is_system: true,
      sort_order: 1,
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted_at: null,
      version_vector: { 'device1': 1 },
    },
  ];

  it('should render with placeholder', () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        companyId="company1"
        value={null}
        onChange={onChange}
        categories={mockCategories}
      />
    );

    expect(screen.getByText('Select a category')).toBeDefined();
  });

  it('should render with selected category', () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        companyId="company1"
        value="1"
        onChange={onChange}
        categories={mockCategories}
      />
    );

    expect(screen.getByText('Income')).toBeDefined();
  });

  it('should display error message', () => {
    const onChange = vi.fn();
    render(
      <CategoryPicker
        companyId="company1"
        value={null}
        onChange={onChange}
        categories={mockCategories}
        error="Category is required"
      />
    );

    expect(screen.getByText('Category is required')).toBeDefined();
  });

  it('should be disabled when disabled prop is true', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CategoryPicker
        companyId="company1"
        value={null}
        onChange={onChange}
        categories={mockCategories}
        disabled={true}
      />
    );

    const picker = container.querySelector('.category-picker');
    expect(picker?.classList.contains('disabled')).toBe(true);
  });
});
