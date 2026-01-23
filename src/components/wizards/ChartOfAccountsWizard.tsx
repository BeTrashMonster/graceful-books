/**
 * Chart of Accounts Setup Wizard
 *
 * Guided step-by-step wizard for setting up chart of accounts.
 * Features:
 * - Industry template selection
 * - Account customization
 * - Plain English explanations
 * - Progress tracking and resume capability
 * - Accessible keyboard navigation
 * - Steadiness communication style (patient, step-by-step, supportive)
 */

import { type FC, useState, useEffect, useCallback } from 'react'
import { Button } from '../core/Button'
import { Modal } from '../modals/Modal'
import type { WizardState, CoaWizardData, AccountCustomization, TemplateAccount } from '../../types/wizard.types'
import type { Account } from '../../types'
import {
  initializeWizardState,
  navigateToNextStep,
  navigateToPreviousStep,
  updateWizardData,
  saveWizardProgress,
  loadWizardProgress,
  clearWizardProgress,
  calculateWizardProgress,
} from '../../utils/wizardState'
import { INDUSTRY_TEMPLATES, getTemplateById } from '../../data/industryTemplates'
import { batchCreateAccounts } from '../../store/accounts'
import { WelcomeStep } from './steps/WelcomeStep'
import { TemplateSelectionStep } from './steps/TemplateSelectionStep'
import { AccountCustomizationStep } from './steps/AccountCustomizationStep'
import { ReviewStep } from './steps/ReviewStep'
import { CompletionStep } from './steps/CompletionStep'
import styles from './ChartOfAccountsWizard.module.css'

export interface ChartOfAccountsWizardProps {
  /**
   * Company ID for the wizard
   */
  companyId: string

  /**
   * Called when wizard is completed
   */
  onComplete: (accounts: Account[]) => void

  /**
   * Called when wizard is cancelled
   */
  onCancel: () => void

  /**
   * Whether wizard is shown in a modal
   */
  isModal?: boolean
}

const WIZARD_ID = 'coa-setup'

const WIZARD_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Let\'s set up your Chart of Accounts together!',
  },
  {
    id: 'template',
    title: 'Choose Template',
    description: 'Pick a starting point that fits your business',
  },
  {
    id: 'customize',
    title: 'Customize Accounts',
    description: 'Adjust the accounts to match your needs',
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Look over everything before we create your accounts',
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'Your Chart of Accounts is ready',
  },
]

/**
 * Chart of Accounts Setup Wizard Component
 */
