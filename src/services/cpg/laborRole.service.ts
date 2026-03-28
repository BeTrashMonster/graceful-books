/**
 * Labor Role Service
 *
 * Manages labor roles and product labor assignments for CPG cost tracking.
 *
 * Features:
 * - Create, read, update, delete labor roles
 * - Assign labor roles to products
 * - Calculate labor costs per unit
 * - Support both hourly and salary compensation types
 */

import { nanoid } from 'nanoid';
import type { TreasureChestDB } from '../../db/database';
import type { CPGLaborRole, CPGProductLabor, CPGFinishedProduct } from '../../db/schema/cpg.schema';
import {
  createDefaultCPGLaborRole,
  validateCPGLaborRole,
  createDefaultCPGProductLabor,
  validateCPGProductLabor,
  calculateHourlyRateFromSalary,
  calculateHoursPerUnit,
  calculateLaborCostPerUnit,
} from '../../db/schema/cpg.schema';

export class LaborRoleService {
  constructor(private db: TreasureChestDB) {}

  // ============================================================================
  // Labor Role Operations
  // ============================================================================

  /**
   * Get all labor roles for a company
   */
  async getRoles(companyId: string): Promise<CPGLaborRole[]> {
    return await this.db.cpgLaborRoles
      .where('company_id')
      .equals(companyId)
      .and((role) => role.deleted_at === null && role.active)
      .toArray();
  }

  /**
   * Get a single labor role by ID
   */
  async getRole(roleId: string): Promise<CPGLaborRole | undefined> {
    const role = await this.db.cpgLaborRoles.get(roleId);
    if (role && role.deleted_at === null) {
      return role;
    }
    return undefined;
  }

  /**
   * Create a new labor role
   */
  async createRole(
    companyId: string,
    roleName: string,
    compensationType: 'hourly' | 'salary',
    compensationData: {
      hourlyRate?: string;
      salaryAmount?: string;
      salaryPeriod?: 'yearly' | 'monthly' | 'biweekly' | 'weekly';
    },
    deviceId: string,
    options?: {
      description?: string;
      notes?: string;
    }
  ): Promise<CPGLaborRole> {
    // Create default role
    const defaultRole = createDefaultCPGLaborRole(companyId, roleName, deviceId);
    const id = nanoid();

    // Build the role object
    const role: Partial<CPGLaborRole> = {
      id,
      ...defaultRole,
      compensation_type: compensationType,
      description: options?.description || null,
      notes: options?.notes || null,
    };

    // Handle compensation based on type
    if (compensationType === 'hourly') {
      role.hourly_rate = compensationData.hourlyRate || '20.00';
      role.salary_amount = null;
      role.salary_period = null;
      role.calculated_hourly_rate = null;
    } else {
      role.hourly_rate = null;
      role.salary_amount = compensationData.salaryAmount || '52000.00';
      role.salary_period = compensationData.salaryPeriod || 'yearly';
      // Calculate hourly rate from salary
      role.calculated_hourly_rate = calculateHourlyRateFromSalary(
        role.salary_amount!,
        role.salary_period!
      );
    }

    // Validate the role
    const existingRoles = await this.getRoles(companyId);
    const errors = validateCPGLaborRole(role, existingRoles);
    if (errors.length > 0) {
      throw new Error(`Invalid labor role: ${errors.join(', ')}`);
    }

    // Add to database
    await this.db.cpgLaborRoles.add(role as CPGLaborRole);

    // Return the created role
    const created = await this.db.cpgLaborRoles.get(id);
    if (!created) {
      throw new Error('Failed to retrieve created labor role');
    }

    return created;
  }

  /**
   * Update a labor role
   */
  async updateRole(
    roleId: string,
    updates: {
      roleName?: string;
      description?: string | null;
      compensationType?: 'hourly' | 'salary';
      hourlyRate?: string;
      salaryAmount?: string;
      salaryPeriod?: 'yearly' | 'monthly' | 'biweekly' | 'weekly';
      notes?: string | null;
    },
    deviceId: string
  ): Promise<CPGLaborRole> {
    // Get current role
    const current = await this.db.cpgLaborRoles.get(roleId);
    if (!current || current.deleted_at !== null) {
      throw new Error('Labor role not found');
    }

    // Build update object
    const updateData: Partial<CPGLaborRole> = {
      updated_at: Date.now(),
    };

    if (updates.roleName !== undefined) updateData.role_name = updates.roleName;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    // Handle compensation type changes
    const newCompType = updates.compensationType || current.compensation_type;
    updateData.compensation_type = newCompType;

    if (newCompType === 'hourly') {
      updateData.hourly_rate = updates.hourlyRate || current.hourly_rate || '20.00';
      updateData.salary_amount = null;
      updateData.salary_period = null;
      updateData.calculated_hourly_rate = null;
    } else {
      const salaryAmount = updates.salaryAmount || current.salary_amount || '52000.00';
      const salaryPeriod = updates.salaryPeriod || current.salary_period || 'yearly';
      updateData.hourly_rate = null;
      updateData.salary_amount = salaryAmount;
      updateData.salary_period = salaryPeriod;
      updateData.calculated_hourly_rate = calculateHourlyRateFromSalary(
        salaryAmount,
        salaryPeriod
      );
    }

    // Update version vector
    const versionVector = { ...current.version_vector };
    versionVector[deviceId] = (versionVector[deviceId] || 0) + 1;
    updateData.version_vector = versionVector;

    // Validate the updated role
    const existingRoles = await this.getRoles(current.company_id);
    const mergedRole = { ...current, ...updateData };
    const errors = validateCPGLaborRole(mergedRole, existingRoles);
    if (errors.length > 0) {
      throw new Error(`Invalid labor role: ${errors.join(', ')}`);
    }

    // Apply updates
    await this.db.cpgLaborRoles.update(roleId, updateData);

    // Return updated role
    const updated = await this.db.cpgLaborRoles.get(roleId);
    if (!updated) {
      throw new Error('Failed to retrieve updated labor role');
    }

    return updated;
  }

