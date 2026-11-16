/**
 * Floating Cards Context
 *
 * PURPOSE:
 * Provides global state for transaction floating cards that persist across
 * page navigation. Cards can be opened from any page and will stay open
 * as the user navigates throughout the app.
 *
 * FEATURES:
 * - Open multiple transaction cards simultaneously
 * - Cards persist across route changes
 * - Each card tracks transaction ID, company ID, and running balance
 * - Automatic staggering for multiple cards
 *
 * @module contexts/FloatingCardsContext
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode
} from 'react'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Information about an open floating card
 */
export interface OpenCard {
  /** Transaction ID */
  transactionId: string
  /** Company ID for data queries */
  companyId: string
  /** Running balance at this transaction (from register view) */
  runningBalance?: number
  /** When the card was opened (for ordering) */
  openedAt: number
}

/**
 * Context value shape
 */
interface FloatingCardsContextValue {
  /** Map of open cards by transaction ID */
  openCards: Map<string, OpenCard>

  /** Open a transaction card */
  openCard: (card: Omit<OpenCard, 'openedAt'>) => void

  /** Close a specific card */
  closeCard: (transactionId: string) => void

  /** Toggle a card open/closed */
  toggleCard: (card: Omit<OpenCard, 'openedAt'>) => void

  /** Close all cards */
  closeAllCards: () => void

  /** Check if a specific card is open */
  isCardOpen: (transactionId: string) => boolean

  /** Get the index of a card (for staggering) */
  getCardIndex: (transactionId: string) => number

  /** Notify that a transaction was updated/voided/deleted */
  notifyTransactionChanged: (transactionId: string) => void

  /** Subscribe to transaction change events */
  subscribeToChanges: (callback: (transactionId: string) => void) => () => void

  /** Set of starred transaction IDs */
  starredTransactions: Set<string>

  /** Toggle star on a transaction */
  toggleStar: (transactionId: string) => void

  /** Check if a transaction is starred */
  isStarred: (transactionId: string) => boolean

  /** Clear all stars */
  clearAllStars: () => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const FloatingCardsContext = createContext<FloatingCardsContextValue | undefined>(undefined)

// =============================================================================
// PROVIDER
// =============================================================================

interface FloatingCardsProviderProps {
  children: ReactNode
}

export function FloatingCardsProvider({ children }: FloatingCardsProviderProps) {
  const [openCards, setOpenCards] = useState<Map<string, OpenCard>>(new Map())
  const [starredTransactions, setStarredTransactions] = useState<Set<string>>(new Set())
  const [changeListeners] = useState<Set<(transactionId: string) => void>>(new Set())

  /**
   * Open a transaction card
   */
  const openCard = useCallback((card: Omit<OpenCard, 'openedAt'>) => {
    setOpenCards(prev => {
      const next = new Map(prev)
      if (!next.has(card.transactionId)) {
        next.set(card.transactionId, {
          ...card,
          openedAt: Date.now(),
        })
      }
      return next
    })
  }, [])

  /**
   * Close a specific card
   */
  const closeCard = useCallback((transactionId: string) => {
    setOpenCards(prev => {
      const next = new Map(prev)
      next.delete(transactionId)
      return next
    })
  }, [])

  /**
   * Toggle a card open/closed
   */
  const toggleCard = useCallback((card: Omit<OpenCard, 'openedAt'>) => {
    setOpenCards(prev => {
      const next = new Map(prev)
      if (next.has(card.transactionId)) {
        next.delete(card.transactionId)
      } else {
        next.set(card.transactionId, {
          ...card,
          openedAt: Date.now(),
        })
      }
      return next
    })
  }, [])

  /**
   * Close all cards
   */
  const closeAllCards = useCallback(() => {
    setOpenCards(new Map())
  }, [])

  /**
   * Check if a specific card is open
   */
  const isCardOpen = useCallback((transactionId: string) => {
    return openCards.has(transactionId)
  }, [openCards])

  /**
   * Get the index of a card for staggering
   */
  const getCardIndex = useCallback((transactionId: string) => {
    const sortedCards = Array.from(openCards.entries())
      .sort((a, b) => a[1].openedAt - b[1].openedAt)

    return sortedCards.findIndex(([id]) => id === transactionId)
  }, [openCards])

  /**
   * Notify that a transaction was changed
   */
  const notifyTransactionChanged = useCallback((transactionId: string) => {
    changeListeners.forEach(listener => listener(transactionId))
  }, [changeListeners])

  /**
   * Subscribe to transaction change events
   */
  const subscribeToChanges = useCallback((callback: (transactionId: string) => void) => {
    changeListeners.add(callback)
    return () => {
      changeListeners.delete(callback)
    }
  }, [changeListeners])

  /**
   * Toggle star on a transaction
   */
  const toggleStar = useCallback((transactionId: string) => {
    setStarredTransactions(prev => {
      const next = new Set(prev)
      if (next.has(transactionId)) {
        next.delete(transactionId)
      } else {
        next.add(transactionId)
      }
      return next
    })
  }, [])

  /**
   * Check if a transaction is starred
   */
  const isStarred = useCallback((transactionId: string) => {
    return starredTransactions.has(transactionId)
  }, [starredTransactions])

  /**
   * Clear all stars
   */
  const clearAllStars = useCallback(() => {
    setStarredTransactions(new Set())
  }, [])

  // ===========================================================================
  // CONTEXT VALUE
  // ===========================================================================

  const value = useMemo<FloatingCardsContextValue>(() => ({
    openCards,
    openCard,
    closeCard,
    toggleCard,
    closeAllCards,
    isCardOpen,
    getCardIndex,
    notifyTransactionChanged,
    subscribeToChanges,
    starredTransactions,
    toggleStar,
    isStarred,
    clearAllStars,
  }), [
    openCards,
    openCard,
    closeCard,
    toggleCard,
    closeAllCards,
    isCardOpen,
    getCardIndex,
    notifyTransactionChanged,
    subscribeToChanges,
    starredTransactions,
    toggleStar,
    isStarred,
    clearAllStars,
  ])

  return (
    <FloatingCardsContext.Provider value={value}>
      {children}
    </FloatingCardsContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access floating cards context
 *
 * @throws Error if used outside FloatingCardsProvider
 *
 * @example
 * const { openCard, closeCard, openCards } = useFloatingCards();
 * openCard({ transactionId: '123', companyId: 'abc', runningBalance: 5000 });
 */
export function useFloatingCards(): FloatingCardsContextValue {
  const context = useContext(FloatingCardsContext)
  if (context === undefined) {
    throw new Error('useFloatingCards must be used within a FloatingCardsProvider')
  }
  return context
}
