/**
 * Checklist Page
 *
 * Per CHECK-001 and CHECK-002: Main page for personalized checklist
 * with interactive UI, progress tracking, and streak display.
 *
 * This page integrates with C3 (Checklist Generation) for data.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Breadcrumbs } from '../components/navigation/Breadcrumbs'
import { ChecklistView } from '../components/checklist/ChecklistView'
import type { ChecklistProfile } from '../types/checklist.types'

/**
 * Main Checklist page component
 */
export default function Checklist() {
  const navigate = useNavigate()

  // TODO: Replace with actual data from C3 (Checklist Generation)
  // This is mock data for demonstration
  const [isLoading] = useState(false)
  const [profile] = useState<ChecklistProfile | null>(getMockChecklistProfile())

  // Handle item completion
  const handleCompleteItem = useCallback((itemId: string) => {
    // TODO: Implement actual completion logic with database
    console.log('Completing item:', itemId)
  }, [])

  // Handle item uncompletion
  const handleUncompleteItem = useCallback((itemId: string) => {
    // TODO: Implement actual uncompletion logic
    console.log('Uncompleting item:', itemId)
  }, [])

  // Handle snooze
  const handleSnoozeItem = useCallback((itemId: string, until: Date, reason?: string) => {
    // TODO: Implement actual snooze logic
    console.log('Snoozing item:', itemId, 'until:', until, 'reason:', reason)
  }, [])

  // Handle mark not applicable
  const handleMarkNotApplicable = useCallback((itemId: string, reason: string) => {
    // TODO: Implement actual not applicable logic
    console.log('Marking not applicable:', itemId, 'reason:', reason)
  }, [])

  // Handle delete custom item
  const handleDeleteCustomItem = useCallback((itemId: string) => {
    // TODO: Implement actual delete logic
    console.log('Deleting custom item:', itemId)
  }, [])

  // Handle feature link click
  const handleFeatureLinkClick = useCallback(
    (link: string) => {
      navigate(link)
    },
    [navigate],
  )

  return (
    <div className="page">
      <Breadcrumbs />

      <ChecklistView
        profile={profile}
        isLoading={isLoading}
        onCompleteItem={handleCompleteItem}
        onUncompleteItem={handleUncompleteItem}
        onSnoozeItem={handleSnoozeItem}
        onMarkNotApplicable={handleMarkNotApplicable}
        onDeleteCustomItem={handleDeleteCustomItem}
        onFeatureLinkClick={handleFeatureLinkClick}
        enableAnimations={true}
      />
    </div>
  )
}

// =============================================================================
// Mock Data (TODO: Remove when C3 is implemented)
// =============================================================================

function getMockChecklistProfile(): ChecklistProfile {
  const now = new Date()

  return {
    id: 'checklist-1',
    userId: 'user-1',
    companyId: 'company-1',
    assessmentProfileId: 'assessment-1',
    phase: 'stabilize',
    businessType: 'service',
    literacyLevel: 'developing',
    categories: [
      {
        id: 'cat-1',
        name: 'Foundation Building',
        description: 'One-time setup tasks to get your financial foundation in place',
        type: 'foundation',
        order: 1,
        totalItems: 5,
        completedItems: 2,
        percentComplete: 40,
        items: [
          {
            id: 'item-1',
            categoryId: 'cat-1',
            title: 'Open dedicated business bank account',
            description:
              'Separate your business finances from personal to simplify tracking and tax time',
            explanationLevel: 'detailed',
            status: 'completed',
            completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: null,
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'high',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-2',
            categoryId: 'cat-1',
            title: 'Gather last 3 months of bank statements',
            description: 'Collect your recent financial history to establish a baseline',
            explanationLevel: 'detailed',
            status: 'completed',
            completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: null,
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'high',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-3',
            categoryId: 'cat-1',
            title: 'Set up chart of accounts (guided)',
            description: 'Create categories for tracking income and expenses',
            explanationLevel: 'detailed',
            status: 'active',
            completedAt: null,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: '/chart-of-accounts',
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'high',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-4',
            categoryId: 'cat-1',
            title: 'Enter opening balances',
            description: 'Record your starting financial position',
            explanationLevel: 'detailed',
            status: 'active',
            completedAt: null,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: '/chart-of-accounts',
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'high',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-5',
            categoryId: 'cat-1',
            title: 'Categorize 50 transactions',
            description: 'Practice categorizing to learn your expense patterns',
            explanationLevel: 'detailed',
            status: 'active',
            completedAt: null,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: '/transactions',
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'once',
            priority: 'medium',
            lastDueDate: null,
            nextDueDate: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      {
        id: 'cat-2',
        name: 'Weekly Maintenance',
        description: 'Tasks to complete every week to keep your books up-to-date',
        type: 'weekly',
        order: 2,
        totalItems: 3,
        completedItems: 1,
        percentComplete: 33,
        items: [
          {
            id: 'item-6',
            categoryId: 'cat-2',
            title: 'Categorize new transactions',
            description:
              "Review and categorize this week's income and expenses (15-30 min)",
            explanationLevel: 'brief',
            status: 'active',
            completedAt: null,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: '/transactions',
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'weekly',
            priority: 'high',
            lastDueDate: null,
            nextDueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-7',
            categoryId: 'cat-2',
            title: 'File receipts',
            description: 'Upload or scan receipts for your expenses this week',
            explanationLevel: 'brief',
            status: 'snoozed',
            completedAt: null,
            snoozedUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            snoozedReason: 'Waiting for receipts to arrive',
            notApplicableReason: null,
            featureLink: null,
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'weekly',
            priority: 'medium',
            lastDueDate: null,
            nextDueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'item-8',
            categoryId: 'cat-2',
            title: 'Review cash position',
            description: 'Check your bank balance and upcoming obligations',
            explanationLevel: 'brief',
            status: 'active',
            completedAt: null,
            snoozedUntil: null,
            snoozedReason: null,
            notApplicableReason: null,
            featureLink: '/dashboard',
            helpArticle: null,
            isCustom: false,
            isReordered: false,
            customOrder: null,
            recurrence: 'weekly',
            priority: 'medium',
            lastDueDate: null,
            nextDueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    ],
    streaks: {
      weekly: {
        current: 3,
        longest: 5,
        lastCompleted: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        isActiveThisWeek: true,
      },
      monthly: {
        current: 1,
        longest: 1,
        lastCompleted: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
        isActiveThisMonth: true,
      },
      encouragement: "3 weeks in a row! You're building real momentum.",
    },
    milestones: [],
    createdAt: now,
    updatedAt: now,
    generatedAt: now,
  }
}
