/**
 * useCPGSettings Hook
 *
 * Provides CPG settings throughout the application with automatic formatting utilities.
 *
 * This is now a wrapper around useCPGSettingsContext for backwards compatibility.
 */

import { useCPGSettingsContext } from '../contexts/CPGSettingsContext';

export function useCPGSettings() {
  return useCPGSettingsContext();
}
