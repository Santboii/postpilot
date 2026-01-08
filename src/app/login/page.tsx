'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { signIn, signUp } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const priceId = searchParams.get('price_id');
    const redirectPath = priceId
        ? `/pricing?action=checkout&price_id=${priceId}`
        : '/';

    const getRedirectUrl = () => {
        return typeof window !== 'undefined'
            ? `${window.location.origin}${redirectPath}`
            : undefined;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await signUp(email, password, displayName, getRedirectUrl());
                if (error) {
                    setError(error.message);
                } else {
                    setMessage('Check your email for a confirmation link!');
                }
            } else {
                const { error } = await signIn(email, password);
                if (error) {
                    setError(error.message);
                } else {
                    router.push(redirectPath);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.bgOrbs}>
                <div className={styles.orb1}></div>
                <div className={styles.orb2}></div>
                <div className={styles.orb3}></div>
            </div>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.logo}>
                        <Image
                            src="/logo.png"
                            alt="SocialsGenie Logo"
                            width={100}
                            height={100}
                            style={{ width: 'auto', height: '100px' }}
                            priority
                        />
                    </div>
                    <h1>SocialsGenie</h1>
                    <p>{priceId ? 'Complete your subscription' : 'AI-Powered Social Media Management'}</p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {isSignUp && (
                        <div className={styles.field}>
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                placeholder="Your name"
                            />
                        </div>
                    )}

                    <div className={styles.field}>
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <div className={styles.error}>{error}</div>}
                    {message && <div className={styles.success}>{message}</div>}

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : isSignUp ? 'Create Account' : (priceId ? 'Sign In & Subscribe' : 'Sign In')}
                    </button>
                </form>

                <div className={styles.footer}>
                    <button
                        className={styles.toggleBtn}
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setMessage(null);
                        }}
                    >
                        {isSignUp
                            ? 'Already have an account? Sign in'
                            : "Don't have an account? Sign up"
                        }
                    </button>

                    <div className={styles.legalLinks}>
                        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                        <span className={styles.divider}>•</span>
                        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
