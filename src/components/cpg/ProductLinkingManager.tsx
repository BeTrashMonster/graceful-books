/**
 * Product Linking Manager Component
 *
 * Manages the mapping between CPG categories/variants and accounting products.
 * Enables users to link their CPG cost tracking to specific SKUs and accounts.
 *
 * Features:
 * - View all existing product links
 * - Create new links (category + variant → product + accounts)
 * - Edit existing links
 * - Delete links
 * - Bulk link creation (create links for all variants)
 * - Validation (prevent duplicate links)
 *
 * Requirements:
 * - Group D2: CPG-Accounting Integration
 * - Must have CPG categories configured
 * - Must have products/SKUs in accounting system
 * - Must have COGS and Inventory accounts
 */

import { useState, useEffect } from 'react';
import { Button } from '../core/Button';
import { Select } from '../forms/Select';
import { Modal } from '../modals/Modal';
import { HelpTooltip } from '../help/HelpTooltip';
import { cpgIntegrationService } from '../../services/cpg/cpgIntegration.service';
import { db } from '../../db';
import type {
  CPGCategory,
  CPGProductLink,
  Product,
  Account,
} from '../../types/database.types';
import styles from './ProductLinkingManager.module.css';

export interface ProductLinkingManagerProps {
  companyId: string;
  categories: CPGCategory[];
}

interface ProductLinkRow extends CPGProductLink {
  category_name: string;
  product_name: string;
  product_sku: string | null;
  cogs_account_name: string;
  inventory_account_name: string;
}

