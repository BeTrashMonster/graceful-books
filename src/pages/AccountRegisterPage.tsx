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

  useEffect(() => {
    if (!isLoading && accounts.length > 0 && accountId) {
      const found = accounts.find(acc => acc.id === accountId)
      if (found) {
        setAccount(found)
      } else {
        // Account not found, redirect to chart of accounts
        navigate('/chart-of-accounts')
      }
    }
  }, [accounts, accountId, isLoading, navigate])

  if (isLoading || !account) {
    return <PageLoader />
  }

  return <AccountRegister account={account} companyId="demo-company" />
}

export default AccountRegisterPage
