/**
 * SupportModal - Shared support modal used across all layouts
 *
 * Provides consistent support experience whether in CPG tool or bookkeeping app
 */

import { Modal } from './Modal';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupportModal({ isOpen, onClose }: SupportModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="We're Here to Help"
      closeOnBackdropClick={false}
      size="md"
      headerStyle={{
        background: 'linear-gradient(135deg, #4b006e 0%, #6b1a9e 100%)',
        color: '#E8D4A0',
        padding: '1rem 1.5rem',
        borderRadius: '0.5rem 0.5rem 0 0',
        fontSize: '2rem'
      }}
    >
      <div style={{
        padding: '0.75rem 1.5rem 1.5rem 1.5rem',
        textAlign: 'center',
        color: '#334155'
      }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '1rem'
        }}>
          👋
        </div>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 600,
          color: '#4b006e',
          marginBottom: '1rem',
          marginTop: '0'
        }}>
          Real Humans, Real Support
        </h3>
        <p style={{
          fontSize: '1rem',
          lineHeight: '1.6',
          marginBottom: '1.5rem',
          color: '#475569'
        }}>
          We hear you, and we're here to support you. Our team reviews every message personally.
        </p>

        <div style={{
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          border: '2px solid #D4AF37',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#64748b',
            marginBottom: '0.75rem',
            fontWeight: 500
          }}>
            Send us an email at:
          </p>
          <a
            href="mailto:hello@audacious.money"
            style={{
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#4b006e',
              textDecoration: 'none',
              display: 'inline-block',
              padding: '0.5rem 1rem',
              background: '#E8D4A0',
              borderRadius: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#D4AF37';
              e.currentTarget.style.color = '#2d1b00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#E8D4A0';
              e.currentTarget.style.color = '#4b006e';
            }}
          >
            hello@audacious.money
          </a>
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: '#64748b',
          lineHeight: '1.5'
        }}>
          We typically respond within <strong style={{ color: '#4b006e' }}>24-48 hours</strong>.
          <br />
          Thank you for your patience!
        </p>
      </div>
    </Modal>
  );
}
