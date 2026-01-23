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
        // Account not found after accounts loaded
        setNotFound(true)
        const timer = setTimeout(() => navigate('/chart-of-accounts'), 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [accounts, accountId, isLoading, navigate])

  if (isLoading) {
    return <PageLoader />
  }

  if (notFound) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Account not found. Redirecting to Chart of Accounts...</p>
      </div>
    )
  }

  if (!account) {
    return <PageLoader />
  }

  return <AccountRegister account={account} companyId="demo-company" />
}

export default AccountRegisterPage