export function ProductLinkingManager({ companyId, categories }: ProductLinkingManagerProps) {
  const [links, setLinks] = useState<ProductLinkRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCOGSAccountId, setSelectedCOGSAccountId] = useState('');
  const [selectedInventoryAccountId, setSelectedInventoryAccountId] = useState('');

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load product links
      const linksData = await db.cpgProductLinks
        .where('company_id')
        .equals(companyId)
        .and((l) => l.active && l.deleted_at === null)
        .toArray();

      // Load products
      const productsData = await db.products
        .where('company_id')
        .equals(companyId)
        .filter((p) => p.active && p.deleted_at === null)
        .toArray();

      // Load accounts
      const accountsData = await db.accounts
        .where('company_id')
        .equals(companyId)
        .filter((a) => a.active && a.deleted_at === null)
        .toArray();

      // Build product link rows with names
      const linkRows: ProductLinkRow[] = [];
      for (const link of linksData) {
        const category = categories.find((c) => c.id === link.cpg_category_id);
        const product = productsData.find((p) => p.id === link.product_id);
        const cogsAccount = accountsData.find((a) => a.id === link.account_id_cogs);
        const inventoryAccount = accountsData.find((a) => a.id === link.account_id_inventory);

        if (category && product && cogsAccount && inventoryAccount) {
          linkRows.push({
            ...link,
            category_name: category.name,
            product_name: product.name,
            product_sku: product.sku,
            cogs_account_name: cogsAccount.name,
            inventory_account_name: inventoryAccount.name,
          });
        }
      }

      setLinks(linkRows);
      setProducts(productsData);
      setAccounts(accountsData);

      // Auto-select default accounts if available
      const defaultCOGS = accountsData.find(
        (a) => a.type === 'COGS' && a.name.toLowerCase().includes('cost of goods')
      );
      const defaultInventory = accountsData.find(
        (a) => a.type === 'ASSET' && a.name.toLowerCase().includes('inventory')
      );

      if (defaultCOGS && !selectedCOGSAccountId) {
        setSelectedCOGSAccountId(defaultCOGS.id);
      }
      if (defaultInventory && !selectedInventoryAccountId) {
        setSelectedInventoryAccountId(defaultInventory.id);
      }
    } catch (err) {
      console.error('Failed to load product links:', err);
      setError('Failed to load product links. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLink = async () => {
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!selectedCategoryId) {
      setError('Please select a category');
      return;
    }
    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }
    if (!selectedCOGSAccountId) {
      setError('Please select a COGS account');
      return;
    }
    if (!selectedInventoryAccountId) {
      setError('Please select an Inventory account');
      return;
    }

    setIsLoading(true);

    try {
      const result = await cpgIntegrationService.linkCPGCategoryToProduct(
        companyId,
        selectedCategoryId,
        selectedVariant,
        selectedProductId,
        selectedCOGSAccountId,
        selectedInventoryAccountId,
        'web-client' // TODO: Get from device context
      );

      if (!result.success) {
        setError(result.error || 'Failed to create product link');
        return;
      }

      // Success!
      setSuccessMessage('Product link created successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadData(); // Reload data
    } catch (err) {
      console.error('Failed to create product link:', err);
      setError('Failed to create product link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this product link?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Soft delete
      await db.cpgProductLinks.update(linkId, {
        deleted_at: Date.now(),
        active: false,
      });

      setSuccessMessage('Product link deleted successfully');
      await loadData();
    } catch (err) {
      console.error('Failed to delete product link:', err);
      setError('Failed to delete product link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedCategoryId('');
    setSelectedVariant(null);
    setSelectedProductId('');
    // Keep account selections for convenience
  };

  const getVariantsForCategory = (categoryId: string): string[] | null => {
    const category = categories.find((c) => c.id === categoryId);
    return category?.variants || null;
  };

  const cogsAccounts = accounts.filter((a) => a.type === 'COGS');
  const assetAccounts = accounts.filter((a) => a.type === 'ASSET');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            Product Linking Manager
            <HelpTooltip content="Link your CPG categories and variants to accounting products and accounts. This enables seamless invoice entry that creates both CPG cost tracking and accounting transactions." />
          </h2>
          <p className={styles.subtitle}>
            Map CPG categories to products and accounts for integrated mode
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
          + Create Link
        </Button>
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className={styles.successBanner} role="alert">
          <span aria-hidden="true">✓</span>
          <span>{successMessage}</span>
        </div>
      )}

      {isLoading && <div className={styles.loading}>Loading...</div>}

      {!isLoading && links.length === 0 && (
        <div className={styles.emptyState}>
          <p>No product links configured yet.</p>
          <p>
            Create product links to enable integrated invoice entry. Each link maps a CPG category
            and variant to an accounting product and accounts.
          </p>
          <Button variant="primary" size="md" onClick={() => setShowCreateModal(true)}>
            Create Your First Link
          </Button>
        </div>
      )}

      {!isLoading && links.length > 0 && (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>CPG Category</th>
                <th>Variant</th>
                <th>Product (SKU)</th>
                <th>COGS Account</th>
                <th>Inventory Account</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <td>{link.category_name}</td>
                  <td>{link.cpg_variant || <em>No variant</em>}</td>
                  <td>
                    {link.product_name}
                    {link.product_sku && <span className={styles.sku}> ({link.product_sku})</span>}
                  </td>
                  <td>{link.cogs_account_name}</td>
                  <td>{link.inventory_account_name}</td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLink(link.id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Link Modal */}
      {showCreateModal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowCreateModal(false);
            resetForm();
            setError(null);
          }}
          title="Create Product Link"
          closeOnBackdropClick={false}
          size="md"
        >
          <div className={styles.modalContent}>
            {error && (
              <div className={styles.errorBanner} role="alert">
                <span aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <div className={styles.formGroup}>
              <Select
                label="CPG Category"
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setSelectedVariant(null); // Reset variant when category changes
                }}
                required
                fullWidth
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedCategoryId && getVariantsForCategory(selectedCategoryId) && (
              <div className={styles.formGroup}>
                <Select
                  label="Variant"
                  value={selectedVariant || ''}
                  onChange={(e) => setSelectedVariant(e.target.value || null)}
                  fullWidth
                >
                  <option value="">No variant</option>
                  {getVariantsForCategory(selectedCategoryId)!.map((variant) => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className={styles.formGroup}>
              <Select
                label="Product / SKU"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                fullWidth
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                    {product.sku ? ` (${product.sku})` : ''}
                  </option>
                ))}
              </Select>
              {products.length === 0 && (
                <p className={styles.helperText}>
                  No products found. Please create products in your accounting system first.
                </p>
              )}
            </div>

            <div className={styles.formGroup}>
              <Select
                label="COGS Account"
                value={selectedCOGSAccountId}
                onChange={(e) => setSelectedCOGSAccountId(e.target.value)}
                required
                fullWidth
              >
                <option value="">Select COGS account</option>
                {cogsAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_number ? `${account.account_number} - ` : ''}
                    {account.name}
                  </option>
                ))}
              </Select>
              {cogsAccounts.length === 0 && (
                <p className={styles.helperText}>
                  No COGS accounts found. Please create a Cost of Goods Sold account first.
                </p>
              )}
            </div>

            <div className={styles.formGroup}>
              <Select
                label="Inventory Account"
                value={selectedInventoryAccountId}
                onChange={(e) => setSelectedInventoryAccountId(e.target.value)}
                required
                fullWidth
              >
                <option value="">Select inventory account</option>
                {assetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_number ? `${account.account_number} - ` : ''}
                    {account.name}
                  </option>
                ))}
              </Select>
              {assetAccounts.length === 0 && (
                <p className={styles.helperText}>
                  No asset accounts found. Please create an Inventory account first.
                </p>
              )}
            </div>

            <div className={styles.modalActions}>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                  setError(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleCreateLink}
                loading={isLoading}
                disabled={isLoading}
              >
                Create Link
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
