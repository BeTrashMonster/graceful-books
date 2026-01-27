/**
 * Finished Products Page
 *
 * Wrapper page for the Finished Product Manager.
 * Shows Getting Started card if no products exist.
 */

import { useState } from 'react';
import { FinishedProductManager } from '../../components/cpg/FinishedProductManager';
import { RecipeBuilderModal } from '../../components/cpg/modals/RecipeBuilderModal';
import { db } from '../../db/database';
import { useAuth } from '../../contexts/AuthContext';
import styles from './CPGPages.module.css';

export default function FinishedProducts() {
  const { companyId } = useAuth();
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
        />
      )}
    </div>
  );
}
