import { useNavigate } from 'react-router-dom';
import { ComprehensiveWorksheet } from '../components/onboarding/ComprehensiveWorksheet';
import styles from './auth/Signup.module.css';

/**
 * Test page for product setup worksheet - accessible at /product-setup-test
 * Matches the exact layout from CheckoutSuccess for local development
 */
export default function ProductSetupTest() {
  const navigate = useNavigate();

  const handleComplete = (data: any) => {
    console.log('Worksheet submitted:', data);
    // TODO: Save data to database here
    // Redirect to CPG dashboard
    navigate('/cpg');
  };

  const handleSkip = () => {
    console.log('User skipped product setup');
    navigate('/cpg');
  };

  return (
    <div className={styles.container}>
      <div className={styles.wideCard}>
        <ComprehensiveWorksheet
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}