  /**
   * Delete a labor role (soft delete)
   */
  async deleteRole(roleId: string, deviceId: string): Promise<void> {
    const role = await this.db.cpgLaborRoles.get(roleId);
    if (!role) {
      throw new Error('Labor role not found');
    }

    // Check if role is assigned to any products
    const assignments = await this.db.cpgProductLabors
      .where('labor_role_id')
      .equals(roleId)
      .and((a) => a.deleted_at === null)
      .count();

    if (assignments > 0) {
      throw new Error(
        'Cannot delete labor role that is assigned to products. Remove assignments first.'
      );
    }

    // Update version vector
    const versionVector = { ...role.version_vector };
    versionVector[deviceId] = (versionVector[deviceId] || 0) + 1;

    // Soft delete
    await this.db.cpgLaborRoles.update(roleId, {
      deleted_at: Date.now(),
      updated_at: Date.now(),
      version_vector: versionVector,
    });
  }

  /**
   * Get the effective hourly rate for a role
   */
  getEffectiveHourlyRate(role: CPGLaborRole): string {
    if (role.compensation_type === 'hourly') {
      return role.hourly_rate || '0.00';
    }
    return role.calculated_hourly_rate || '0.00';
  }

  // ============================================================================
  // Product Labor Assignment Operations
  // ============================================================================

  /**
   * Get all labor assignments for a product
   */
  async getProductAssignments(productId: string): Promise<CPGProductLabor[]> {
    return await this.db.cpgProductLabors
      .where('finished_product_id')
      .equals(productId)
      .and((a) => a.deleted_at === null && a.active)
      .toArray();
  }

  /**
   * Get all products assigned to a labor role
   */
  async getRoleAssignments(roleId: string): Promise<CPGProductLabor[]> {
    return await this.db.cpgProductLabors
      .where('labor_role_id')
      .equals(roleId)
      .and((a) => a.deleted_at === null && a.active)
      .toArray();
  }

  /**
   * Assign a labor role to a product
   */
  async assignRoleToProduct(
    companyId: string,
    productId: string,
    roleId: string,
    entryMode: 'per_batch' | 'per_unit',
    hoursData: {
      hoursPerBatch?: string;
      batchSize?: string;
      hoursPerUnit?: string;
    },
    deviceId: string,
    options?: {
      notes?: string;
    }
  ): Promise<CPGProductLabor> {
    // Verify product exists
    const product = await this.db.cpgFinishedProducts.get(productId);
    if (!product || product.deleted_at !== null) {
      throw new Error('Product not found');
    }

    // Verify role exists
    const role = await this.db.cpgLaborRoles.get(roleId);
    if (!role || role.deleted_at !== null) {
      throw new Error('Labor role not found');
    }

    // Create default assignment
    const defaultAssignment = createDefaultCPGProductLabor(
      companyId,
      productId,
      roleId,
      deviceId
    );
    const id = nanoid();

    // Build the assignment object
    const assignment: Partial<CPGProductLabor> = {
      id,
      ...defaultAssignment,
      entry_mode: entryMode,
      notes: options?.notes || null,
    };

    // Handle hours based on entry mode
    if (entryMode === 'per_batch') {
      assignment.hours_per_batch = hoursData.hoursPerBatch || '0';
      assignment.batch_size = hoursData.batchSize || '0';
      // Calculate hours per unit
      assignment.hours_per_unit = calculateHoursPerUnit(
        assignment.hours_per_batch,
        assignment.batch_size
      );
    } else {
      assignment.hours_per_unit = hoursData.hoursPerUnit || '0';
      assignment.hours_per_batch = null;
      assignment.batch_size = null;
    }

    // Validate the assignment
    const existingAssignments = await this.getProductAssignments(productId);
    const errors = validateCPGProductLabor(assignment, existingAssignments);
    if (errors.length > 0) {
      throw new Error(`Invalid product labor assignment: ${errors.join(', ')}`);
    }

    // Add to database
    await this.db.cpgProductLabors.add(assignment as CPGProductLabor);

    // Return the created assignment
    const created = await this.db.cpgProductLabors.get(id);
    if (!created) {
      throw new Error('Failed to retrieve created product labor assignment');
    }

    return created;
  }

