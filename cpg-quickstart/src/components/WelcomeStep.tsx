interface WelcomeStepProps {
  onNext: () => void;
}

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="step welcome-step">
      <div className="step-header">
        <h1 className="step-title">Welcome to CPG Quick Start!</h1>
        <p className="step-description">
          This worksheet helps you set up your entire Cost Per Unit tracking system in one focused session.
        </p>
      </div>

      <div className="step-content">
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--primary-purple)' }}>
            What you'll do:
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                minWidth: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: 'var(--primary-purple)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>1</div>
              <div>
                <strong>Set up your ingredient categories</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)' }}>
                  Create categories like "Bottles," "Oils," "Labels" - with variants if needed
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                minWidth: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: 'var(--primary-purple)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>2</div>
              <div>
                <strong>Add your finished products</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)' }}>
                  List what you sell with names, prices (MSRP), and SKUs
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                minWidth: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: 'var(--primary-purple)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>3</div>
              <div>
                <strong>Define your recipes</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)' }}>
                  Tell us what goes into each product (e.g., "1 bottle, 16 oz lavender oil")
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                minWidth: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: 'var(--primary-purple)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>4</div>
              <div>
                <strong>Enter past invoices (optional)</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)' }}>
                  Add recent purchase invoices to see your costs immediately
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{
                minWidth: '2rem',
                height: '2rem',
                borderRadius: '50%',
                background: 'var(--primary-purple)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>5</div>
              <div>
                <strong>Review and export</strong>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-gray)' }}>
                  Double-check everything, then download your data file for April 1
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-gray-light)',
          padding: '1.5rem',
          borderRadius: '8px',
          border: '1px solid var(--border-gray)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', color: 'var(--primary-purple)' }}>
            Take your time
          </h3>
          <p style={{ margin: 0, color: 'var(--text-gray)' }}>
            Your work automatically saves as you go. You can stop anytime and come back later -
            just use the same browser on the same device. On April 1, you'll import your completed
            worksheet into the full software.
          </p>
        </div>

        <div style={{
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid var(--accent-gold)',
          padding: '1.5rem',
          borderRadius: '8px'
        }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0', color: 'var(--primary-purple)' }}>
            💡 Pro tip
          </h3>
          <p style={{ margin: 0, color: 'var(--text-gray)' }}>
            Gather a recent invoice, your product list, and your recipes before you start.
            Having everything handy makes this much easier!
          </p>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn btn-primary" onClick={onNext}>
          Let's Get Started →
        </button>
      </div>
    </div>
  );
}
