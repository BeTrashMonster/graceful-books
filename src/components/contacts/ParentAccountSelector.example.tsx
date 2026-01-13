/**
 * ParentAccountSelector Usage Examples
 *
 * This file demonstrates various usage patterns for the ParentAccountSelector component.
 */

import { useState } from 'react'
import { ParentAccountSelector } from './ParentAccountSelector'
import type { Contact } from '../../types/database.types'

/**
 * Example 1: Basic Usage in Contact Form
 *
 * Shows the most common use case - adding parent selection to a contact form.
 */
export function BasicContactFormExample() {
  const [contact, setContact] = useState<Partial<Contact>>({
    name: 'New Contact',
    parent_id: null,
    company_id: 'company-123',
    // ... other fields
  })

  const handleParentChange = (parentId: string | null) => {
    setContact(prev => ({ ...prev, parent_id: parentId }))
  }

  return (
    <form>
      <div>
        <label htmlFor="contact-name">Contact Name</label>
        <input
          id="contact-name"
          type="text"
          value={contact.name || ''}
          onChange={e => setContact(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      {/* Parent Account Selector */}
      <ParentAccountSelector
        value={contact.parent_id || null}
        onChange={handleParentChange}
        currentContactId={contact.id || 'new'}
        companyId={contact.company_id || ''}
      />

      <button type="submit">Save Contact</button>
    </form>
  )
}

/**
 * Example 2: With Validation and Error Handling
 *
 * Shows how to handle validation errors and display custom error messages.
 */
export function ContactFormWithValidationExample() {
  const [contact, setContact] = useState<Partial<Contact>>({
    name: 'New Contact',
    parent_id: null,
    company_id: 'company-123',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const handleParentChange = (parentId: string | null) => {
    setContact(prev => ({ ...prev, parent_id: parentId }))
    // Clear error when user makes a change
    setFormErrors(prev => {
      const { parent_id, ...rest } = prev
      return rest
    })
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!contact.name) {
      errors.name = 'Contact name is required'
    }

    // Custom validation logic
    if (contact.parent_id && contact.parent_id === contact.id) {
      errors.parent_id = 'A contact cannot be its own parent'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      // Submit form
      console.log('Submitting contact:', contact)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="contact-name">Contact Name</label>
        <input
          id="contact-name"
          type="text"
          value={contact.name || ''}
          onChange={e => setContact(prev => ({ ...prev, name: e.target.value }))}
        />
        {formErrors.name && <span role="alert">{formErrors.name}</span>}
      </div>

      <ParentAccountSelector
        value={contact.parent_id || null}
        onChange={handleParentChange}
        currentContactId={contact.id || 'new'}
        companyId={contact.company_id || ''}
        error={formErrors.parent_id}
      />

      <button type="submit">Save Contact</button>
    </form>
  )
}

/**
 * Example 3: With Custom Helper Text
 *
 * Shows how to provide custom helper text for user guidance.
 */
export function ContactFormWithCustomHelpTextExample() {
  const [contact, setContact] = useState<Partial<Contact>>({
    name: 'Regional Office',
    parent_id: null,
    company_id: 'company-123',
  })

  return (
    <form>
      <ParentAccountSelector
        value={contact.parent_id || null}
        onChange={parentId => setContact(prev => ({ ...prev, parent_id: parentId }))}
        currentContactId={contact.id || 'new'}
        companyId={contact.company_id || ''}
        helperText="For multi-location businesses: Link this location to its headquarters"
      />
    </form>
  )
}

/**
 * Example 4: Excluding Specific Contacts
 *
 * Shows how to exclude specific contacts from the parent selection list.
 */
export function ContactFormWithExclusionsExample() {
  const [contact, setContact] = useState<Partial<Contact>>({
    name: 'New Contact',
    parent_id: null,
    company_id: 'company-123',
  })

  // IDs of contacts to exclude (e.g., inactive, archived, or restricted contacts)
  const excludedContactIds = ['contact-archived-1', 'contact-archived-2']

  return (
    <form>
      <ParentAccountSelector
        value={contact.parent_id || null}
        onChange={parentId => setContact(prev => ({ ...prev, parent_id: parentId }))}
        currentContactId={contact.id || 'new'}
        companyId={contact.company_id || ''}
        excludeIds={excludedContactIds}
      />
    </form>
  )
}

/**
 * Example 5: Expanded by Default
 *
 * Shows how to display the selector expanded by default for power users.
 */
export function ContactFormExpandedByDefaultExample() {
  const [contact, setContact] = useState<Partial<Contact>>({
    name: 'New Contact',
    parent_id: null,
    company_id: 'company-123',
  })

  return (
    <form>
      <ParentAccountSelector
        value={contact.parent_id || null}
        onChange={parentId => setContact(prev => ({ ...prev, parent_id: parentId }))}
        currentContactId={contact.id || 'new'}
        companyId={contact.company_id || ''}
        defaultExpanded={true}
      />
    </form>
  )
}

/**
 * Example 6: Disabled State
 *
 * Shows how to disable the selector (e.g., during form submission).
 */
export function ContactFormDisabledExample() {
  const [contact, setContact] = useState<Partial<Contact>>({
    name: 'New Contact',
    parent_id: null,
    company_id: 'company-123',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('Contact saved:', contact)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="contact-name">Contact Name</label>
        <input
          id="contact-name"
          type="text"
          value={contact.name || ''}
          onChange={e => setContact(prev => ({ ...prev, name: e.target.value }))}
          disabled={isSubmitting}
        />
      </div>

      <ParentAccountSelector
        value={contact.parent_id || null}
        onChange={parentId => setContact(prev => ({ ...prev, parent_id: parentId }))}
        currentContactId={contact.id || 'new'}
        companyId={contact.company_id || ''}
        disabled={isSubmitting}
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Contact'}
      </button>
    </form>
  )
}

/**
 * Example 7: Multi-Step Wizard
 *
 * Shows usage in a multi-step form wizard.
 */
export function ContactWizardExample() {
  const [step, setStep] = useState(1)
  const [contact, setContact] = useState<Partial<Contact>>({
    name: '',
    parent_id: null,
    company_id: 'company-123',
  })

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  return (
    <div>
      <h2>Add New Contact - Step {step} of 3</h2>

      {step === 1 && (
        <div>
          <h3>Basic Information</h3>
          <input
            type="text"
            placeholder="Contact Name"
            value={contact.name || ''}
            onChange={e =>
              setContact(prev => ({ ...prev, name: e.target.value }))
            }
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Contact Details</h3>
          <input
            type="email"
            placeholder="Email"
            value={contact.email || ''}
            onChange={e =>
              setContact(prev => ({ ...prev, email: e.target.value }))
            }
          />
        </div>
      )}

      {step === 3 && (
        <div>
          <h3>Advanced Settings</h3>
          <ParentAccountSelector
            value={contact.parent_id || null}
            onChange={parentId =>
              setContact(prev => ({ ...prev, parent_id: parentId }))
            }
            currentContactId={contact.id || 'new'}
            companyId={contact.company_id || ''}
            defaultExpanded={true}
          />
        </div>
      )}

      <div>
        {step > 1 && <button onClick={handleBack}>Back</button>}
        {step < 3 ? (
          <button onClick={handleNext}>Next</button>
        ) : (
          <button onClick={() => console.log('Submit:', contact)}>
            Create Contact
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Example 8: Integration with Form Library (React Hook Form)
 *
 * Shows how to integrate with popular form libraries.
 */
export function ContactFormWithReactHookFormExample() {
  // Note: This is a conceptual example. In real usage, import from 'react-hook-form'
  const useForm = () => ({
    register: (_name: string, _options?: any) => ({}),
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault()
      fn({ name: 'Test', parent_id: null })
    },
    formState: { errors: {} as any },
    setValue: (_name: string, _value: any) => {},
    watch: (_name: string) => null as any,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm()

  const parentId = watch('parent_id')

  const onSubmit = (data: any) => {
    console.log('Form submitted:', data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="name">Contact Name</label>
        <input id="name" {...register('name', { required: true })} />
        {errors.name && <span>This field is required</span>}
      </div>

      <ParentAccountSelector
        value={parentId}
        onChange={value => setValue('parent_id', value)}
        currentContactId="current-contact-id"
        companyId="company-123"
        error={errors.parent_id?.message as string}
      />

      <button type="submit">Submit</button>
    </form>
  )
}
