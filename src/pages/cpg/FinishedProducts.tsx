/**
 * Finished Products Page
 *
 * Wrapper page for the Finished Product Manager.
 * Shows Getting Started card if no products exist.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FinishedProductManager } from '../../components/cpg/FinishedProductManager';
import { RecipeBuilderModal } from '../../components/cpg/modals/RecipeBuilderModal';
import { AddInvoiceModal } from '../../components/cpg/modals/AddInvoiceModal';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import styles from './CPGPages.module.css';

export default function FinishedProducts() {
  const { companyId } = useAuth();
  const location = useLocation();
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    id: string;
    number: string;
  } | null>(null);

  // Check if we navigated here from another page to open a specific recipe
  useEffect(() => {
    const state = location.state as any;
    if (state?.openRecipe) {
      handleOpenRecipeBuilder(state.openRecipe.productId);
    }
  }, [location.state]);

  // Listen for edit product requests (from RecipeBuilder "View batch units" link)
  // Close the recipe modal so the edit modal can open
  useEffect(() => {
    const handleEditProductRequest = () => {
      setRecipeModalOpen(false);
      setSelectedProduct(null);
    };

    window.addEventListener('cpg:edit-product', handleEditProductRequest);
    return () => {
      window.removeEventListener('cpg:edit-product', handleEditProductRequest);
    };
  }, []);

  const handleOpenRecipeBuilder = async (productId: string) => {
    // Get product details
    const product = await db.cpgFinishedProducts.get(productId);
    if (product) {
      setSelectedProduct({ id: product.id, name: product.name });
      setRecipeModalOpen(true);
    }
  };

  const handleCloseRecipeBuilder = () => {
    setRecipeModalOpen(false);
    setSelectedProduct(null);
  };

  const handleNavigateToInvoice = (invoiceId: string, invoiceNumber: string) => {
    // Close recipe modal
    setRecipeModalOpen(false);

    // Open invoice modal for editing
    setSelectedInvoice({ id: invoiceId, number: invoiceNumber });
    setInvoiceModalOpen(true);
  };

  const handleCloseInvoice = () => {
    setInvoiceModalOpen(false);
    setSelectedInvoice(null);
  };

  return (
    <div className={styles.pageContainer}>
      <FinishedProductManager onOpenRecipeBuilder={handleOpenRecipeBuilder} />

      {/* Recipe Builder Modal */}
      {selectedProduct && (
        <RecipeBuilderModal
          isOpen={recipeModalOpen}
          onClose={handleCloseRecipeBuilder}
          finishedProductId={selectedProduct.id}
          productName={selectedProduct.name}
          onNavigateToInvoice={handleNavigateToInvoice}
        />
      )}

      {/* Invoice Modal (for editing invoices with unit mismatches) */}
      <AddInvoiceModal
        isOpen={invoiceModalOpen}
        onClose={handleCloseInvoice}
        invoiceId={selectedInvoice?.id}
        mode="edit"
        onNavigateToRecipe={async (productId: string, productName: string) => {
          // Close invoice modal and open recipe modal
          setInvoiceModalOpen(false);
          handleOpenRecipeBuilder(productId);
        }}
      />
    </div>
  );
}
