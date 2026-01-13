/**
 * Products Data Access Layer
 *
 * Provides CRUD operations for products and services with:
 * - Encryption/decryption integration points
 * - CRDT version vector management
 * - Soft delete with tombstone markers
 * - Query builders for common operations
 */

import { nanoid } from 'nanoid'
import { db } from './database'
import type {
  ProductEntity,
  ProductFilter,
  DatabaseResult,
  DatabaseError,
  EncryptionContext,
  VersionVector,
  BatchResult,
} from './types'

/**
 * Generate current device ID (stored in localStorage)
 */
function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = nanoid()
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}

/**
 * Initialize version vector for a new entity
 */
function initVersionVector(): VersionVector {
  const deviceId = getDeviceId()
  return { [deviceId]: 1 }
}

/**
 * Increment version vector for an update
 */
function incrementVersionVector(current: VersionVector): VersionVector {
  const deviceId = getDeviceId()
  return {
    ...current,
    [deviceId]: (current[deviceId] || 0) + 1,
  }
}

/**
 * Product type for the return value
 */
export interface Product {
  id: string
  companyId: string
  name: string
  description?: string
  type: 'product' | 'service'
  sku?: string
  price: number
  cost?: number
  incomeAccountId: string
  expenseAccountId?: string
  taxable: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}

/**
 * Convert Product to ProductEntity (adds CRDT fields)
 */
function toProductEntity(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    id?: string
    createdAt?: Date
    updatedAt?: Date
  }
): ProductEntity {
  const now = new Date()
  const deviceId = getDeviceId()

  return {
    id: product.id || nanoid(),
    companyId: product.companyId,
    name: product.name,
    description: product.description,
    type: product.type,
    sku: product.sku,
    price: product.price,
    cost: product.cost,
    incomeAccountId: product.incomeAccountId,
    expenseAccountId: product.expenseAccountId,
    taxable: product.taxable,
    isActive: product.isActive,
    createdAt: product.createdAt || now,
    updatedAt: now,
    deletedAt: undefined,
    versionVector: initVersionVector(),
    lastModifiedBy: deviceId,
    lastModifiedAt: now,
    _encrypted: {
      name: true,
      description: true,
      price: true,
      cost: true,
    },
  }
}

/**
 * Convert ProductEntity to Product (removes CRDT fields)
 */
function fromProductEntity(entity: ProductEntity): Product {
  return {
    id: entity.id,
    companyId: entity.companyId,
    name: entity.name,
    description: entity.description,
    type: entity.type,
    sku: entity.sku,
    price: entity.price,
    cost: entity.cost,
    incomeAccountId: entity.incomeAccountId,
    expenseAccountId: entity.expenseAccountId,
    taxable: entity.taxable,
    isActive: entity.isActive,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    deletedAt: entity.deletedAt,
  }
}

/**
 * Create a new product
 */
export async function createProduct(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  context?: EncryptionContext
): Promise<DatabaseResult<Product>> {
  try {
    // Validate product type
    if (product.type !== 'product' && product.type !== 'service') {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid product type: ${product.type}`,
        },
      }
    }

    // Validate price is non-negative
    if (product.price < 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Price cannot be negative',
        },
      }
    }

    // Validate cost is non-negative if provided
    if (product.cost !== undefined && product.cost < 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cost cannot be negative',
        },
      }
    }

    // Validate income account exists
    const incomeAccount = await db.accounts.get(product.incomeAccountId)
    if (!incomeAccount || incomeAccount.deletedAt) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid income account ID',
        },
      }
    }

    // Validate expense account if provided
    if (product.expenseAccountId) {
      const expenseAccount = await db.accounts.get(product.expenseAccountId)
      if (!expenseAccount || expenseAccount.deletedAt) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid expense account ID',
          },
        }
      }
    }

    // Check for duplicate SKU if provided
    if (product.sku) {
      const existing = await db.products
        .where('sku')
        .equals(product.sku)
        .and((p) => p.companyId === product.companyId && !p.deletedAt)
        .first()

      if (existing) {
        return {
          success: false,
          error: {
            code: 'CONSTRAINT_VIOLATION',
            message: `SKU already exists: ${product.sku}`,
          },
        }
      }
    }

    // Create entity with CRDT fields
    let entity = toProductEntity(product)

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      entity = {
        ...entity,
        name: await encryptionService.encrypt(entity.name),
        description: entity.description
          ? await encryptionService.encrypt(entity.description)
          : undefined,
        price: entity.price, // Price encryption handled separately
        cost: entity.cost, // Cost encryption handled separately
      }
    }

    // Store in database
    await db.products.add(entity)

    // Return decrypted product
    const result = fromProductEntity(entity)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get product by ID
 */
export async function getProduct(
  id: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Product>> {
  try {
    const entity = await db.products.get(id)

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product not found: ${id}`,
        },
      }
    }

    // Check if soft deleted
    if (entity.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product has been deleted: ${id}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : undefined,
      }
    }

    return { success: true, data: fromProductEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id' | 'companyId' | 'createdAt'>>,
  context?: EncryptionContext
): Promise<DatabaseResult<Product>> {
  try {
    const existing = await db.products.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product has been deleted: ${id}`,
        },
      }
    }

    // Validate price if provided
    if (updates.price !== undefined && updates.price < 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Price cannot be negative',
        },
      }
    }

    // Validate cost if provided
    if (updates.cost !== undefined && updates.cost < 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cost cannot be negative',
        },
      }
    }

    // Check for duplicate SKU if updating SKU
    if (updates.sku && updates.sku !== existing.sku) {
      const duplicate = await db.products
        .where('sku')
        .equals(updates.sku)
        .and((p) => p.companyId === existing.companyId && p.id !== id && !p.deletedAt)
        .first()

      if (duplicate) {
        return {
          success: false,
          error: {
            code: 'CONSTRAINT_VIOLATION',
            message: `SKU already exists: ${updates.sku}`,
          },
        }
      }
    }

    // Prepare updated entity
    const now = new Date()
    const deviceId = getDeviceId()

    const updated: ProductEntity = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      companyId: existing.companyId, // Ensure companyId doesn't change
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    }

    // Apply encryption if service provided
    if (context?.encryptionService) {
      const { encryptionService } = context
      if (updates.name) {
        updated.name = await encryptionService.encrypt(updates.name)
      }
      if (updates.description !== undefined) {
        updated.description = updates.description
          ? await encryptionService.encrypt(updates.description)
          : undefined
      }
    }

    // Update in database
    await db.products.put(updated)

    // Decrypt for return
    let result = updated
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...updated,
        name: await encryptionService.decrypt(updated.name),
        description: updated.description
          ? await encryptionService.decrypt(updated.description)
          : undefined,
      }
    }

    return { success: true, data: fromProductEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Delete a product (soft delete with tombstone)
 */
export async function deleteProduct(
  id: string
): Promise<DatabaseResult<void>> {
  try {
    const existing = await db.products.get(id)

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product not found: ${id}`,
        },
      }
    }

    if (existing.deletedAt) {
      return { success: true, data: undefined } // Already deleted
    }

    // Soft delete with tombstone marker
    const now = new Date()
    const deviceId = getDeviceId()

    await db.products.update(id, {
      deletedAt: now,
      versionVector: incrementVersionVector(existing.versionVector),
      lastModifiedBy: deviceId,
      lastModifiedAt: now,
    })

    return { success: true, data: undefined }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Query products with filters
 */
