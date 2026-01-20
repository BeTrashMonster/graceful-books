import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MentionDropdown, type MentionUser } from './MentionDropdown'

const mockUsers: MentionUser[] = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    username: 'alice',
  },
  {
    id: 'user-2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    username: 'bob',
  },
  {
    id: 'user-3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    username: 'charlie',
  },
]

describe('MentionDropdown', () => {
  it('should render list of users', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
      />
    )

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('@bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
    expect(screen.getByText('@charlie')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={[]}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
        isLoading={true}
      />
    )

    expect(screen.getByText('Finding teammates...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('should display empty state when no users match', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={[]}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
        isLoading={false}
      />
    )

    expect(screen.getByText('No teammates found')).toBeInTheDocument()
    expect(screen.getByText('Check spelling or try a different name')).toBeInTheDocument()
  })

  it('should call onSelect when user clicks on an item', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
      />
    )

    const aliceOption = screen.getByText('Alice Johnson').closest('li')!
    await user.click(aliceOption)

    expect(onSelect).toHaveBeenCalledWith(mockUsers[0])
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('should highlight selected user with aria-selected', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={1}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
      />
    )

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('should apply correct positioning styles', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 150, left: 75 }}
      />
    )

    const dropdown = container.firstChild as HTMLElement
    expect(dropdown).toHaveStyle({ top: '150px', left: '75px' })
  })

  it('should have correct ARIA attributes for accessibility', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
      />
    )

    const listbox = screen.getByRole('listbox')
    expect(listbox).toHaveAttribute('aria-label', 'Mention suggestions')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    options.forEach((option) => {
      expect(option).toHaveAttribute('aria-selected')
    })
  })

  it('should display user avatars with first letter', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
      />
    )

    const avatars = screen.getAllByRole('option')
    expect(avatars[0]).toHaveTextContent('A')
    expect(avatars[1]).toHaveTextContent('B')
    expect(avatars[2]).toHaveTextContent('C')
  })

  it('should apply custom className', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
        className="custom-class"
      />
    )

    const dropdown = container.firstChild as HTMLElement
    expect(dropdown).toHaveClass('custom-class')
  })

  it('should be keyboard navigable', () => {
    const onSelect = vi.fn()
    render(
      <MentionDropdown
        users={mockUsers}
        selectedIndex={0}
        onSelect={onSelect}
        position={{ top: 100, left: 50 }}
      />
    )

    // All options should be in the DOM and selectable
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)

    // Selected option should be marked
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })
})
