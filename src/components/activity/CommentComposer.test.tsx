import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentComposer } from './CommentComposer'

// Mock the database
vi.mock('../../db/database', () => ({
  db: {
    companyUsers: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    },
    users: {
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          and: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    },
  },
}))

describe('CommentComposer', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    companyId: 'company-123',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render textarea with placeholder', () => {
    render(<CommentComposer {...defaultProps} />)

    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
  })

  it('should render submit button disabled when empty', () => {
    render(<CommentComposer {...defaultProps} />)

    const submitButton = screen.getByRole('button', { name: /submit comment/i })
    expect(submitButton).toBeDisabled()
  })

  it('should enable submit button when text is entered', async () => {
    const user = userEvent.setup()
    render(<CommentComposer {...defaultProps} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i })
    await user.type(textarea, 'This is a test comment')

    const submitButton = screen.getByRole('button', { name: /submit comment/i })
    expect(submitButton).toBeEnabled()
  })

  it('should call onSubmit with content when submitted', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn()

    render(<CommentComposer {...defaultProps} onSubmit={handleSubmit} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i })
    await user.type(textarea, 'Test comment')

    const submitButton = screen.getByRole('button', { name: /submit comment/i })
    await user.click(submitButton)

    expect(handleSubmit).toHaveBeenCalledWith('Test comment', [])
  })

  it('should clear textarea after submission', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn()

    render(<CommentComposer {...defaultProps} onSubmit={handleSubmit} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i }) as HTMLTextAreaElement
    await user.type(textarea, 'Test comment')

    const submitButton = screen.getByRole('button', { name: /submit comment/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(textarea.value).toBe('')
    })
  })

  it('should render cancel button when onCancel provided', () => {
    const handleCancel = vi.fn()
    render(<CommentComposer {...defaultProps} onCancel={handleCancel} />)

    expect(screen.getByRole('button', { name: /cancel comment/i })).toBeInTheDocument()
  })

  it('should call onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const handleCancel = vi.fn()

    render(<CommentComposer {...defaultProps} onCancel={handleCancel} />)

    const cancelButton = screen.getByRole('button', { name: /cancel comment/i })
    await user.click(cancelButton)

    expect(handleCancel).toHaveBeenCalledTimes(1)
  })

  it('should display submitting state', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn((_content: string, _mentionedUserIds: string[]) => new Promise(() => {})) // Never resolves

    render(<CommentComposer {...defaultProps} onSubmit={handleSubmit} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i })
    await user.type(textarea, 'Test')

    const submitButton = screen.getByRole('button', { name: /submit comment/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Posting...')).toBeInTheDocument()
    })
  })

  it('should have visible label for accessibility', () => {
    render(<CommentComposer {...defaultProps} />)

    const label = screen.getByText('Comment')
    expect(label).toBeVisible()
  })

  it('should have hint text for users', () => {
    render(<CommentComposer {...defaultProps} />)

    expect(screen.getByText(/Tip: Type @ to mention a teammate/i)).toBeInTheDocument()
  })

  it('should respect initialValue prop', () => {
    render(<CommentComposer {...defaultProps} initialValue="Initial text" />)

    const textarea = screen.getByRole('textbox', { name: /comment/i }) as HTMLTextAreaElement
    expect(textarea.value).toBe('Initial text')
  })

  it('should use custom placeholder', () => {
    render(<CommentComposer {...defaultProps} placeholder="Write your thoughts..." />)

    expect(screen.getByPlaceholderText('Write your thoughts...')).toBeInTheDocument()
  })

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup()
    render(<CommentComposer {...defaultProps} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i })

    // Tab to textarea
    await user.tab()
    expect(textarea).toHaveFocus()

    // Type content to enable submit button
    await user.keyboard('Test comment')

    // Tab to submit button (skip hint div which isn't focusable)
    await user.tab()
    const submitButton = screen.getByRole('button', { name: /submit comment/i })
    expect(submitButton).toHaveFocus()
  })

  it('should submit with Cmd+Enter', async () => {
    const user = userEvent.setup()
    const handleSubmit = vi.fn()

    render(<CommentComposer {...defaultProps} onSubmit={handleSubmit} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i })
    await user.type(textarea, 'Test comment')
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(handleSubmit).toHaveBeenCalledWith('Test comment', [])
  })

  it('should have proper ARIA attributes', () => {
    render(<CommentComposer {...defaultProps} />)

    const textarea = screen.getByRole('textbox', { name: /comment/i })
    expect(textarea).toHaveAttribute('aria-describedby', 'comment-hint')
  })
})
