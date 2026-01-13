import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Modal } from './Modal'
import { Button } from '../core/Button'

/**
 * Modal component with WCAG 2.1 AA compliance
 *
 * Features:
 * - Focus trap within modal
 * - Keyboard navigation (Escape to close, Tab cycling)
 * - Screen reader announcements
 * - Backdrop click to close
 * - Return focus to trigger element on close
 * - Body scroll lock when open
 * - Reduced motion support
 */
const meta: Meta<typeof Modal> = {
  title: 'Modals/Modal',
  component: Modal,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', 'full'],
      description: 'Size of the modal',
    },
    showCloseButton: {
      control: 'boolean',
      description: 'Show close button',
    },
    closeOnBackdropClick: {
      control: 'boolean',
      description: 'Close on backdrop click',
    },
    closeOnEscape: {
      control: 'boolean',
      description: 'Close on Escape key',
    },
  },
}

export default meta
type Story = StoryObj<typeof Modal>

const ModalWrapper = (args: any) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export const Default: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    title: 'Default Modal',
    children: 'This is a simple modal with default settings.',
  },
}

export const WithFooter: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    title: 'Confirm Action',
    children: 'Are you sure you want to proceed with this action?',
    footer: (
      <>
        <Button variant="outline">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </>
    ),
  },
}

export const Small: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    title: 'Small Modal',
    size: 'sm',
    children: 'This is a small modal.',
  },
}

export const Large: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    title: 'Large Modal',
    size: 'lg',
    children: 'This is a large modal with more content space.',
  },
}

export const NoTitle: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    children: 'This modal has no title, only a close button.',
  },
}

export const NoCloseButton: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    title: 'No Close Button',
    showCloseButton: false,
    children: 'This modal requires an explicit action to close.',
    footer: <Button variant="primary">Close</Button>,
  },
}

export const LongContent: Story = {
  render: (args: React.ComponentProps<typeof Modal>) => <ModalWrapper {...args} />,
  args: {
    title: 'Modal with Long Content',
    children: (
      <div>
        <p>This modal has scrollable content.</p>
        {Array.from({ length: 20 }, (_, i) => (
          <p key={i}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        ))}
      </div>
    ),
  },
}
