/**
 * BarterEntry Component
 *
 * Form for recording barter/trade transactions with fair market value validation.
 *
 * Requirements: I5 - Barter/Trade Transactions (Nice)
 */

import { useState, useEffect } from 'react';
import type {
  CreateBarterTransactionRequest,
  BarterTransactionValidationResult,
  FMVBasis,
} from '../../types/barter.types';
import type { Account, Contact } from '../../types/database.types';
import { Input } from '../forms/Input';
import { BarterTaxGuide } from '../education/BarterTaxGuide';

export interface BarterEntryProps {
  companyId: string;
  accounts: Account[];
  contacts: Contact[];
  onSave: (request: CreateBarterTransactionRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export function BarterEntry({
  companyId,
  accounts,
  contacts,
  onSave,
  onCancel,
  isLoading = false,
  error,
}: BarterEntryProps) {
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Goods received (income side)
  const [goodsReceivedDescription, setGoodsReceivedDescription] = useState('');
  const [goodsReceivedFMV, setGoodsReceivedFMV] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');

  // Goods provided (expense side)
  const [goodsProvidedDescription, setGoodsProvidedDescription] = useState('');
  const [goodsProvidedFMV, setGoodsProvidedFMV] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');

  // FMV documentation
  const [fmvBasis, setFmvBasis] = useState<string>('');
  const [fmvDocumentation, setFmvDocumentation] = useState<string[]>([]);

  // Counterparty
  const [counterpartyContactId, setCounterpartyContactId] = useState('');

  // Optional fields
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  // Validation and warnings
  const [validation, setValidation] = useState<BarterTransactionValidationResult | null>(null);
  const [showTaxGuide, setShowTaxGuide] = useState(false);

  // Filter accounts by type
  const incomeAccounts = accounts.filter(
    (acc) => acc.type === 'INCOME' || acc.type === 'OTHER_INCOME'
  );
  const expenseAccounts = accounts.filter(
    (acc) => acc.type === 'EXPENSE' || acc.type === 'COGS' || acc.type === 'OTHER_EXPENSE'
  );

  // Validate on field changes
  useEffect(() => {
    if (goodsReceivedFMV && goodsProvidedFMV) {
      validateFMV();
    }
  }, [goodsReceivedFMV, goodsProvidedFMV]);

  const validateFMV = () => {
    try {
      const receivedFMV = parseFloat(goodsReceivedFMV || '0');
      const providedFMV = parseFloat(goodsProvidedFMV || '0');

      const errors: string[] = [];
      const warnings: string[] = [];

      if (receivedFMV <= 0) {
        errors.push('Fair market value of goods received must be greater than zero');
      }

      if (providedFMV <= 0) {
        errors.push('Fair market value of goods provided must be greater than zero');
      }

      const difference = Math.abs(receivedFMV - providedFMV);
      const differencePercentage = receivedFMV > 0 ? (difference / receivedFMV) * 100 : 0;

      if (differencePercentage > 20) {
        warnings.push(
          `Fair market values differ by ${differencePercentage.toFixed(1)}%. ` +
          'Consider documenting the reason for the difference.'
        );
      }

      if (!fmvBasis) {
        warnings.push(
          'Consider documenting how fair market value was determined for tax compliance.'
        );
      }

      if (receivedFMV >= 600) {
        warnings.push(
          'This transaction may require 1099-B reporting. ' +
          'Ensure counterparty information is complete.'
        );
      }

      setValidation({
        is_valid: errors.length === 0,
        errors,
        warnings,
        fmv_received: receivedFMV.toFixed(2),
        fmv_provided: providedFMV.toFixed(2),
        fmv_difference: difference.toFixed(2),
        fmv_difference_percentage: differencePercentage.toFixed(2),
      });
    } catch (e) {
      setValidation({
        is_valid: false,
        errors: ['Invalid fair market value format'],
        warnings: [],
        fmv_received: '0.00',
        fmv_provided: '0.00',
        fmv_difference: '0.00',
        fmv_difference_percentage: '0.00',
      });
    }
  };

  const handleSave = async () => {
    if (!validation || !validation.is_valid) {
      return;
    }

    const request: CreateBarterTransactionRequest = {
      company_id: companyId,
      transaction_date: new Date(transactionDate).getTime(),
      goods_received_description: goodsReceivedDescription,
      goods_received_fmv: validation.fmv_received,
      income_account_id: incomeAccountId,
      goods_provided_description: goodsProvidedDescription,
      goods_provided_fmv: validation.fmv_provided,
      expense_account_id: expenseAccountId,
      fmv_basis: fmvBasis || null,
      fmv_documentation: fmvDocumentation,
      counterparty_contact_id: counterpartyContactId || null,
      reference: reference || null,
      memo: memo || null,
      attachments: attachments,
    };

    await onSave(request);
  };

  const canSave = validation?.is_valid &&
    goodsReceivedDescription.trim() &&
    goodsProvidedDescription.trim() &&
    incomeAccountId &&
    expenseAccountId;

  return (
    <div className="barter-entry" style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>Record Barter Transaction</h2>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
          Traded services? We have got you covered. Barter is real income and the IRS agrees.
          {' '}
          <button
            type="button"
            onClick={() => setShowTaxGuide(!showTaxGuide)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0066cc',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit',
            }}
          >
            Learn more about barter taxation
          </button>
        </p>
      </div>

      {showTaxGuide && (
        <div style={{ marginBottom: '1.5rem' }}>
          <BarterTaxGuide onClose={() => setShowTaxGuide(false)} />
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            marginBottom: '1rem',
            color: '#c33',
          }}
        >
          {error}
        </div>
      )}

