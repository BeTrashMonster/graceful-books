/**
 * BarterTaxGuide Component
 *
 * Educational content about barter transaction taxation and 1099-B reporting.
 * Provides plain English explanations with IRS guidance.
 *
 * Requirements: I5 - Barter/Trade Transactions (Nice)
 */

import { useState } from 'react';

export interface BarterTaxGuideProps {
  onClose?: () => void;
}

type TabType = 'overview' | 'fmv' | '1099b' | 'examples' | 'irs';

export function BarterTaxGuide({ onClose }: BarterTaxGuideProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabStyles = {
    container: {
      display: 'flex',
      gap: '0.5rem',
      borderBottom: '2px solid #e0e0e0',
      marginBottom: '1.5rem',
    },
    tab: (isActive: boolean) => ({
      padding: '0.75rem 1rem',
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      fontSize: '0.95rem',
      fontWeight: isActive ? 600 : 400,
      color: isActive ? '#0066cc' : '#666',
      borderBottom: isActive ? '3px solid #0066cc' : 'none',
      marginBottom: isActive ? '-2px' : '0',
    }),
  };

  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '1.5rem',
        backgroundColor: 'white',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0 }}>Barter Transaction Tax Guide</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
              padding: '0.25rem',
            }}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={tabStyles.container}>
        <button
          type="button"
          style={tabStyles.tab(activeTab === 'overview')}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          style={tabStyles.tab(activeTab === 'fmv')}
          onClick={() => setActiveTab('fmv')}
        >
          Fair Market Value
        </button>
        <button
          type="button"
          style={tabStyles.tab(activeTab === '1099b')}
          onClick={() => setActiveTab('1099b')}
        >
          1099-B Reporting
        </button>
        <button
          type="button"
          style={tabStyles.tab(activeTab === 'examples')}
          onClick={() => setActiveTab('examples')}
        >
          Examples
        </button>
        <button
          type="button"
          style={tabStyles.tab(activeTab === 'irs')}
          onClick={() => setActiveTab('irs')}
        >
          IRS Resources
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'fmv' && <FMVTab />}
        {activeTab === '1099b' && <Form1099BTab />}
        {activeTab === 'examples' && <ExamplesTab />}
        {activeTab === 'irs' && <IRSResourcesTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>What is Barter?</h4>
      <p>
        Barter is the exchange of goods or services without using money. For example, if you provide
        web design services to a plumber in exchange for plumbing repairs, that is a barter transaction.
      </p>

      <h4>Is Barter Taxable?</h4>
      <p>
        <strong>Yes.</strong> The IRS treats barter as taxable income. You must report the fair market value
        of goods or services you receive through barter as income on your tax return.
      </p>

      <h4>Why Does This Matter?</h4>
      <p>
        Even though no cash changes hands, the IRS considers barter to be the same as if you:
      </p>
      <ol>
        <li>Received cash for your goods/services (income)</li>
        <li>Paid cash for the goods/services you received (expense)</li>
      </ol>

      <div
        style={{
          padding: '1rem',
          backgroundColor: '#e8f5e9',
          border: '1px solid #c8e6c9',
          borderRadius: '4px',
          marginTop: '1rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>The Bottom Line</p>
        <p style={{ marginBottom: 0 }}>
          If you would have paid $500 cash for the services you received, you must report $500 as
          income, even if you paid for it by trading your own services.
        </p>
      </div>
    </div>
  );
}

function FMVTab() {
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>What is Fair Market Value?</h4>
      <p>
        Fair Market Value (FMV) is the price that goods or services would sell for on the open market
        between a willing buyer and a willing seller, both having reasonable knowledge of the relevant facts.
      </p>

      <h4>How to Determine Fair Market Value</h4>
      <p>Here are acceptable methods for determining FMV:</p>

      <div style={{ marginBottom: '1rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>1. Current Market Price</h5>
        <p style={{ marginTop: 0 }}>
          What are similar goods/services currently selling for? Check online marketplaces,
          competitor pricing, or industry rate guides.
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>2. Comparable Sales</h5>
        <p style={{ marginTop: 0 }}>
          Look at recent sales of similar items or services. What did others pay for the same thing?
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>3. Your Normal Rates</h5>
        <p style={{ marginTop: 0 }}>
          What do you normally charge cash-paying customers for these goods or services?
        </p>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>4. Replacement Cost</h5>
        <p style={{ marginTop: 0 }}>
          How much would it cost to replace or purchase the goods/services from someone else?
        </p>
      </div>

      <div
        style={{
          padding: '1rem',
          backgroundColor: '#fff4e5',
          border: '1px solid #ffe0b2',
          borderRadius: '4px',
          marginTop: '1rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Important</p>
        <p style={{ marginBottom: 0 }}>
          Document how you determined FMV. Save emails, quotes, price lists, or screenshots that
          support your valuation. This documentation helps if the IRS ever questions your tax return.
        </p>
      </div>
    </div>
  );
}

function Form1099BTab() {
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>What is Form 1099-B?</h4>
      <p>
        Form 1099-B is used to report proceeds from broker and barter exchange transactions to the IRS.
        If you participate in barter exchanges that facilitate trades between multiple parties, they may
        issue you a 1099-B.
      </p>

      <h4>When Do You Need to Issue 1099-B?</h4>
      <p>
        For direct barter transactions (not through an exchange), you generally do not need to issue
        Form 1099-B. However, you must still report the income on your tax return.
      </p>

      <h4>$600 Threshold</h4>
      <p>
        The IRS requires reporting of barter income when the fair market value is $600 or more in a
        calendar year. Below this threshold, you still must report the income, but 1099-B reporting
        requirements may not apply.
      </p>

      <h4>What Information to Track</h4>
      <p>Keep records of:</p>
      <ul>
        <li>Date of the barter transaction</li>
        <li>Description of goods/services exchanged</li>
        <li>Fair market value of goods/services received</li>
        <li>How FMV was determined</li>
        <li>Name and contact information of the other party</li>
        <li>Any supporting documentation (agreements, quotes, etc.)</li>
      </ul>

      <div
        style={{
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          border: '1px solid #bbdefb',
          borderRadius: '4px',
          marginTop: '1rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Tax Professional Tip</p>
        <p style={{ marginBottom: 0 }}>
          When in doubt about 1099-B reporting requirements, consult a tax professional. Requirements
          can vary based on whether you are using a barter exchange, the type of goods/services, and
          your business structure.
        </p>
      </div>
    </div>
  );
}

function ExamplesTab() {
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Real-World Barter Examples</h4>

      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>Example 1: Service for Service</h5>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Scenario:</strong> You are a graphic designer. A marketing consultant agrees to create
          a marketing strategy for you in exchange for logo design work.
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Fair Market Value:</strong> Marketing strategy = $1,000 | Logo design = $900
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Tax Treatment:</strong>
        </p>
        <ul style={{ marginTop: '0.5rem' }}>
          <li>You report $1,000 as income (marketing services received)</li>
          <li>You deduct $900 as business expense (design services provided)</li>
          <li>Net taxable income: $100</li>
        </ul>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>Example 2: Service for Goods</h5>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Scenario:</strong> You provide bookkeeping services to a furniture store owner in
          exchange for a new desk.
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Fair Market Value:</strong> Desk = $500 | Bookkeeping = $500
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Tax Treatment:</strong>
        </p>
        <ul style={{ marginTop: '0.5rem' }}>
          <li>You report $500 as income (desk received)</li>
          <li>You deduct $500 as business expense (bookkeeping services provided)</li>
          <li>Net taxable income: $0</li>
          <li>The desk is now a business asset you purchased for $500</li>
        </ul>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>Example 3: Unequal Exchange</h5>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Scenario:</strong> You provide $800 worth of legal services in exchange for $600
          worth of construction work plus $200 cash.
        </p>
        <p style={{ margin: '0.5rem 0' }}>
          <strong>Tax Treatment:</strong>
        </p>
        <ul style={{ marginTop: '0.5rem' }}>
          <li>You report $800 as income ($600 services + $200 cash)</li>
          <li>You deduct $800 as business expense (legal services provided)</li>
          <li>Net taxable income: $0</li>
        </ul>
      </div>

      <div
        style={{
          padding: '1rem',
          backgroundColor: '#e8f5e9',
          border: '1px solid #c8e6c9',
          borderRadius: '4px',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Key Takeaway</p>
        <p style={{ marginBottom: 0 }}>
          In all cases, you report the full fair market value of what you received as income, and the
          full fair market value of what you provided as an expense. This ensures proper tax treatment
          even though no cash changed hands.
        </p>
      </div>
    </div>
  );
}

function IRSResourcesTab() {
  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Official IRS Resources</h4>
      <p>
        The IRS provides detailed guidance on barter transactions. Here are the key resources:
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>IRS Publication 525 - Taxable and Nontaxable Income</h5>
        <p style={{ margin: '0.5rem 0' }}>
          The primary resource for barter income reporting. Includes examples and detailed guidance.
        </p>
        <a
          href="https://www.irs.gov/publications/p525"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0066cc', textDecoration: 'underline' }}
        >
          Read Publication 525 on IRS.gov
        </a>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>IRS Topic No. 420 - Bartering Income</h5>
        <p style={{ margin: '0.5rem 0' }}>
          Quick reference guide on bartering and how to report it.
        </p>
        <a
          href="https://www.irs.gov/taxtopics/tc420"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0066cc', textDecoration: 'underline' }}
        >
          View Topic 420 on IRS.gov
        </a>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h5 style={{ marginBottom: '0.5rem' }}>Form 1099-B Instructions</h5>
        <p style={{ margin: '0.5rem 0' }}>
          Instructions for Form 1099-B, including barter exchange reporting requirements.
        </p>
        <a
          href="https://www.irs.gov/forms-pubs/about-form-1099-b"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0066cc', textDecoration: 'underline' }}
        >
          Form 1099-B Information on IRS.gov
        </a>
      </div>

      <div
        style={{
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          border: '1px solid #bbdefb',
          borderRadius: '4px',
          marginTop: '1rem',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>When to Seek Professional Help</p>
        <p style={{ marginBottom: 0 }}>
          Tax laws can be complex and change over time. If you have significant barter transactions or
          questions about your specific situation, we recommend consulting with a certified public
          accountant (CPA) or tax professional who can provide personalized guidance.
        </p>
      </div>

      <div style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
        <p style={{ margin: 0 }}>
          <strong>Disclaimer:</strong> This educational content is provided for informational purposes
          only and does not constitute tax advice. Tax laws are subject to change and may vary based on
          individual circumstances. Always consult with a qualified tax professional for advice specific
          to your situation.
        </p>
      </div>
    </div>
  );
}
