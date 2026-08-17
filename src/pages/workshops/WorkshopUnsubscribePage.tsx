/**
 * Workshop Unsubscribe Page
 *
 * Allows users to unsubscribe from workshop email notifications.
 * Accessed via link in workshop emails.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import styles from './WorkshopUnsubscribePage.module.css';

const API_URL = 'https://api.audacious.money';

export default function WorkshopUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [message, setMessage] = useState('');

  const enrollmentId = searchParams.get('id');

  useEffect(() => {
    if (!enrollmentId) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. Please check your email and try again.');
      return;
    }

    handleUnsubscribe();
  }, [enrollmentId]);

  const handleUnsubscribe = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/workshop-unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enrollmentId }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.data?.message?.includes('already')) {
          setStatus('already');
        } else {
          setStatus('success');
        }
        setMessage(data.data?.message || 'You have been unsubscribed from workshop emails.');
      } else {
        setStatus('error');
        setMessage(data.error?.message || 'Unable to process your unsubscribe request.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('An error occurred. Please try again later.');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.icon}>
          {status === 'success' && '✓'}
          {status === 'already' && '✓'}
          {status === 'error' && '!'}
          {status === 'loading' && '...'}
        </div>

        <h1 className={styles.title}>
          {status === 'loading' && 'Processing...'}
          {status === 'success' && 'Unsubscribed'}
          {status === 'already' && 'Already Unsubscribed'}
          {status === 'error' && 'Oops!'}
        </h1>

        <p className={styles.message}>{message}</p>

        {status !== 'loading' && (
          <div className={styles.actions}>
            <Link to="/" className={styles.homeButton}>
              Go to Homepage
            </Link>
          </div>
        )}

        <p className={styles.footer}>
          Changed your mind? You can always re-subscribe by contacting us.
        </p>
      </div>
    </div>
  );
}
