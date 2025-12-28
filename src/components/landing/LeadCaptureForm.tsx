'use client';

import { useState } from 'react';
import styles from './LeadCaptureForm.module.css';

export default function LeadCaptureForm() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            setStatus('success');
            setMessage(data.message || "You're in! Welcome to SocialsGenie.");
            setEmail('');
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Failed to submit. Please try again.');
        }
    };

    return (
        <div className={styles.container}>
            {status === 'success' ? (
                <div className={styles.successMessage}>
                    <p>{message}</p>
                    <button
                        onClick={() => setStatus('idle')}
                        className={styles.resetBtn}
                    >
                        Sign up another email
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email address"
                            className={styles.input}
                            required
                            disabled={status === 'loading'}
                        />
                        <button
                            type="submit"
                            className={styles.button}
                            disabled={status === 'loading'}
                        >
                            {status === 'loading' ? (
                                <span className={styles.spinner} />
                            ) : (
                                <>
                                    <span>Get Started Free</span>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                    {status === 'error' && (
                        <p className={styles.errorMessage}>{message}</p>
                    )}
                </form>
            )}
        </div>
    );
}
