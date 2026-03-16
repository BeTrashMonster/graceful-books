import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

const messages = [
  {
    title: "404 - Not in Our Books",
    subtitle: "We've triple-checked the ledger. This page isn't here.",
    emoji: "📚"
  },
  {
    title: "Reconciliation Failed",
    subtitle: "This page and reality have some differences to work out.",
    emoji: "🔍"
  },
  {
    title: "Audit Alert!",
    subtitle: "Our records show... absolutely nothing for this page.",
    emoji: "📋"
  },
  {
    title: "The Treasure Chest is Empty Here",
    subtitle: "We dug around but couldn't find anything at this spot.",
    emoji: "🏴‍☠️"
  },
  {
    title: "Cash Flow Interruption",
    subtitle: "The flow of data to this page has... stopped flowing.",
    emoji: "💸"
  }
]

const funFacts = [
  "Fun fact: The first written description of double-entry bookkeeping was published in Venice in 1494 by Luca Pacioli!",
  "Did you know? The word 'credit' comes from the Latin 'credere' meaning 'to trust'.",
  "Trivia: The earliest known accounting records date back to ancient Mesopotamia, over 7,000 years ago! 🏺",
  "Random knowledge: The term 'accountant' comes from the French word 'compter' meaning 'to count'.",
  "Historical tidbit: In ancient Rome, bookkeepers used an abacus and wax tablets to track finances!",
  "Cool fact: Your financial records matter! Every business, big or small, deserves accurate books. ❤️"
]

export default function NotFound() {
  const location = useLocation()
  const [message, setMessage] = useState(messages[0])
  const [funFact, setFunFact] = useState(funFacts[0])

  // Determine if user was on CPG routes
  const isCPGRoute = location.pathname.startsWith('/cpg')
  const dashboardLink = isCPGRoute ? '/cpg/dashboard' : '/dashboard'
  const dashboardText = isCPGRoute ? 'Back to CPG Dashboard' : 'Back to Dashboard'

  useEffect(() => {
    // Randomly select a message on mount
    setMessage(messages[Math.floor(Math.random() * messages.length)])
    setFunFact(funFacts[Math.floor(Math.random() * funFacts.length)])
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-background, #faf5ff)',
      padding: '1rem'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '600px'
      }}>
        {/* Big emoji */}
        <div style={{
          fontSize: '6rem',
          marginBottom: '1rem',
          animation: 'bounce 2s ease-in-out infinite'
        }}>
          {message.emoji}
        </div>

        {/* 404 number */}
        <h1 style={{
          fontSize: '7rem',
          fontWeight: 'bold',
          color: 'var(--color-primary, #7c3aed)',
          margin: 0,
          lineHeight: 1
        }}>
          404
        </h1>

        {/* Dynamic title */}
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 600,
          marginTop: '1rem',
          marginBottom: '0.5rem',
          color: '#1f2937'
        }}>
          {message.title}
        </h2>

        {/* Dynamic subtitle */}
        <p style={{
          color: 'var(--color-text-secondary, #6b7280)',
          marginBottom: '1.5rem',
          fontSize: '1.125rem'
        }}>
          {message.subtitle}
        </p>

        {/* Fun fact box */}
        <div style={{
          backgroundColor: '#f3e8ff',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          borderLeft: '4px solid #7c3aed'
        }}>
          <p style={{
            margin: 0,
            fontSize: '1rem',
            color: '#6b7280',
            fontStyle: 'italic'
          }}>
            💡 {funFact}
          </p>
        </div>

        {/* Helpful message */}
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
          fontSize: '1.0625rem'
        }}>
          No worries! Let's get you back to balancing those books.
        </p>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <Link
            to={dashboardLink}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-primary, #7c3aed)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '0.375rem',
              fontWeight: 500,
              fontSize: '1rem',
              display: 'inline-block',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#6d28d9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#7c3aed'}
          >
            {dashboardText}
          </Link>

          <button
            onClick={() => window.history.back()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary, #111827)',
              border: '1px solid var(--color-border, #d1d5db)',
              borderRadius: '0.375rem',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6'
              e.currentTarget.style.borderColor = '#9ca3af'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
          >
            Go Back
          </button>
        </div>

        {/* Cute footer message */}
        <p style={{
          marginTop: '3rem',
          fontSize: '0.875rem',
          color: '#9ca3af',
          fontStyle: 'italic'
        }}>
          "In accounting, every mistake is just an adjusting entry waiting to happen." 💜
        </p>

        <style>{`
          @keyframes bounce {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-20px);
            }
          }
        `}</style>
      </div>
    </div>
  )
}
