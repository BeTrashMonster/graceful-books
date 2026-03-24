import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CharitySelector } from '../../components/charity';
import type { Charity } from '../../types/database.types';
import { signup } from '../../services/auth.api';
import { getProducts, type Product } from '../../services/products.api';

type SignupStep = 'credentials' | 'charity' | 'product';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<SignupStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [upgradeToBookkeeping, setUpgradeToBookkeeping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load products on mount
  useEffect(() => {
    getProducts()
      .then((prods) => {
        setProducts(prods);

        // Pre-select product from URL query param
        const productSlug = searchParams.get('product');
        if (productSlug) {
          const product = prods.find(p => p.slug === productSlug);
          if (product) {
            setSelectedProduct(product);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
      });
  }, [searchParams]);

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Move to charity selection step
    setStep('charity');
  };

  const handleCharitySelect = (charity: Charity) => {
    setSelectedCharity(charity);
  };

  const handleCharityContinue = () => {
    if (!selectedCharity) {
      setError('Please select a charity to support');
      return;
    }
    setStep('product');
  };

  const handleCompleteSignup = async () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call backend API to create account
      const response = await signup({
        email,
        password,
        firstName,
        lastName,
        companyName: companyName || undefined,
        charityId: selectedCharity?.id,
      });

      // Store session data in sessionStorage
      sessionStorage.setItem(
        'graceful_books_session',
        JSON.stringify({
          token: response.token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          userEmail: response.user.email,
          userId: response.user.id,
        })
      );

      // Store user info with selected product for checkout
      localStorage.setItem(
        'graceful_books_user',
        JSON.stringify({
          userIdentifier: response.user.email,
          supportKey: response.user.supportKey,
          charityId: selectedCharity?.id,
          charityName: selectedCharity?.name,
          selectedProduct: selectedProduct.slug,
          upgradeToBookkeeping,
        })
      );

      // Determine which product to purchase
      // If user selected upgrade to bookkeeping, use bookkeeping product
      // Otherwise, use the selected product
      let productToPurchase = selectedProduct;
      if (upgradeToBookkeeping) {
        const bookkeepingProduct = products.find(p => p.slug === 'bookkeeping-suite');
        if (bookkeepingProduct) {
          productToPurchase = bookkeepingProduct;

          // Update localStorage to reflect the upgraded product
          localStorage.setItem(
            'graceful_books_user',
            JSON.stringify({
              userIdentifier: response.user.email,
              supportKey: response.user.supportKey,
              charityId: selectedCharity?.id,
              charityName: selectedCharity?.name,
              selectedProduct: bookkeepingProduct.slug,
              upgradeToBookkeeping: true,
            })
          );
        }
      }

      // Create Stripe checkout session and redirect
      try {
        const { createCheckoutSession } = await import('../../services/checkout.api');
        const checkoutSession = await createCheckoutSession(productToPurchase.id);

        // Redirect to Stripe checkout
        window.location.href = checkoutSession.url;
      } catch (checkoutError: any) {
        console.error('Checkout error:', checkoutError);
        throw checkoutError; // Re-throw to outer catch
      }
    } catch (err: any) {
      console.error('Signup error:', err);

      setError(
        err.message || 'Something unexpected happened. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('credentials');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-background, #f9fafb)',
        padding: '1rem',
      }}
    >
      {step === 'credentials' && (
        <div
          style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'var(--color-surface, #ffffff)',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Create Your Account
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary, #6b7280)',
                fontSize: '0.875rem',
              }}
            >
              Start your journey with Graceful Books
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-error-light, #fef2f2)',
                border: '1px solid var(--color-error, #dc2626)',
                color: 'var(--color-error-dark, #991b1b)',
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="firstName"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  htmlFor="lastName"
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="companyName"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Company Name (Optional)
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-primary, #3b82f6)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Continue
            </button>
          </form>

          <div
            style={{
              marginTop: '1.5rem',
              textAlign: 'center',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
              Already have an account?{' '}
            </span>
            <Link
              to="/login"
              style={{
                color: 'var(--color-primary, #3b82f6)',
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      {step === 'charity' && (
        <div
          style={{
            width: '100%',
            maxWidth: '1200px',
            backgroundColor: 'var(--color-surface, #ffffff)',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <CharitySelector
            selectedCharityId={selectedCharity?.id}
            onSelect={handleCharitySelect}
            showSearch
            showFilters
          />

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '2rem',
              justifyContent: 'space-between',
            }}
          >
            <button
              onClick={handleBack}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary, #6b7280)',
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              onClick={handleCharityContinue}
              disabled={!selectedCharity}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor:
                  selectedCharity
                    ? 'var(--color-primary, #3b82f6)'
                    : 'var(--color-border, #e5e7eb)',
                color:
                  selectedCharity
                    ? 'white'
                    : 'var(--color-text-secondary, #6b7280)',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor:
                  selectedCharity ? 'pointer' : 'not-allowed',
              }}
            >
              Continue to Product Selection
            </button>
          </div>
        </div>
      )}

      {step === 'product' && (
        <div
          style={{
            width: '100%',
            maxWidth: '800px',
            backgroundColor: 'var(--color-surface, #ffffff)',
            padding: '2rem',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Choose Your Product
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary, #6b7280)',
                fontSize: '0.875rem',
              }}
            >
              {selectedProduct
                ? `You've selected ${selectedProduct.name}. Want to upgrade?`
                : 'Select the product that fits your needs'}
            </p>
          </div>

          {error && (
            <div
              style={{
                backgroundColor: 'var(--color-error-light, #fef2f2)',
                border: '1px solid var(--color-error, #dc2626)',
                color: 'var(--color-error-dark, #991b1b)',
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                marginBottom: '1.5rem',
                fontSize: '0.875rem',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Selected/Pre-selected Product */}
          {selectedProduct && (
            <div
              style={{
                border: '2px solid var(--color-primary, #3b82f6)',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                backgroundColor: 'var(--color-primary-light, #eff6ff)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {selectedProduct.name}
                  </h3>
                  <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {selectedProduct.description}
                  </p>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary, #3b82f6)' }}>
                    ${selectedProduct.price_usd.toFixed(2)}
                    <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>
                      /{selectedProduct.billing_cycle === 'monthly' ? 'month' : 'product'}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--color-primary, #3b82f6)',
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  SELECTED
                </div>
              </div>
            </div>
          )}

          {/* Bookkeeping Suite Upgrade Option */}
          {selectedProduct && selectedProduct.slug !== 'bookkeeping-suite' && selectedProduct.slug !== 'fractional-cfo' && (
            <div
              style={{
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '0.5rem',
                padding: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                <input
                  type="checkbox"
                  id="upgrade-bookkeeping"
                  checked={upgradeToBookkeeping}
                  onChange={(e) => setUpgradeToBookkeeping(e.target.checked)}
                  style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    marginTop: '0.25rem',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor="upgrade-bookkeeping"
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'block',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Upgrade to Bookkeeping Suite
                  </label>
                  <p style={{ color: 'var(--color-text-secondary, #6b7280)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                    Get full access to all products plus advanced bookkeeping features.
                    Includes everything in {selectedProduct.name} and more.
                  </p>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-success, #10b981)' }}>
                    ${(40).toFixed(2)}/month
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-secondary, #6b7280)' }}>
                      {' '}(includes your ${selectedProduct.price_usd.toFixed(2)} selection)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product Selection Dropdown (if no product pre-selected) */}
          {!selectedProduct && products.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label
                htmlFor="product-select"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Select a Product
              </label>
              <select
                id="product-select"
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const product = products.find(p => p.id === parseInt(e.target.value));
                  setSelectedProduct(product || null);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">Choose a product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ${product.price_usd.toFixed(2)}/{product.billing_cycle === 'monthly' ? 'mo' : 'product'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '2rem',
              justifyContent: 'space-between',
            }}
          >
            <button
              onClick={() => setStep('charity')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: 'var(--color-text-secondary, #6b7280)',
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              onClick={handleCompleteSignup}
              disabled={!selectedProduct || isLoading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor:
                  selectedProduct && !isLoading
                    ? 'var(--color-primary, #3b82f6)'
                    : 'var(--color-border, #e5e7eb)',
                color:
                  selectedProduct && !isLoading
                    ? 'white'
                    : 'var(--color-text-secondary, #6b7280)',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor:
                  selectedProduct && !isLoading ? 'pointer' : 'not-allowed',
              }}
            >
              {isLoading ? 'Creating Your Account...' : 'Continue to Checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