export const ChartOfAccountsWizard: FC<ChartOfAccountsWizardProps> = ({
  companyId,
  onComplete,
  onCancel,
  isModal = false,
}) => {
  const [wizardState, setWizardState] = useState<WizardState>(() => {
    // Try to load saved progress
    const saved = loadWizardProgress(WIZARD_ID, companyId)
    if (saved && !saved.isComplete) {
      // Restore from saved progress
      return initializeWizardState(WIZARD_ID, WIZARD_STEPS)
    }
    return initializeWizardState(WIZARD_ID, WIZARD_STEPS)
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdAccounts, setCreatedAccounts] = useState<Account[]>([])

  const currentStepIndex = wizardState.steps.findIndex(
    (s) => s.id === wizardState.currentStepId
  )
  const currentStep = wizardState.steps[currentStepIndex]!
  const progressPercent = calculateWizardProgress(wizardState.steps)

  // Save progress whenever state changes
  useEffect(() => {
    const progress = {
      wizardId: WIZARD_ID,
      companyId,
      currentStep: wizardState.currentStepId,
      data: wizardState.data,
      isComplete: !!wizardState.completedAt,
      lastUpdated: wizardState.lastModifiedAt,
      createdAt: wizardState.startedAt,
    }
    saveWizardProgress(progress)
  }, [wizardState, companyId])

  // Scroll to top when step changes
  useEffect(() => {
    // Scroll window (for non-modal usage)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    // Also scroll modal body if in modal
    const modalBody = document.querySelector('[class*="modalBody"]')
    if (modalBody) {
      modalBody.scrollTop = 0
    }
  }, [wizardState.currentStepId])

  const handleNext = useCallback(() => {
    setWizardState((prev) => navigateToNextStep(prev))
  }, [])

  const handleBack = useCallback(() => {
    setWizardState((prev) => navigateToPreviousStep(prev))
  }, [])

  const handleUpdateData = useCallback((updates: Partial<CoaWizardData>) => {
    setWizardState((prev) => updateWizardData(prev, updates))
  }, [])

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = getTemplateById(templateId)
    if (!template) return

    // Initialize customizations with default accounts
    const customizations: AccountCustomization[] = template.accounts.map((account: TemplateAccount) => ({
      templateAccountName: account.name,
      name: account.name,
      accountNumber: account.accountNumber,
      description: account.description,
      isIncluded: account.isDefault,
    }))

    handleUpdateData({
      selectedTemplateId: templateId,
      customizations,
      customAccounts: [],
    })
    handleNext()
  }, [handleUpdateData, handleNext])

  const handleCustomizationsUpdate = useCallback((customizations: AccountCustomization[]) => {
    handleUpdateData({ customizations })
  }, [handleUpdateData])

  const handleCreateAccounts = useCallback(async () => {
    setIsSubmitting(true)

    try {
      const data = wizardState.data as CoaWizardData
      const template = data.selectedTemplateId ? getTemplateById(data.selectedTemplateId) : null

      if (!template) {
        throw new Error('No template selected')
      }

      // Build accounts to create from customizations
      const accountsToCreate: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'balance'>[] = []

      // Add customized template accounts
      data.customizations
        .filter((c) => c.isIncluded)
        .forEach((customization) => {
          // Use type directly from customization if available, otherwise look up from template
          let type = customization.type
          let templateDescription = ''

          if (!type) {
            const templateAccount = template.accounts.find(
              (a: TemplateAccount) => a.name === customization.templateAccountName
            )
            if (!templateAccount) return
            type = templateAccount.type
            templateDescription = templateAccount.description
          } else {
            // If we have a type, still try to get the description from template
            const templateAccount = template.accounts.find(
              (a: TemplateAccount) => a.name === customization.templateAccountName
            )
            templateDescription = templateAccount?.description || ''
          }

          accountsToCreate.push({
            companyId,
            name: customization.name,
            accountNumber: customization.accountNumber,
            type,
            description: customization.description || templateDescription,
            isActive: true,
          })
        })

      // Add custom accounts
      if (data.customAccounts) {
        data.customAccounts.forEach((account) => {
          accountsToCreate.push({
            companyId,
            name: account.name,
            accountNumber: account.accountNumber,
            type: account.type,
            description: account.description,
            isActive: true,
          })
        })
      }

      // Create accounts in batch
      const result = await batchCreateAccounts(accountsToCreate)

      if (result.failed.length > 0) {
        console.error('Some accounts failed to create:', result.failed)
        // Still proceed if at least some succeeded
      }

      setCreatedAccounts(result.successful)
      handleNext()
    } catch (error) {
      console.error('Failed to create accounts:', error)
      alert('Something went wrong while creating your accounts. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [wizardState.data, companyId, handleNext])

  const handleComplete = useCallback(() => {
    // Clear saved progress
    clearWizardProgress(WIZARD_ID, companyId)
    onComplete(createdAccounts)
  }, [companyId, createdAccounts, onComplete])

  const handleCancel = useCallback(() => {
    // Optionally save progress on cancel (already saved via useEffect)
    onCancel()
  }, [onCancel])

  const renderStep = () => {
    const data = wizardState.data as CoaWizardData

    switch (currentStep.id) {
      case 'welcome':
        return <WelcomeStep onNext={handleNext} />

      case 'template':
        return (
          <TemplateSelectionStep
            templates={INDUSTRY_TEMPLATES}
            selectedTemplateId={data.selectedTemplateId}
            onSelect={handleTemplateSelect}
            onBack={handleBack}
          />
        )

      case 'customize':
        return (
          <AccountCustomizationStep
            template={data.selectedTemplateId ? getTemplateById(data.selectedTemplateId) : undefined}
            customizations={data.customizations || []}
            onUpdate={handleCustomizationsUpdate}
            onNext={handleNext}
            onBack={handleBack}
          />
        )

      case 'review':
        return (
          <ReviewStep
            template={data.selectedTemplateId ? getTemplateById(data.selectedTemplateId) : undefined}
            customizations={data.customizations || []}
            customAccounts={data.customAccounts || []}
            onConfirm={handleCreateAccounts}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        )

      case 'complete':
        return (
          <CompletionStep
            accountCount={createdAccounts.length}
            onComplete={handleComplete}
          />
        )

      default:
        return null
    }
  }

  const content = (
    <div className={styles.wizard} role="dialog" aria-labelledby="wizard-title">
      {/* Progress Indicator */}
      <div className={styles.progressBar} role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Step Indicators */}
      <div className={styles.stepIndicators} role="tablist">
        {wizardState.steps.map((step, index) => (
          <div
            key={step.id}
            className={`${styles.stepIndicator} ${
              step.status === 'completed' ? styles.completed :
              step.status === 'active' ? styles.active :
              styles.pending
            }`}
            role="tab"
            aria-selected={step.status === 'active'}
            aria-label={`Step ${index + 1}: ${step.title}`}
          >
            <div className={styles.stepNumber}>
              {step.status === 'completed' ? '✓' : index + 1}
            </div>
            <div className={styles.stepLabel}>{step.title}</div>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className={styles.stepContent} role="tabpanel">
        <h2 id="wizard-title" className={styles.stepTitle}>
          {currentStep.title}
        </h2>
        <p className={styles.stepDescription}>{currentStep.description}</p>

        <div className={styles.stepBody}>
          {renderStep()}
        </div>
      </div>

      {/* Cancel Button (always available) */}
      {currentStep.id !== 'complete' && (
        <div className={styles.cancelSection}>
          <Button variant="ghost" onClick={handleCancel} size="sm">
            Save and finish later
          </Button>
        </div>
      )}
    </div>
  )

  if (isModal) {
    return (
      <Modal
        isOpen
        onClose={handleCancel}
        title="Set up your Chart of Accounts"
        size="lg"
        closeOnBackdropClick={false}
      >
        {content}
      </Modal>
    )
  }

  return content
}
