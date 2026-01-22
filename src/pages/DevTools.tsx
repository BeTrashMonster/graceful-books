/**
 * Developer Tools Page
 *
 * Hidden page for development utilities.
 * Access via /dev-tools
 */

import { useState } from 'react'
import { resetCompanyData, resetEverything } from '../utils/devReset'

export default function DevTools() {
  const [isResettingCompany, setIsResettingCompany] = useState(false)
  const [isResettingAll, setIsResettingAll] = useState(false)

  const handleResetCompany = async () => {
    if (window.confirm(
      '🔄 This will reset your company data:\n\n' +
      '✅ KEEPS: Your login credentials\n' +
      '❌ DELETES: Chart of Accounts, transactions, settings\n\n' +
      'Perfect for testing the COA wizard again!\n\n' +
      'Continue?'
    )) {
      setIsResettingCompany(true)
      await resetCompanyData()
    }
  }

  const handleResetAll = async () => {
    if (window.confirm(
      '⚠️ This will DELETE EVERYTHING including:\n\n' +
      '• Login credentials\n' +
      '• Chart of Accounts\n' +
      '• All transactions\n' +
      '• All settings\n\n' +
      'Use this to test the signup/onboarding flow.\n\n' +
      'Are you absolutely sure?'
    )) {
      setIsResettingAll(true)
      await resetEverything()
    }
  }

  const getStorageInfo = () => {
    const localStorageKeys = Object.keys(localStorage)
    return {
      localStorageKeys,
      localStorageSize: JSON.stringify(localStorage).length,
    }
  }

  const info = getStorageInfo()

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        🛠️ Developer Tools
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
        Utilities for development and testing
      </p>

      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          border: '2px solid #fbbf24',
          marginBottom: '2rem',
        }}
      >
        <h2
          style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#78350f',
            marginBottom: '0.5rem',
          }}
        >
          ⚠️ Warning
        </h2>
        <p style={{ color: '#92400e', lineHeight: 1.6, margin: 0 }}>
          This page is for development only. These actions are{' '}
          <strong>irreversible</strong> and will delete all your data.
        </p>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#1f2937',
          }}
        >
          Current Storage Status
        </h3>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            backgroundColor: '#f3f4f6',
            padding: '1rem',
            borderRadius: '4px',
          }}
        >
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>LocalStorage Keys:</strong> {info.localStorageKeys.length}
          </div>
          {info.localStorageKeys.map((key) => (
            <div key={key} style={{ paddingLeft: '1rem', color: '#6b7280' }}>
              • {key}
            </div>
          ))}
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Size:</strong> ~{Math.round(info.localStorageSize / 1024)}KB
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#1f2937',
          }}
        >
          Reset Company Data (Recommended)
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1rem', lineHeight: 1.6 }}>
          Clear all business data while keeping your login credentials. Perfect
          for testing the Chart of Accounts wizard from scratch without having
          to sign up again.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            padding: '1rem',
            backgroundColor: '#f0fdf4',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#166534', display: 'block', marginBottom: '0.5rem' }}>
              ✅ Keeps:
            </strong>
            <div style={{ color: '#15803d' }}>• Login credentials</div>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#991b1b', display: 'block', marginBottom: '0.5rem' }}>
              ❌ Deletes:
            </strong>
            <div style={{ color: '#dc2626' }}>• Chart of Accounts</div>
            <div style={{ color: '#dc2626' }}>• Transactions</div>
            <div style={{ color: '#dc2626' }}>• Settings</div>
          </div>
        </div>
        <button
          onClick={handleResetCompany}
          disabled={isResettingCompany}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isResettingCompany ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: isResettingCompany ? 'not-allowed' : 'pointer',
          }}
        >
          {isResettingCompany ? '🔄 Resetting...' : '🔄 Reset Company Data'}
        </button>
      </div>

      <div
        style={{
          backgroundColor: 'white',
          border: '2px solid #fecaca',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '0.5rem',
            color: '#991b1b',
          }}
        >
          Reset Everything (Including Login)
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '1rem', lineHeight: 1.6 }}>
          Completely wipe all data including login credentials. Use this only
          when you need to test the complete signup/onboarding flow from the
          very beginning.
        </p>
        <button
          onClick={handleResetAll}
          disabled={isResettingAll}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isResettingAll ? '#9ca3af' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: isResettingAll ? 'not-allowed' : 'pointer',
          }}
        >
          {isResettingAll ? '🔄 Resetting...' : '🗑️ Reset Everything'}
        </button>
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          borderRadius: '6px',
          fontSize: '0.875rem',
          color: '#1e40af',
        }}
      >
        <strong>Console Access:</strong> Run{' '}
        <code
          style={{
            backgroundColor: '#e0f2fe',
            padding: '0.25rem 0.5rem',
            borderRadius: '3px',
            fontFamily: 'monospace',
          }}
        >
          devResetCompany()
        </code>{' '}
        or{' '}
        <code
          style={{
            backgroundColor: '#e0f2fe',
            padding: '0.25rem 0.5rem',
            borderRadius: '3px',
            fontFamily: 'monospace',
          }}
        >
          devResetAll()
        </code>{' '}
        in the browser console
      </div>
    </div>
  )
}
