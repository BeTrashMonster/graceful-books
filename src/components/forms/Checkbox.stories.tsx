import type { Meta, StoryObj } from '@storybook/react'
import { Checkbox } from './Checkbox'

/**
 * Checkbox component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Keyboard navigation (Space to toggle)
 * - Focus indicators with 3:1 contrast
 * - Bounce animation on check
 * - Screen reader support
 * - Touch-friendly targets (44x44px)
 * - Indeterminate state support
 */
const meta: Meta<typeof Checkbox> = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Checked state',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    required: {
      control: 'boolean',
      description: 'Required field',
    },
    indeterminate: {
      control: 'boolean',
      description: 'Indeterminate state',
    },
  },
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  args: {
    label: 'I agree to the terms and conditions',
  },
}

export const Checked: Story = {
  args: {
    label: 'Checked checkbox',
    checked: true,
  },
}

export const WithHelperText: Story = {
  args: {
    label: 'Enable notifications',
    helperText: 'Receive updates about your account',
  },
}

export const Required: Story = {
  args: {
    label: 'I agree to the privacy policy',
    required: true,
  },
}

export const WithError: Story = {
  args: {
    label: 'Accept terms',
    error: 'You must accept the terms to continue',
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled checkbox',
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  args: {
    label: 'Disabled and checked',
    disabled: true,
    checked: true,
  },
}

export const Indeterminate: Story = {
  args: {
    label: 'Select all',
    indeterminate: true,
  },
}

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" checked />
      <Checkbox label="Indeterminate" indeterminate />
      <Checkbox label="With helper text" helperText="Additional information" />
      <Checkbox label="With error" error="This field is required" />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled checked" disabled checked />
    </div>
  ),
}
