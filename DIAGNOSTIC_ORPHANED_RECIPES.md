# Diagnostic: Find and Clean Up Orphaned Recipes

## What are Orphaned Recipes?

Orphaned recipes are recipe records in the database that point to finished products that no longer exist (deleted or archived). These can cause "Unknown Product" warnings and navigation issues.

## How to Find Orphaned Recipes

Open your browser console (F12) while on the Graceful Books app and run:

```javascript
// Find orphaned recipes
(async function findOrphanedRecipes() {
  const { db } = await import('./db/database');

  // Get your company ID from auth
  const companyId = localStorage.getItem('companyId');
  if (!companyId) {
    console.error('No company ID found. Please log in first.');
    return;
  }

  // Get all active recipes
  const recipes = await db.cpgRecipes
    .where('company_id')
    .equals(companyId)
    .filter(r => r.active && !r.deleted_at)
    .toArray();

  console.log(`Found ${recipes.length} active recipes`);

  // Check each recipe's product
  const orphaned = [];
  for (const recipe of recipes) {
    const product = await db.cpgFinishedProducts.get(recipe.finished_product_id);
    if (!product || !product.active || product.deleted_at) {
      orphaned.push({
        recipeId: recipe.id,
        productId: recipe.finished_product_id,
        categoryId: recipe.category_id,
        variant: recipe.variant,
        status: !product ? 'MISSING' : 'DELETED'
      });
    }
  }

  if (orphaned.length === 0) {
    console.log('✅ No orphaned recipes found!');
  } else {
    console.warn(`⚠️ Found ${orphaned.length} orphaned recipes:`);
    console.table(orphaned);
  }

  return orphaned;
})();
```

## How to Clean Up Orphaned Recipes

If you want to archive (soft delete) the orphaned recipes, run this:

```javascript
// Clean up orphaned recipes
(async function cleanUpOrphanedRecipes() {
  const { db } = await import('./db/database');

  const companyId = localStorage.getItem('companyId');
  if (!companyId) {
    console.error('No company ID found. Please log in first.');
    return;
  }

  const recipes = await db.cpgRecipes
    .where('company_id')
    .equals(companyId)
    .filter(r => r.active && !r.deleted_at)
    .toArray();

  const orphaned = [];
  for (const recipe of recipes) {
    const product = await db.cpgFinishedProducts.get(recipe.finished_product_id);
    if (!product || !product.active || product.deleted_at) {
      orphaned.push(recipe);
    }
  }

  if (orphaned.length === 0) {
    console.log('✅ No orphaned recipes to clean up!');
    return;
  }

  console.log(`Archiving ${orphaned.length} orphaned recipes...`);

  for (const recipe of orphaned) {
    await db.cpgRecipes.update(recipe.id, {
      active: false,
      deleted_at: Date.now(),
      updated_at: Date.now()
    });
  }

  console.log('✅ Cleanup complete!');

  // Trigger data refresh
  window.dispatchEvent(new CustomEvent('cpg-data-updated', { detail: { type: 'cleanup' } }));
})();
```

## Why This Happens

Orphaned recipes can occur when:
1. A finished product is deleted but its recipes aren't cleaned up
2. A product is archived but recipes still reference it
3. Data import issues or manual database edits

## Prevention

The system now automatically skips orphaned recipes when checking unit mismatches, so you won't see "Unknown Product" warnings anymore. The orphaned recipes are logged to the console for your reference.

If you want to prevent orphaned recipes in the future, make sure to:
- Delete recipes before deleting products
- Use the archive feature instead of permanent deletion when possible
