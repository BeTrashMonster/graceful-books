/**
 * Chart of Accounts Setup Wizard
 *
 * Per ACCT-001 and D1: Guided multi-step setup for Chart of Accounts.
 * Educational, patient, and step-by-step per Steadiness communication style.
 *
 * Dependencies: B1 (Chart of Accounts CRUD), C3 (Checklist), C5 (Plain English)
 *
 * Joy Opportunities:
 * - "Your first account! This is where the magic of organization begins."
 * - Educational explanations at every step
 * - Celebratory completion message
 */

import React, { useState, useEffect } from 'react'
import type { WizardState, CoaWizardData, AccountCustomization } from '../../types/wizard.types'
import { INDUSTRY_TEMPLATES } from '../../data/industryTemplates'
import {
  initializeWizardState,
  navigateToNextStep,
  navigateToPreviousStep,
  updateWizardData,
  saveWizardProgress,
  loadWizardProgress,
  clearWizardProgress,
} from '../../utils/wizardState'
import { Button } from '../core/Button'
import { Card } from '../ui/Card'
import { HelpTooltip } from '../help/HelpTooltip'

export interface CoaWizardProps {
  companyId: string
  onComplete: (data: CoaWizardData) => void
  onCancel?: () => void
}

/**
 * Wizard steps definition
 */
const WIZARD_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: "Let's set up your Chart of Accounts together",
  },
  {
    id: 'template',
    title: 'Choose Your Template',
    description: 'Pick a starting point that matches your business',
  },
  {
    id: 'customize',
    title: 'Customize Accounts',
    description: 'Review and adjust accounts to fit your needs',
  },
  {
    id: 'review',
    title: 'Review & Confirm',
    description: 'One last look before we create your accounts',
  },
]

const WIZARD_ID = 'coa-setup'

