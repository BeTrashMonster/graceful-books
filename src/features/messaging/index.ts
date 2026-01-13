/**
 * Messaging Feature - DISC-Adapted Messages
 *
 * Export all messaging functionality
 */

export { messageLibrary, getMessageById, getAllMessageIds, getMessagesByCategory } from './messageLibrary';
export type { DISCType, MessageVariants, Message, MessageLibrary } from './messageLibrary';

export { getAdaptiveMessage, getMessageVariants, getMessageCompleteness } from './adaptiveMessages';
export type { GetMessageOptions } from './adaptiveMessages';

export { useAdaptiveMessage, useMessage, useMessagePreview } from './useAdaptiveMessage';
