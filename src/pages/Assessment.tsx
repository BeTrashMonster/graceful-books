/**
 * Assessment Page (Simplified)
 *
 * Explains the Steadiness communication approach used throughout the application.
 * DISC assessment system has been removed per requirements - Steadiness style for ALL users.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '../components/core/Button';

/**
 * Assessment page component
 *
 * Shows explanation of Steadiness communication style and business phase assessment info.
 */
export default function Assessment() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <h1>Welcome to Graceful Books</h1>

      <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '1px solid #b0d8ff' }}>
        <h2 style={{ marginTop: 0 }}>Our Communication Style</h2>
        <p>
          We use a <strong>patient, step-by-step approach</strong> for all users throughout Graceful Books.
          You'll find:
        </p>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Clear guidance</strong> - We explain each step carefully</li>
          <li><strong>Supportive messaging</strong> - No judgment, just help when you need it</li>
          <li><strong>No rush</strong> - Take your time to understand and complete tasks</li>
          <li><strong>Reliable support</strong> - Consistent, stable experience throughout</li>
        </ul>
      </div>

      <div style={{ marginTop: '32px' }}>
        <h2>Business Phase Assessment</h2>
        <p>
          To give you the best experience, we'll ask a few questions about your business to understand
          where you are in your financial journey:
        </p>

        <div style={{ marginTop: '24px', display: 'grid', gap: '16px' }}>
          <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
            <h3 style={{ marginTop: 0, color: '#2563eb' }}>Stabilize</h3>
            <p style={{ marginBottom: 0, color: '#6b7280' }}>
              Getting started with separating business and personal finances
            </p>
          </div>

          <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
            <h3 style={{ marginTop: 0, color: '#2563eb' }}>Organize</h3>
            <p style={{ marginBottom: 0, color: '#6b7280' }}>
              Building consistent processes and proper categorization
            </p>
          </div>

          <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
            <h3 style={{ marginTop: 0, color: '#2563eb' }}>Build</h3>
            <p style={{ marginBottom: 0, color: '#6b7280' }}>
              Using advanced features, reporting, and forecasting
            </p>
          </div>

          <div style={{ padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
            <h3 style={{ marginTop: 0, color: '#2563eb' }}>Grow</h3>
            <p style={{ marginBottom: 0, color: '#6b7280' }}>
              Managing multiple entities, analytics, and team collaboration
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '40px', padding: '24px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
        <p style={{ margin: 0, color: '#6b7280' }}>
          <strong>Note:</strong> The detailed business phase assessment is coming soon.
          For now, you can proceed directly to your dashboard to start exploring Graceful Books.
        </p>
      </div>

      <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button
          onClick={() => navigate('/')}
          variant="secondary"
        >
          Go Back
        </Button>
        <Button
          onClick={() => navigate('/dashboard')}
          variant="primary"
        >
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}