export const CoaWizard: React.FC<CoaWizardProps> = ({
  companyId,
  onComplete,
  onCancel,
}) => {
  const [wizardState, setWizardState] = useState<WizardState>(() => {
    // Try to restore previous progress
    const saved = loadWizardProgress(WIZARD_ID, companyId)
    if (saved) {
      return {
        wizardId: saved.wizardId,
        currentStepId: saved.currentStep,
        steps: WIZARD_STEPS.map((step, index) => ({
          ...step,
          status: step.id === saved.currentStep ? 'active' : index < WIZARD_STEPS.findIndex(s => s.id === saved.currentStep) ? 'completed' : 'pending',
        })),
        data: saved.data,
        startedAt: saved.createdAt,
        lastModifiedAt: saved.lastUpdated,
      }
    }
    return initializeWizardState(WIZARD_ID, WIZARD_STEPS)
  })

  const [wizardData, setWizardData] = useState<CoaWizardData>({
    selectedTemplateId: (wizardState.data.selectedTemplateId as string) || undefined,
    customizations: (wizardState.data.customizations as AccountCustomization[]) || [],
    customAccounts: (wizardState.data.customAccounts as CoaWizardData['customAccounts']) || [],
  })

  // Auto-save progress
  useEffect(() => {
    saveWizardProgress({
      wizardId: WIZARD_ID,
      companyId,
      currentStep: wizardState.currentStepId,
      data: wizardData,
      isComplete: wizardState.completedAt !== undefined,
      lastUpdated: new Date(),
      createdAt: wizardState.startedAt,
    })
  }, [wizardState, wizardData, companyId])

  const currentStepIndex = wizardState.steps.findIndex(
    (s) => s.id === wizardState.currentStepId
  )
  const currentStep = wizardState.steps[currentStepIndex]!
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === wizardState.steps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      // Complete wizard
      onComplete(wizardData)
      clearWizardProgress(WIZARD_ID, companyId)
    } else {
      const nextState = navigateToNextStep(wizardState)
      setWizardState(nextState)
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      const previousState = navigateToPreviousStep(wizardState)
      setWizardState(previousState)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  const updateData = (updates: Partial<CoaWizardData>) => {
    const newData = { ...wizardData, ...updates }
    setWizardData(newData)
    setWizardState(updateWizardData(wizardState, newData))
  }

  // Determine if can proceed
  const canProceed = () => {
    switch (currentStep.id) {
      case 'welcome':
        return true
      case 'template':
        return !!wizardData.selectedTemplateId
      case 'customize':
        return true
      case 'review':
        return true
      default:
        return false
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {wizardState.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : step.status === 'active'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step.status === 'completed' ? '✓' : index + 1}
                </div>
                <div className="mt-2 text-xs text-center text-gray-600">
                  {step.title}
                </div>
              </div>
              {index < wizardState.steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 bg-gray-200 relative top-[-20px]">
                  <div
                    className={`h-full transition-all ${
                      step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentStep.title}
          </h2>
          <p className="text-gray-600">{currentStep.description}</p>
        </div>

        {/* Render step-specific content */}
        {currentStep.id === 'welcome' && (
          <WelcomeStep />
        )}
        {currentStep.id === 'template' && (
          <TemplateSelectionStep
            selectedTemplateId={wizardData.selectedTemplateId}
            onSelect={(templateId) => updateData({ selectedTemplateId: templateId })}
          />
        )}
        {currentStep.id === 'customize' && wizardData.selectedTemplateId && (
          <CustomizeAccountsStep
            templateId={wizardData.selectedTemplateId}
            customizations={wizardData.customizations}
            customAccounts={wizardData.customAccounts}
            onUpdateCustomizations={(customizations) =>
              updateData({ customizations })
            }
            onUpdateCustomAccounts={(customAccounts) =>
              updateData({ customAccounts })
            }
          />
        )}
        {currentStep.id === 'review' && (
          <ReviewStep
            wizardData={wizardData}
            onEdit={(stepId) => {
              const stepIndex = wizardState.steps.findIndex(s => s.id === stepId)
              if (stepIndex !== -1) {
                setWizardState({
                  ...wizardState,
                  currentStepId: stepId,
                  steps: wizardState.steps.map((s, i) => ({
                    ...s,
                    status: i === stepIndex ? 'active' : s.status,
                  })),
                })
              }
            }}
          />
        )}
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <div>
          {!isFirstStep && (
            <Button variant="secondary" onClick={handleBack}>
              Back
            </Button>
          )}
          {isFirstStep && onCancel && (
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
        <Button
          variant="primary"
          onClick={handleNext}
          disabled={!canProceed()}
        >
          {isLastStep ? 'Create My Chart of Accounts' : 'Next'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Welcome Step - Introduction and education
 */
const WelcomeStep: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          What is a Chart of Accounts?
        </h3>
        <p className="text-blue-800 leading-relaxed">
          Think of it as the organizational system for your business finances.
          It's a list of categories (called "accounts") where every dollar you
          earn or spend gets recorded. Don't worry - we'll help you set it up
          step by step!
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Here's what we'll do together:
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-gray-700">
          <li>
            <strong>Choose a template</strong> - We've created starter sets for
            different business types. Pick the one closest to yours.
          </li>
          <li>
            <strong>Customize it</strong> - Add, remove, or rename accounts to
            match your specific needs.
          </li>
          <li>
            <strong>Review</strong> - We'll show you everything before creating
            your accounts.
          </li>
        </ol>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800 text-sm">
          <strong>Good news:</strong> This isn't set in stone! You can always
          add more accounts later as your business grows. We're just creating
          your foundation today.
        </p>
      </div>
    </div>
  )
}

/**
 * Template Selection Step
 */
interface TemplateSelectionStepProps {
  selectedTemplateId?: string
  onSelect: (templateId: string) => void
}

const TemplateSelectionStep: React.FC<TemplateSelectionStepProps> = ({
  selectedTemplateId,
  onSelect,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-gray-700 mb-6">
        <p className="mb-4">
          Each template includes the most common accounts for that business
          type. You'll be able to customize everything in the next step.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INDUSTRY_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className={`text-left p-6 rounded-lg border-2 transition-all ${
              selectedTemplateId === template.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 bg-white'
            }`}
          >
            <div className="flex items-start">
              <div className="text-4xl mr-4">{template.icon}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 mb-1">
                  {template.friendlyName}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {template.description}
                </p>
                <p className="text-xs text-gray-500">
                  {template.accounts.length} accounts included
                </p>
              </div>
              {selectedTemplateId === template.id && (
                <div className="text-blue-500 ml-2">
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
        <div className="flex items-start">
          <HelpTooltip
            title="Not sure which to choose?"
            content="Start with the one that seems closest. You can customize everything in the next step, and you can always change it later!"
          />
          <p className="text-sm text-gray-700 ml-2">
            Not sure which to choose? Start with the one that seems closest.
            You'll customize it in the next step!
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Customize Accounts Step
 * (Placeholder - will create detailed version separately)
 */
interface CustomizeAccountsStepProps {
  templateId: string
  customizations: AccountCustomization[]
  customAccounts: CoaWizardData['customAccounts']
  onUpdateCustomizations: (customizations: AccountCustomization[]) => void
  onUpdateCustomAccounts: (customAccounts: CoaWizardData['customAccounts']) => void
}

const CustomizeAccountsStep: React.FC<CustomizeAccountsStepProps> = ({
  templateId,
  customizations: _customizations,
  customAccounts: _customAccounts,
  onUpdateCustomizations: _onUpdateCustomizations,
  onUpdateCustomAccounts: _onUpdateCustomAccounts,
}) => {
  // This is a simplified version - full implementation in separate component
  const template = INDUSTRY_TEMPLATES.find(t => t.id === templateId)

  if (!template) return null

  return (
    <div className="space-y-6">
      <p className="text-gray-700">
        Here are the accounts we'll create for you. Feel free to customize names
        or remove accounts you don't need. Don't worry - this is just a preview!
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        Full customization interface coming in the next step...
        For now, we'll create all {template.accounts.length} accounts from the template.
      </div>
    </div>
  )
}

/**
 * Review Step
 * (Placeholder - will create detailed version separately)
 */
interface ReviewStepProps {
  wizardData: CoaWizardData
  onEdit: (stepId: string) => void
}

const ReviewStep: React.FC<ReviewStepProps> = ({ wizardData, onEdit: _onEdit }) => {
  const template = INDUSTRY_TEMPLATES.find(t => t.id === wizardData.selectedTemplateId)

  if (!template) return null

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">
          Ready to Create Your Chart of Accounts!
        </h3>
        <p className="text-green-800">
          You've chosen the <strong>{template.friendlyName}</strong> template.
          We'll create {template.accounts.length} accounts to get you started.
        </p>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 mb-3">What happens next:</h4>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>We'll create all the accounts from your template</li>
          <li>They'll be organized by type (Assets, Liabilities, etc.)</li>
          <li>You can start recording transactions immediately</li>
          <li>You can always add more accounts later as you need them</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>First time?</strong> After we create your accounts, we
          recommend exploring the Help Center to learn how to use them
          effectively.
        </p>
      </div>
    </div>
  )
}
