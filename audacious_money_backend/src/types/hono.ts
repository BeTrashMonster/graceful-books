/**
 * Type extensions for Hono Context
 *
 * Extends the Hono context with custom variables used throughout the application
 */

import type { Pool } from 'pg';
import type { Permission } from '../config/permissions.js';

/**
 * Custom variables that can be set in the Hono context
 */
export type HonoVariables = {
  db: Pool;
  validatedData: any;
  validatedQuery: any;
  validatedParams: any;
  userId: string;
  userEmail: string;
  adminId: string;
  adminEmail: string;
  adminRole: string;
  adminPermissions: Permission[] | ['*'];
  jwtPayload: any;
};

/**
 * Extended Hono environment type
 */
export type HonoEnv = {
  Variables: HonoVariables;
};