  /**
   * Update a product labor assignment
   */
  async updateAssignment(
    assignmentId: string,
    updates: {
      entryMode?: 'per_batch' | 'per_unit';
      hoursPerBatch?: string;
      batchSize?: string;
      hoursPerUnit?: string;
      notes?: string | null;
    },
    deviceId: string
  ): Promise<CPGProductLabor> {
    // Get current assignment
    const current = await this.db.cpgProductLabors.get(assignmentId);
    if (!current || current.deleted_at !== null) {
      throw new Error('Product labor assignment not found');
    }

    // Build update object
    const updateData: Partial<CPGProductLabor> = {
      updated_at: Date.now(),
    };

    if (updates.notes !== undefined) updateData.notes = updates.notes;

    // Handle entry mode changes
    const newEntryMode = updates.entryMode || current.entry_mode;
    updateData.entry_mode = newEntryMode;

    if (newEntryMode === 'per_batch') {
      const hoursPerBatch = updates.hoursPerBatch || current.hours_per_batch || '0';
      const batchSize = updates.batchSize || current.batch_size || '0';
      updateData.hours_per_batch = hoursPerBatch;
      updateData.batch_size = batchSize;
      updateData.hours_per_unit = calculateHoursPerUnit(hoursPerBatch, batchSize);
    } else {
      updateData.hours_per_unit = updates.hoursPerUnit || current.hours_per_unit || '0';
      updateData.hours_per_batch = null;
      updateData.batch_size = null;
    }

    // Update version vector
    const versionVector = { ...current.version_vector };
    versionVector[deviceId] = (versionVector[deviceId] || 0) + 1;
    updateData.version_vector = versionVector;

    // Validate the updated assignment
    const existingAssignments = await this.getProductAssignments(current.finished_product_id);
    const mergedAssignment = { ...current, ...updateData };
    const errors = validateCPGProductLabor(mergedAssignment, existingAssignments);
    if (errors.length > 0) {
      throw new Error(`Invalid product labor assignment: ${errors.join(', ')}`);
    }

    // Apply updates
    await this.db.cpgProductLabors.update(assignmentId, updateData);

    // Return updated assignment
    const updated = await this.db.cpgProductLabors.get(assignmentId);
    if (!updated) {
      throw new Error('Failed to retrieve updated product labor assignment');
    }

    return updated;
  }

  /**
   * Remove a labor role assignment from a product (soft delete)
   */
  async removeAssignment(assignmentId: string, deviceId: string): Promise<void> {
    const assignment = await this.db.cpgProductLabors.get(assignmentId);
    if (!assignment) {
      throw new Error('Product labor assignment not found');
    }

    // Update version vector
    const versionVector = { ...assignment.version_vector };
    versionVector[deviceId] = (versionVector[deviceId] || 0) + 1;

    // Soft delete
    await this.db.cpgProductLabors.update(assignmentId, {
      deleted_at: Date.now(),
      updated_at: Date.now(),
      version_vector: versionVector,
    });
  }

  // ============================================================================
  // Labor Cost Calculations
  // ============================================================================

  /**
   * Calculate total labor cost per unit for a product
   */
  async calculateProductLaborCost(productId: string): Promise<{
    totalLaborCostPerUnit: string;
    breakdown: Array<{
      roleId: string;
      roleName: string;
      hoursPerUnit: string;
      hourlyRate: string;
      costPerUnit: string;
    }>;
  }> {
    // Get all assignments for this product
    const assignments = await this.getProductAssignments(productId);

    if (assignments.length === 0) {
      return {
        totalLaborCostPerUnit: '0.00',
        breakdown: [],
      };
    }

    // Calculate cost for each assignment
    const breakdown: Array<{
      roleId: string;
      roleName: string;
      hoursPerUnit: string;
      hourlyRate: string;
      costPerUnit: string;
    }> = [];

    let totalCost = 0;

    for (const assignment of assignments) {
      // Get the labor role
      const role = await this.getRole(assignment.labor_role_id);
      if (!role) continue;

      const hoursPerUnit = assignment.hours_per_unit || '0';
      const hourlyRate = this.getEffectiveHourlyRate(role);
      const costPerUnit = calculateLaborCostPerUnit(hoursPerUnit, hourlyRate);

      breakdown.push({
        roleId: role.id,
        roleName: role.role_name,
        hoursPerUnit,
        hourlyRate,
        costPerUnit,
      });

      totalCost += parseFloat(costPerUnit);
    }

    return {
      totalLaborCostPerUnit: totalCost.toFixed(2),
      breakdown,
    };
  }

  /**
   * Get labor cost breakdown for multiple products
   */
  async calculateMultipleProductLaborCosts(productIds: string[]): Promise<
    Record<
      string,
      {
        totalLaborCostPerUnit: string;
        breakdown: Array<{
          roleId: string;
          roleName: string;
          hoursPerUnit: string;
          hourlyRate: string;
          costPerUnit: string;
        }>;
      }
    >
  > {
    const results: Record<string, any> = {};

    for (const productId of productIds) {
      results[productId] = await this.calculateProductLaborCost(productId);
    }

    return results;
  }
}
