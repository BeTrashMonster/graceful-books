/**
 * Tests for CharitySelector Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharitySelector } from './CharitySelector';

// Mock the store
vi.mock('../../store/charities', () => ({
  getAllCharities: vi.fn(() =>
    Promise.resolve([
      {
        id: '1',
        name: 'Khan Academy',
        description: 'Free education for all',
        category: 'education',
        website: 'https://khanacademy.org',
        logo: null,
        active: true,
      },
      {
        id: '2',
        name: 'GiveDirectly',
        description: 'Direct cash transfers',
        category: 'POVERTY',
        website: 'https://givedirectly.org',
        logo: null,
        active: true,
      },
      {
        id: '3',
        name: 'The Ocean Cleanup',
        description: 'Cleaning the oceans',
        category: 'environment',
        website: 'https://theoceancleanup.com',
        logo: null,
        active: true,
      },
    ])
  ),
  searchCharities: vi.fn((query: string) => {
    const allCharities = [
      {
        id: '1',
        name: 'Khan Academy',
        description: 'Free education for all',
        category: 'education',
        website: 'https://khanacademy.org',
        logo: null,
        active: true,
      },
    ];
    return Promise.resolve(
      allCharities.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.description.toLowerCase().includes(query.toLowerCase())
      )
    );
  }),
  getCharitiesByFilter: vi.fn(),
}));

describe('CharitySelector Component', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  describe('rendering', () => {
    it('should render loading state initially', () => {
      render(<CharitySelector onSelect={mockOnSelect} />);

      expect(screen.getByText(/loading charities/i)).toBeInTheDocument();
    });

    it('should render charities after loading', async () => {
      render(<CharitySelector onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      expect(screen.getByText('GiveDirectly')).toBeInTheDocument();
      expect(screen.getByText('The Ocean Cleanup')).toBeInTheDocument();
    });

    it('should render header with title and description', async () => {
      render(<CharitySelector onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/choose a charity to support/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/part of your subscription helps others/i)).toBeInTheDocument();
    });

    it('should render search input when showSearch is true', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showSearch />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search charities/i)).toBeInTheDocument();
      });
    });

    it('should not render search input when showSearch is false', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showSearch={false} />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      expect(screen.queryByPlaceholderText(/search charities/i)).not.toBeInTheDocument();
    });

    it('should render category filters when showFilters is true', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showFilters />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /all charities/i })).toBeInTheDocument();
      });
    });

    it('should not render category filters when showFilters is false', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showFilters={false} />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /all charities/i })).not.toBeInTheDocument();
    });
  });

  describe('charity selection', () => {
    it('should call onSelect when a charity is clicked', async () => {
      const user = userEvent.setup();
      render(<CharitySelector onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      const charityCard = screen.getByText('Khan Academy').closest('[role="button"]');
      if (charityCard) {
        await user.click(charityCard);
      }

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          name: 'Khan Academy',
        })
      );
    });

    it('should show selected state for selected charity', async () => {
      render(<CharitySelector selectedCharityId="1" onSelect={mockOnSelect} />);

      await waitFor(() => {
        const charityCard = screen.getByText('Khan Academy').closest('[role="button"]');
        expect(charityCard).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should show confirmation message when charity is selected', async () => {
      render(<CharitySelector selectedCharityId="1" onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/charity selected/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/\$5 from your monthly subscription will support/i)).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should filter charities when searching', async () => {
      const user = userEvent.setup();
      render(<CharitySelector onSelect={mockOnSelect} showSearch />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search charities/i);
      await user.type(searchInput, 'Khan');

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });
    });

    it('should show empty state when no results found', async () => {
      const user = userEvent.setup();
      render(<CharitySelector onSelect={mockOnSelect} showSearch />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search charities/i);
      await user.clear(searchInput);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/no charities found/i)).toBeInTheDocument();
      });
    });

    it('should show clear filters button when no results found', async () => {
      const user = userEvent.setup();
      render(<CharitySelector onSelect={mockOnSelect} showSearch />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search charities/i);
      await user.type(searchInput, 'xyz123');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
      });
    });
  });

  describe('category filtering', () => {
    it('should filter by category when category button is clicked', async () => {
      const user = userEvent.setup();
      render(<CharitySelector onSelect={mockOnSelect} showFilters />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      const educationButton = screen.getByRole('button', { name: /^education$/i });
      await user.click(educationButton);

      expect(educationButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show all charities when "All Charities" is clicked', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showFilters />);

      await waitFor(() => {
        expect(screen.getByText('Khan Academy')).toBeInTheDocument();
      });

      const allButton = screen.getByRole('button', { name: /all charities/i });
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('accessibility', () => {
    it('should have accessible search input', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showSearch />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/search charities/i);
        expect(searchInput).toHaveAttribute('aria-label', 'Search charities');
      });
    });

    it('should have proper button roles for filters', async () => {
      render(<CharitySelector onSelect={mockOnSelect} showFilters />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /all charities/i });
        expect(allButton).toHaveAttribute('aria-pressed');
      });
    });

    it('should announce charity selection status', async () => {
      render(<CharitySelector selectedCharityId="1" onSelect={mockOnSelect} />);

      await waitFor(() => {
        const confirmation = screen.getByText(/charity selected/i).closest('p');
        expect(confirmation?.parentElement).toBeDefined();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty charity list', async () => {
      const { getAllCharities } = await import('../../store/charities');
      vi.mocked(getAllCharities).mockResolvedValueOnce([]);

      render(<CharitySelector onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/no charities found/i)).toBeInTheDocument();
      });
    });

    it('should handle loading error gracefully', async () => {
      const { getAllCharities } = await import('../../store/charities');
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(getAllCharities).mockRejectedValueOnce(new Error('Failed to load'));

      render(<CharitySelector onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to load charities:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });
});
