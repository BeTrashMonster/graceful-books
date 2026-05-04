/**
 * Loading Overlay Demo Page
 *
 * Visual preview of the loading overlay used throughout the application
 */

import { useState } from 'react';
import { LoadingOverlay } from '../components/feedback/Loading';
import styles from './LoadingOverlayDemo.module.css';

export default function LoadingOverlayDemo() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayType, setOverlayType] = useState<'pageloader' | 'simple'>('pageloader');

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Loading Overlay Demo</h1>

        <p className={styles.description}>
          This is the loading overlay that appears when users click "Confirm + Save"
          on the CPG worksheet step 3. It prevents duplicate submissions and provides
          clear feedback that the system is processing their data.
        </p>

        <div className={styles.overlayTypeSelector}>
          <h2 className={styles.subtitle}>Choose Style:</h2>
          <div className={styles.buttonGroup}>
            <button
              className={overlayType === 'pageloader' ? styles.activeTypeButton : styles.typeButton}
              onClick={() => setOverlayType('pageloader')}
            >
              PageLoader Style
            </button>
            <button
              className={overlayType === 'simple' ? styles.activeTypeButton : styles.typeButton}
              onClick={() => setOverlayType('simple')}
            >
              Simple Style
            </button>
          </div>
        </div>

        <div className={styles.features}>
          <h2 className={styles.subtitle}>
            {overlayType === 'pageloader' ? 'PageLoader Style Features:' : 'Simple Style Features:'}
          </h2>
          {overlayType === 'pageloader' ? (
            <ul className={styles.featureList}>
              <li>🎨 Purple gradient background (matching app loading page)</li>
              <li>✨ Audacious Money logo with gentle pulse</li>
              <li>⭕ Three concentric spinner rings in gold (#D4AF37)</li>
              <li>📝 Calm, reassuring message</li>
              <li>♿ Fully accessible with ARIA support</li>
              <li>⚡ Respects reduced motion preferences</li>
            </ul>
          ) : (
            <ul className={styles.featureList}>
              <li>✨ Golden spinner animation (brand color #D4AF37)</li>
              <li>🌑 Semi-transparent dark background with blur effect</li>
              <li>📝 Clear, straightforward message</li>
              <li>🔒 Blocks all interaction with page behind it</li>
              <li>♿ Accessible with ARIA labels and screen reader support</li>
              <li>⚡ Respects reduced motion preferences</li>
            </ul>
          )}
        </div>

        <button
          className={styles.showButton}
          onClick={() => setShowOverlay(true)}
        >
          Show {overlayType === 'pageloader' ? 'PageLoader' : 'Simple'} Overlay
        </button>

        <div className={styles.mockWorksheet}>
          <h3>Mock Worksheet Content</h3>
          <p>This represents the content behind the overlay...</p>
          <div className={styles.mockProducts}>
            <div className={styles.mockProduct}>Product 1</div>
            <div className={styles.mockProduct}>Product 2</div>
            <div className={styles.mockProduct}>Product 3</div>
          </div>
        </div>
      </div>

      {overlayType === 'pageloader' ? (
        <LoadingOverlay
          isVisible={showOverlay}
          message="This is the 'calm before your clarity' moment"
          showLogo
        />
      ) : (
        <LoadingOverlay
          isVisible={showOverlay}
          message="Importing your worksheet into the system..."
          variant="spinner"
          size="lg"
        />
      )}

      {/* Click to close (demo only - real overlay doesn't close manually) */}
      {showOverlay && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            zIndex: 10001,
            fontSize: '0.875rem',
            color: '#333',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
          onClick={() => setShowOverlay(false)}
        >
          Click anywhere to close (demo only)
        </div>
      )}
    </div>
  );
}
