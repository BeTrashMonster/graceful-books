import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CharitySelector } from '../../components/charity';
import type { Charity } from '../../types/database.types';
import { signup } from '../../services/auth.api';
import { getProducts, type Product } from '../../services/products.api';
import styles from './Signup.module.css';

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Skip charity and product selection - go straight to checkout with CPG Costing Tool
    const cpgProduct = products.find(p => p.slug === 'cpu-cpg-calculator');
    if (!cpgProduct) {
      setError('Product not loaded yet. Please try again.');
      return;
    }

    setSelectedProduct(cpgProduct);
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
          selectedProduct: cpgProduct.slug,
          upgradeToBookkeeping: false,
        })
      );

      // Create Stripe checkout session and redirect
      const { createCheckoutSession } = await import('../../services/checkout.api');
      const checkoutSession = await createCheckoutSession(cpgProduct.id);

      // Redirect to Stripe checkout
      window.location.href = checkoutSession.url;
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(
        err.message || 'Something unexpected happened. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
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
      // Note: charityId omitted due to backend validation bug (expects number but DB uses UUID)
      // TODO: Fix backend to accept UUID, then save charity selection after signup
      const response = await signup({
        email,
        password,
        firstName,
        lastName,
        companyName: companyName || undefined,
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
    <div className={styles.container}>
      {step === 'credentials' && (
        <div className={styles.card}>
          <div className={styles.logoContainer}>
            <img
              src="/assets/audacious-logo.png"
              alt="Audacious Money"
              className={styles.logo}
            />
          </div>

          <div className={styles.header}>
            <h1 className={styles.title}>Create Your Account</h1>
            <p className={styles.subtitle}>
              Start your journey with Audacious Money
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert} role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit} className={styles.form}>
            <div className={styles.nameRow}>
              <div className={styles.formGroup}>
                <label htmlFor="firstName" className={styles.label}>
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="lastName" className={styles.label}>
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="companyName" className={styles.label}>
                Company Name (Optional)
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <div className={styles.passwordGroup}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={styles.passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.togglePassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <p className={styles.passwordHint}>
                Must be 8+ characters with uppercase, lowercase, number, and special character (!@#$%^&*)
              </p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <div className={styles.passwordGroup}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={styles.passwordInput}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className={styles.togglePassword}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
            >
              Continue
            </button>
          </form>

          <div className={styles.footer}>
            <span className={styles.footerText}>
              Already have an account?{' '}
            </span>
            <Link to="/login" className={styles.footerLink}>
              Sign in
            </Link>
          </div>
        </div>
      )}

      {step === 'charity' && (
        <div className={styles.wideCard}>
          <CharitySelector
            selectedCharityId={selectedCharity?.id}
            onSelect={handleCharitySelect}
            showSearch
            showFilters
          />

          <div className={styles.navigationButtons}>
            <button onClick={handleBack} className={styles.backButton}>
              Back
            </button>
            <button
              onClick={handleCharityContinue}
              disabled={!selectedCharity}
              className={styles.continueButton}
            >
              Continue to Product Selection
            </button>
          </div>
        </div>
      )}

      {step === 'product' && (
        <div className={styles.mediumCard}>
          <div className={styles.header}>
            <h1 className={styles.title}>Choose Your Product</h1>
            <p className={styles.subtitle}>
              {selectedProduct
                ? `You've selected ${selectedProduct.name}. Want to upgrade?`
                : 'Select the product that fits your needs'}
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert} role="alert">
              {error}
            </div>
          )}

          {/* Selected/Pre-selected Product */}
          {selectedProduct && (
            <div className={styles.productCard}>
              <div className={styles.productCardHeader}>
                <div>
                  <h3 className={styles.productTitle}>
                    {selectedProduct.name}
                  </h3>
                  <p className={styles.productDescription}>
                    {selectedProduct.description}
                  </p>
                  <div className={styles.productPrice}>
                    ${selectedProduct.price_usd.toFixed(2)}
                    <span className={styles.priceCycle}>
                      /{selectedProduct.billing_cycle === 'monthly' ? 'month' : 'product'}
                    </span>
                  </div>
                </div>
                <div className={styles.selectedBadge}>
                  SELECTED
                </div>
              </div>
            </div>
          )}

          {/* Bookkeeping Suite Upgrade Option */}
          {selectedProduct && selectedProduct.slug !== 'bookkeeping-suite' && selectedProduct.slug !== 'fractional-cfo' && (
            <div className={styles.upgradeCard}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                <input
                  type="checkbox"
                  id="upgrade-bookkeeping"
                  checked={upgradeToBookkeeping}
                  onChange={(e) => setUpgradeToBookkeeping(e.target.checked)}
                  className={styles.upgradeCheckbox}
                />
                <div style={{ flex: 1 }}>
                  <label
                    htmlFor="upgrade-bookkeeping"
                    className={styles.upgradeLabel}
                  >
                    Upgrade to Bookkeeping Suite
                  </label>
                  <p className={styles.productDescription}>
                    Get full access to all products plus advanced bookkeeping features.
                    Includes everything in {selectedProduct.name} and more.
                  </p>
                  <div className={styles.productPrice} style={{ fontSize: '1.25rem' }}>
                    ${(40).toFixed(2)}/month
                    <span className={styles.priceCycle}>
                      {' '}(includes your ${selectedProduct.price_usd.toFixed(2)} selection)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product Selection Dropdown (if no product pre-selected) */}
          {!selectedProduct && products.length > 0 && (
            <div className={styles.formGroup} style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="product-select" className={styles.label}>
                Select a Product
              </label>
              <select
                id="product-select"
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const product = products.find(p => p.id === parseInt(e.target.value));
                  setSelectedProduct(product || null);
                }}
                className={styles.input}
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
          <div className={styles.navigationButtons}>
            <button
              onClick={() => setStep('charity')}
              className={styles.backButton}
            >
              Back
            </button>
            <button
              onClick={handleCompleteSignup}
              disabled={!selectedProduct || isLoading}
              className={styles.continueButton}
            >
              {isLoading ? 'Creating Your Account...' : 'Continue to Checkout'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
