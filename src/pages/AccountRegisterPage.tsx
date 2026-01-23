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
    console.log('AccountRegisterPage - Debug:', {
      accountId,
      isLoading,
      accountsCount: accounts.length,
      accountIds: accounts.map(a => a.id)
    })

    if (!isLoading && accountId) {
      const found = accounts.find(acc => acc.id === accountId)
      console.log('Looking for account:', accountId, 'Found:', !!found)
      if (found) {
        setAccount(found)
        setNotFound(false)
      } else {
        // Account not found
        console.error('Account not found. Available accounts:', accounts.map(a => ({ id: a.id, name: a.name })))
        setNotFound(true)
        setTimeout(() => navigate('/chart-of-accounts'), 2000)
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
