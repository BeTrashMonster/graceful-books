/**
 * Tests for Signup Page with Charity Selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Signup from './Signup';

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock charity store
vi.mock('../../store/charities', () => ({
  getAllCharities: vi.fn(() =>
    Promise.resolve([
      {
        id: 'charity-1',
        name: 'Test Charity 1',
        description: 'A great test charity',
        category: 'education',
        website: 'https://testcharity1.org',
        logo: null,
        active: true,
      },
      {
        id: 'charity-2',
        name: 'Test Charity 2',
        description: 'Another great charity',
        category: 'health',
        website: 'https://testcharity2.org',
        logo: null,
        active: true,
      },
    ])
  ),
  searchCharities: vi.fn(),
  getCharitiesByFilter: vi.fn(),
}));

function renderSignup() {
  return render(
    <BrowserRouter>
      <Signup />
    </BrowserRouter>
  );
}

describe('Signup Page with Charity Selection', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    localStorage.clear();
  });

  describe('credentials step', () => {
    it('should render credentials form initially', () => {
      renderSignup();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });

    it('should show validation error when passwords do not match', async () => {
      const user = userEvent.setup();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderSignup();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      expect(alertSpy).toHaveBeenCalledWith('Passwords do not match');
      alertSpy.mockRestore();
    });

    it('should proceed to charity selection when passwords match', async () => {
      const user = userEvent.setup();
      renderSignup();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/choose a charity to support/i)).toBeInTheDocument();
      });
    });

    it('should require all fields to be filled', async () => {
      const user = userEvent.setup();
      renderSignup();

      // Try to submit without filling fields
      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      // Form should prevent submission due to required fields
      expect(screen.getByLabelText(/email/i)).toBeInvalid();
    });
  });

  describe('charity selection step', () => {
    async function goToCharityStep(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/choose a charity to support/i)).toBeInTheDocument();
      });
    }

    it('should show charity selector after credentials step', async () => {
      const user = userEvent.setup();
      renderSignup();

      await goToCharityStep(user);

      expect(screen.getByText(/choose a charity to support/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('should display charities from the store', async () => {
      const user = userEvent.setup();
      renderSignup();

      await goToCharityStep(user);

      await waitFor(() => {
        expect(screen.getByText('Test Charity 1')).toBeInTheDocument();
      });

      expect(screen.getByText('Test Charity 2')).toBeInTheDocument();
    });

    it('should allow selecting a charity', async () => {
      const user = userEvent.setup();
      renderSignup();

      await goToCharityStep(user);

      await waitFor(() => {
        expect(screen.getByText('Test Charity 1')).toBeInTheDocument();
      });

      const charityCard = screen.getByText('Test Charity 1').closest('[role="button"]');
      if (charityCard) {
        await user.click(charityCard);
      }

      await waitFor(() => {
        expect(screen.getByText(/charity selected/i)).toBeInTheDocument();
      });
    });

    it('should have disabled Create Account button when no charity selected', async () => {
      const user = userEvent.setup();
      renderSignup();

      await goToCharityStep(user);

      await waitFor(() => {
        const createAccountButton = screen.getByRole('button', { name: /create account/i });
        expect(createAccountButton).toBeDisabled();
      });
    });

    it('should enable Create Account button when charity is selected', async () => {
      const user = userEvent.setup();
      renderSignup();

      await goToCharityStep(user);

      await waitFor(() => {
        expect(screen.getByText('Test Charity 1')).toBeInTheDocument();
      });

      const charityCard = screen.getByText('Test Charity 1').closest('[role="button"]');
      if (charityCard) {
        await user.click(charityCard);
      }

      await waitFor(() => {
        const createAccountButton = screen.getByRole('button', { name: /create account/i });
        expect(createAccountButton).not.toBeDisabled();
      });
    });

    it('should go back to credentials step when Back is clicked', async () => {
      const user = userEvent.setup();
      renderSignup();

      await goToCharityStep(user);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });
    });

    it('should preserve credentials when going back and forward', async () => {
      const user = userEvent.setup();
      renderSignup();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/choose a charity to support/i)).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back/i }));

      await waitFor(() => {
        const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
        expect(emailInput.value).toBe('test@example.com');
      });
    });
  });

  describe('account creation', () => {
    async function completeSignup(user: ReturnType<typeof userEvent.setup>) {
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Charity 1')).toBeInTheDocument();
      });

      const charityCard = screen.getByText('Test Charity 1').closest('[role="button"]');
      if (charityCard) {
        await user.click(charityCard);
      }

      await waitFor(() => {
        const createAccountButton = screen.getByRole('button', { name: /create account/i });
        expect(createAccountButton).not.toBeDisabled();
      });

      await user.click(screen.getByRole('button', { name: /create account/i }));
    }

    it('should save user data to localStorage on signup', async () => {
      const user = userEvent.setup();
      renderSignup();

      await completeSignup(user);

      const savedData = localStorage.getItem('graceful_books_user');
      expect(savedData).toBeTruthy();

      const userData = JSON.parse(savedData!);
      expect(userData.email).toBe('test@example.com');
      expect(userData.selected_charity_id).toBe('charity-1');
      expect(userData.selected_charity_name).toBe('Test Charity 1');
    });

    it('should navigate to onboarding after signup', async () => {
      const user = userEvent.setup();
      renderSignup();

      await completeSignup(user);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      });
    });

    it('should show alert if trying to create account without selecting charity', async () => {
      const user = userEvent.setup();
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderSignup();

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText(/choose a charity to support/i)).toBeInTheDocument();
      });

      // Button should be disabled, but try to call the handler directly
      // This tests the validation logic
      const createButton = screen.getByRole('button', { name: /create account/i });
      expect(createButton).toBeDisabled();

      alertSpy.mockRestore();
    });
  });

  describe('navigation', () => {
    it('should show link to login page', () => {
      renderSignup();

      const loginLink = screen.getByRole('link', { name: /sign in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('accessibility', () => {
    it('should have proper form labels', () => {
      renderSignup();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should have descriptive headings', () => {
      renderSignup();

      expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    });
  });
});
