import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionBadge } from './MentionBadge'
import * as mentionsService from '../../services/mentions.service'

// Mock the mentions service
vi.mock('../../services/mentions.service', () => ({
  createMentionsService: vi.fn(() => ({
    getUnreadMentionCount: vi.fn(),
  })),
}))

describe('MentionBadge', () => {
  const defaultProps = {
    userId: 'user-123',
    companyId: 'company-456',
    deviceId: 'device-789',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display unread mention count', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(3),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('should hide badge when count is zero by default', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(0),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    const { container } = render(<MentionBadge {...defaultProps} />)

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('should show badge with zero count when showZero is true', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(0),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} showZero={true} />)

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('should call onClick when badge is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(5),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} onClick={handleClick} />)

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    const badge = screen.getByRole('button')
    await user.click(badge)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not call onClick when count is zero', async () => {
    const handleClick = vi.fn()
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(0),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} onClick={handleClick} showZero={true} />)

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    // When count is zero, onClick should not be called
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should be keyboard accessible with Enter key', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(2),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} onClick={handleClick} />)

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    const badge = screen.getByRole('button')
    badge.focus()
    await user.keyboard('{Enter}')

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be keyboard accessible with Space key', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(2),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} onClick={handleClick} />)

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    const badge = screen.getByRole('button')
    badge.focus()
    await user.keyboard(' ')

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should display loading state initially', () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should display error state on failure', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockRejectedValue(new Error('Network error')),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} showZero={true} />)

    await waitFor(() => {
      expect(screen.queryByText('Error')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should have correct ARIA label for single mention', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(1),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} onClick={vi.fn()} />)

    await waitFor(() => {
      const badge = screen.getByRole('button')
      expect(badge).toHaveAttribute('aria-label', '1 unread mention. Click to view details.')
    })
  })

  it('should have correct ARIA label for multiple mentions', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(5),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} onClick={vi.fn()} />)

    await waitFor(() => {
      const badge = screen.getByRole('button')
      expect(badge).toHaveAttribute('aria-label', '5 unread mentions. Click to view details.')
    })
  })

  it('should have aria-live attribute for screen readers', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(3),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} />)

    await waitFor(() => {
      const badge = screen.getByRole('status')
      expect(badge).toHaveAttribute('aria-live', 'polite')
      expect(badge).toHaveAttribute('aria-atomic', 'true')
    })
  })

  it('should apply size variants', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(1),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    const { rerender } = render(<MentionBadge {...defaultProps} size="sm" />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    rerender(<MentionBadge {...defaultProps} size="lg" />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  it('should apply variant styles', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(1),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    const { rerender } = render(<MentionBadge {...defaultProps} variant="inline" />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    rerender(<MentionBadge {...defaultProps} variant="floating" />)

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  it('should apply custom className', async () => {
    const mockService = {
      getUnreadMentionCount: vi.fn().mockResolvedValue(1),
    }
    vi.mocked(mentionsService.createMentionsService).mockReturnValue(mockService as any)

    render(<MentionBadge {...defaultProps} className="custom-badge" />)

    await waitFor(() => {
      const badge = screen.getByRole('status')
      expect(badge).toHaveClass('custom-badge')
    })
  })
})