export async function queryProducts(
  filter: ProductFilter,
  context?: EncryptionContext
): Promise<DatabaseResult<Product[]>> {
  try {
    let query = db.products.toCollection()

    // Apply filters
    if (filter.companyId) {
      query = db.products.where('companyId').equals(filter.companyId)
    }

    if (filter.type && filter.companyId) {
      query = db.products
        .where('[companyId+type]')
        .equals([filter.companyId, filter.type])
    }

    if (filter.isActive !== undefined && filter.companyId) {
      query = db.products
        .where('[companyId+isActive]')
        .equals([filter.companyId, filter.isActive] as any)
    }

    // Filter out deleted unless explicitly requested
    if (!filter.includeDeleted) {
      query = query.and((product) => !product.deletedAt)
    }

    const entities = await query.toArray()

    // Decrypt if service provided
    let results = entities
    if (context?.encryptionService) {
      const { encryptionService } = context
      results = await Promise.all(
        entities.map(async (entity) => ({
          ...entity,
          name: await encryptionService.decrypt(entity.name),
          description: entity.description
            ? await encryptionService.decrypt(entity.description)
            : undefined,
        }))
      )
    }

    return {
      success: true,
      data: results.map(fromProductEntity),
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Get all products for a company
 */
export async function getProducts(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Product[]>> {
  return queryProducts(
    { companyId, type: 'product', isActive: true },
    context
  )
}

/**
 * Get all services for a company
 */
export async function getServices(
  companyId: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Product[]>> {
  return queryProducts(
    { companyId, type: 'service', isActive: true },
    context
  )
}

/**
 * Get product by SKU
 */
export async function getProductBySKU(
  companyId: string,
  sku: string,
  context?: EncryptionContext
): Promise<DatabaseResult<Product>> {
  try {
    const entity = await db.products
      .where('sku')
      .equals(sku)
      .and((p) => p.companyId === companyId && !p.deletedAt)
      .first()

    if (!entity) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Product not found with SKU: ${sku}`,
        },
      }
    }

    // Decrypt if service provided
    let result = entity
    if (context?.encryptionService) {
      const { encryptionService } = context
      result = {
        ...entity,
        name: await encryptionService.decrypt(entity.name),
        description: entity.description
          ? await encryptionService.decrypt(entity.description)
          : undefined,
      }
    }

    return { success: true, data: fromProductEntity(result) }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}

/**
 * Batch create products
 */
export async function batchCreateProducts(
  products: Array<Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>,
  context?: EncryptionContext
): Promise<BatchResult<Product>> {
  const successful: Product[] = []
  const failed: Array<{ item: Product; error: DatabaseError }> = []

  for (const product of products) {
    const result = await createProduct(product, context)
    if (result.success) {
      successful.push(result.data)
    } else {
      failed.push({
        item: {
          ...product,
          id: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        error: result.error,
      })
    }
  }

  return { successful, failed }
}
