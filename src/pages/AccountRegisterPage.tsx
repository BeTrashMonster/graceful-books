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
    if (!isLoading && accountId) {
      const found = accounts.find(acc => acc.id === accountId)
      if (found) {
        setAccount(found)
      } else {
        // Account not found
        setNotFound(true)
        setTimeout(() => navigate('/chart-of-accounts'), 2000)
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