      {/* Transaction Date */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label
          htmlFor="transaction-date"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Transaction Date *
        </label>
        <Input
          id="transaction-date"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Two-column layout for received and provided */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '2rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Goods/Services Received (Income) */}
        <div
          style={{
            padding: '1.5rem',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            backgroundColor: '#f0f9f0',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: '1rem', color: '#2e7d32' }}>
            What You Received (Income)
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="goods-received-description"
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Description *
            </label>
            <Input
              id="goods-received-description"
              type="text"
              value={goodsReceivedDescription}
              onChange={(e) => setGoodsReceivedDescription(e.target.value)}
              placeholder="e.g., Web design services"
              disabled={isLoading}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="goods-received-fmv"
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Fair Market Value *
            </label>
            <Input
              id="goods-received-fmv"
              type="number"
              step="0.01"
              min="0"
              value={goodsReceivedFMV}
              onChange={(e) => setGoodsReceivedFMV(e.target.value)}
              placeholder="0.00"
              disabled={isLoading}
            />
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>
              The value you would have paid in cash for these goods/services
            </p>
          </div>

          <div>
            <label
              htmlFor="income-account"
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Income Account *
            </label>
            <select
              id="income-account"
              value={incomeAccountId}
              onChange={(e) => setIncomeAccountId(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              <option value="">Select income account...</option>
              {incomeAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_number ? `${acc.account_number} - ` : ''}{acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Goods/Services Provided (Expense) */}
        <div
          style={{
            padding: '1.5rem',
            border: '2px solid #FF9800',
            borderRadius: '8px',
            backgroundColor: '#fff8f0',
          }}
        >
          <h3 style={{ margin: 0, marginBottom: '1rem', color: '#e65100' }}>
            What You Provided (Expense)
          </h3>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="goods-provided-description"
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Description *
            </label>
            <Input
              id="goods-provided-description"
              type="text"
              value={goodsProvidedDescription}
              onChange={(e) => setGoodsProvidedDescription(e.target.value)}
              placeholder="e.g., Consulting services"
              disabled={isLoading}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="goods-provided-fmv"
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Fair Market Value *
            </label>
            <Input
              id="goods-provided-fmv"
              type="number"
              step="0.01"
              min="0"
              value={goodsProvidedFMV}
              onChange={(e) => setGoodsProvidedFMV(e.target.value)}
              placeholder="0.00"
              disabled={isLoading}
            />
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>
              The value the other party would have paid in cash
            </p>
          </div>

          <div>
            <label
              htmlFor="expense-account"
              style={{
                display: 'block',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              Expense Account *
            </label>
            <select
              id="expense-account"
              value={expenseAccountId}
              onChange={(e) => setExpenseAccountId(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '1rem',
              }}
            >
              <option value="">Select expense account...</option>
              {expenseAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.account_number ? `${acc.account_number} - ` : ''}{acc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Validation Messages */}
      {validation && (
        <div style={{ marginBottom: '1.5rem' }}>
          {validation.errors.length > 0 && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
                marginBottom: '0.5rem',
              }}
            >
              {validation.errors.map((err, i) => (
                <p key={i} style={{ margin: '0.25rem 0', color: '#c33' }}>
                  {err}
                </p>
              ))}
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#fff4e5',
                border: '1px solid #ffe0b2',
                borderRadius: '4px',
              }}
            >
              {validation.warnings.map((warn, i) => (
                <p key={i} style={{ margin: '0.25rem 0', color: '#e65100' }}>
                  {warn}
                </p>
              ))}
            </div>
          )}

          {validation.is_valid && validation.warnings.length === 0 && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: '#e8f5e9',
                border: '1px solid #c8e6c9',
                borderRadius: '4px',
              }}
            >
              <p style={{ margin: 0, color: '#2e7d32' }}>
                Transaction is valid. FMV difference: ${validation.fmv_difference} (
                {validation.fmv_difference_percentage}%)
              </p>
            </div>
          )}
        </div>
      )}

      {/* FMV Basis */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label
          htmlFor="fmv-basis"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          How was Fair Market Value determined? (Recommended)
        </label>
        <select
          id="fmv-basis"
          value={fmvBasis}
          onChange={(e) => setFmvBasis(e.target.value)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        >
          <option value="">Select basis...</option>
          <option value="MARKET_PRICE">Current market price for similar items</option>
          <option value="COMPARABLE_SALES">Recent sales of comparable items</option>
          <option value="PROFESSIONAL_APPRAISAL">Professional appraisal</option>
          <option value="REPLACEMENT_COST">Cost to replace the item</option>
          <option value="SELLER_ASKING_PRICE">Seller&apos;s asking price</option>
          <option value="AGREED_VALUE">Mutually agreed value</option>
          <option value="OTHER">Other method</option>
        </select>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>
          Documenting your FMV basis helps support your tax return
        </p>
      </div>

      {/* Counterparty */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label
          htmlFor="counterparty"
          style={{
            display: 'block',
            fontWeight: 600,
            marginBottom: '0.5rem',
          }}
        >
          Who did you trade with? (For 1099-B reporting)
        </label>
        <select
          id="counterparty"
          value={counterpartyContactId}
          onChange={(e) => setCounterpartyContactId(e.target.value)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        >
          <option value="">Select contact...</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </select>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>
          Required if FMV received is $600 or more
        </p>
      </div>

      {/* Optional Fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <label
            htmlFor="reference"
            style={{
              display: 'block',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            Reference
          </label>
          <Input
            id="reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Agreement #, etc."
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="memo"
            style={{
              display: 'block',
              fontWeight: 600,
              marginBottom: '0.5rem',
            }}
          >
            Memo
          </label>
          <Input
            id="memo"
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Internal notes"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
          paddingTop: '1rem',
          borderTop: '1px solid #e0e0e0',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: 'white',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: canSave && !isLoading ? '#0066cc' : '#ccc',
            color: 'white',
            cursor: canSave && !isLoading ? 'pointer' : 'not-allowed',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          {isLoading ? 'Saving...' : 'Record Barter Transaction'}
        </button>
      </div>
    </div>
  );
}
