/**
 * Account Register Page
 *
 * Page wrapper for the AccountRegister component.
 * Loads the account data and passes it to the register view.
 */

import { type FC, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccounts } from '../hooks/useAccounts'
import { AccountRegister } from '../components/accounts/AccountRegister'
import { PageLoader } from '../components/loading/PageLoader'
import type { Account } from '../types'

export const AccountRegisterPage: FC = () => {
  const { accountId } = useParams<{ accountId: string }>()
  const navigate = useNavigate()
  const { accounts, isLoading } = useAccounts({
    companyId: 'demo-company', // TODO: Get from auth context
    isActive: undefined,
    includeDeleted: false,
  })

  const [account, setAccount] = useState<Account | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // Reset states when starting fresh
    if (isLoading || accounts.length === 0) {
      setAccount(null)
      setNotFound(false)
      return
    }

    // Only search when we have accounts loaded
    if (accountId && accounts.length > 0) {
      const found = accounts.find(acc => acc.id === accountId)

      if (found) {
        setAccount(found)
        setNotFound(false)
      } else {
        // Account genuinely not found after accounts loaded
        setNotFound(true)
        const timer = setTimeout(() => navigate('/chart-of-accounts'), 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [accounts, accountId, isLoading, navigate])

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Loading account register...</h2>
        <p>Loading {accounts.length} accounts</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Account not found</h2>
        <p>Looking for account ID: {accountId}</p>
        <p>Available accounts: {accounts.length}</p>
        <p>Account IDs: {accounts.map(a => a.id).join(', ')}</p>
        <p>Redirecting to Chart of Accounts in 2 seconds...</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Waiting for account data...</h2>
        <p>Account ID: {accountId}</p>
        <p>Loaded {accounts.length} accounts</p>
      </div>
    )
  }

  return <AccountRegister account={account} companyId="demo-company" />
}

export default AccountRegisterPage
