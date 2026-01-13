import type { Meta, StoryObj } from '@storybook/react'
import { Loading, LoadingOverlay } from './Loading'

/**
 * Loading component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Multiple loading variants (spinner, dots, pulse)
 * - Screen reader announcements with aria-live
 * - Calm, non-stressful animations
 * - Reduced motion support
 * - Accessible loading states
 */
const meta: Meta<typeof Loading> = {
  title: 'Feedback/Loading',
  component: Loading,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['spinner', 'dots', 'pulse'],
      description: 'Variant of loading indicator',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the loading indicator',
    },
    centered: {
      control: 'boolean',
      description: 'Center the loading indicator',
    },
  },
}

export default meta
type Story = StoryObj<typeof Loading>

export const Spinner: Story = {
  args: {
    variant: 'spinner',
  },
}

export const Dots: Story = {
  args: {
    variant: 'dots',
  },
}

export const Pulse: Story = {
  args: {
    variant: 'pulse',
  },
}

export const WithMessage: Story = {
  args: {
    variant: 'spinner',
    message: 'Loading your data...',
  },
}

export const Small: Story = {
  args: {
    variant: 'spinner',
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    variant: 'spinner',
    size: 'lg',
  },
}

export const Centered: Story = {
  args: {
    variant: 'spinner',
    centered: true,
    message: 'Please wait...',
  },
}

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h3>Spinner</h3>
        <Loading variant="spinner" message="Loading..." />
      </div>
      <div>
        <h3>Dots</h3>
        <Loading variant="dots" message="Processing..." />
      </div>
      <div>
        <h3>Pulse</h3>
        <Loading variant="pulse" message="Please wait..." />
      </div>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
      <div>
        <h4>Small</h4>
        <Loading variant="spinner" size="sm" />
      </div>
      <div>
        <h4>Medium</h4>
        <Loading variant="spinner" size="md" />
      </div>
      <div>
        <h4>Large</h4>
        <Loading variant="spinner" size="lg" />
      </div>
    </div>
  ),
}

// LoadingOverlay stories
export const Overlay: Story = {
  render: () => (
    <div style={{ position: 'relative', height: '300px', border: '1px solid #ccc' }}>
      <p>Content behind the overlay</p>
      <LoadingOverlay isVisible={true} message="Loading..." />
    </div>
  ),
}
