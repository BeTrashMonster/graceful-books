import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './Input'

/**
 * Input component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Screen reader support with proper ARIA labels
 * - Error and success state announcements
 * - Required field indicators
 * - Icon support
 * - Character counter
 * - Focus indicators with 3:1 contrast
 * - Validation feedback
 */
const meta: Meta<typeof Input> = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url'],
      description: 'Input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    required: {
      control: 'boolean',
      description: 'Required field',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Full width input',
    },
  },
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
  },
}

export const WithHelperText: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    helperText: "We'll never share your email with anyone else.",
    type: 'email',
  },
}

export const Required: Story = {
  args: {
    label: 'Full Name',
    placeholder: 'Enter your name',
    required: true,
  },
}

export const WithError: Story = {
  args: {
    label: 'Password',
    type: 'password',
    error: 'Password must be at least 8 characters',
    defaultValue: 'short',
  },
}

export const WithSuccess: Story = {
  args: {
    label: 'Username',
    success: 'Username is available!',
    defaultValue: 'john_doe',
  },
}

export const WithIconBefore: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search...',
    iconBefore: '🔍',
  },
}

export const WithIconAfter: Story = {
  args: {
    label: 'Password',
    type: 'password',
    iconAfter: '👁️',
  },
}

export const WithCharCount: Story = {
  args: {
    label: 'Bio',
    placeholder: 'Tell us about yourself',
    maxLength: 100,
    showCharCount: true,
  },
}

export const Disabled: Story = {
  args: {
    label: 'Disabled Field',
    defaultValue: 'Cannot edit this',
    disabled: true,
  },
}

export const FullWidth: Story = {
  args: {
    label: 'Full Width Input',
    placeholder: 'This input takes full width',
    fullWidth: true,
  },
}

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
      <Input label="Normal" placeholder="Normal state" />
      <Input label="Required" required placeholder="Required field" />
      <Input label="With Error" error="This field is required" />
      <Input label="With Success" success="Looks good!" defaultValue="Valid input" />
      <Input label="Disabled" disabled defaultValue="Disabled input" />
    </div>
  ),
}
