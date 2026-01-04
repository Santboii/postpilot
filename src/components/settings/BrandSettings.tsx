"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useQueryClient } from '@tanstack/react-query';
import { useBrandProfile, queryKeys } from '@/hooks/useQueries';
import { BrandProfile } from '@/types';
import styles from './BrandSettings.module.css';

const PREDEFINED_TONES = [
    'Professional', 'Witty', 'Empathetic', 'Bold', 'Technical', 'Friendly', 'Concise', 'Authoritative'
];

export default function BrandSettings() {
    const queryClient = useQueryClient();
    const { data: serverProfile, isLoading } = useBrandProfile();

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [profile, setProfile] = useState<Partial<BrandProfile>>({
        brand_name: '',
        audience: '',
        tone: '',
        examples: ['']
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        if (serverProfile) {
            const examples = serverProfile.examples || [];
            if (examples.length === 0) examples.push('');
            setProfile({ ...serverProfile, examples });
        }
    }, [serverProfile]);

    const isInitialLoading = isLoading && !serverProfile;

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const profileData = {
                user_id: user.id,
                brand_name: profile.brand_name,
                audience: profile.audience,
                tone: profile.tone,
                examples: profile.examples?.filter(ex => ex.trim() !== '') || [],
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('brand_profiles')
                .upsert(profileData, { onConflict: 'user_id' });

            if (error) throw error;

            await queryClient.invalidateQueries({ queryKey: queryKeys.brandProfile });

            setMessage({ type: 'success', text: 'Saved!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error saving profile:', error);
            setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const updateExample = (index: number, value: string) => {
        const newExamples = [...(profile.examples || [])];
        newExamples[index] = value;
        setProfile({ ...profile, examples: newExamples });
    };

    const addExample = () => {
        const newExamples = [...(profile.examples || []), ''];
        setProfile({ ...profile, examples: newExamples });
    };

    const removeExample = (index: number) => {
        const newExamples = [...(profile.examples || [])];
        newExamples.splice(index, 1);
        if (newExamples.length === 0) newExamples.push('');
        setProfile({ ...profile, examples: newExamples });
    };

    const toggleTone = (t: string) => {
        const currentTones = profile.tone ? profile.tone.split(',').map(s => s.trim()).filter(Boolean) : [];
        if (currentTones.includes(t)) {
            const newTones = currentTones.filter(tone => tone !== t);
            setProfile({ ...profile, tone: newTones.join(', ') });
        } else {
            setProfile({ ...profile, tone: [...currentTones, t].join(', ') });
        }
    };

    const selectedTones = profile.tone ? profile.tone.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (isInitialLoading) {
        return (
            <div className={styles.loadingState}>
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingSpinner} />
                    <p className={styles.loadingText}>Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.panelHeader}>
                <h2>Brand Identity</h2>
                <p>Define your brand voice so AI-generated content sounds like you.</p>
            </div>

            {message && (
                <div className={`${styles.message} ${message.type === 'success' ? styles.messageSuccess : styles.messageError}`}>
                    {message.type === 'success' ? '✓' : '!'} {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className={styles.form}>
                {/* Brand Name */}
                <div className={styles.settingRow}>
                    <div className={styles.settingLabel}>
                        <strong>Brand Name</strong>
                        <span>Your company or personal brand</span>
                    </div>
                    <input
                        type="text"
                        value={profile.brand_name}
                        onChange={e => setProfile({ ...profile, brand_name: e.target.value })}
                        className={styles.input}
                        placeholder="e.g. Acme Corp"
                    />
                </div>

                {/* Target Audience */}
                <div className={styles.settingRow}>
                    <div className={styles.settingLabel}>
                        <strong>Target Audience</strong>
                        <span>Who you create content for</span>
                    </div>
                    <input
                        type="text"
                        value={profile.audience}
                        onChange={e => setProfile({ ...profile, audience: e.target.value })}
                        className={styles.input}
                        placeholder="e.g. Startup founders, Tech enthusiasts"
                    />
                </div>

                {/* Tone of Voice */}
                <div className={styles.settingRowVertical}>
                    <div className={styles.settingLabel}>
                        <strong>Tone of Voice</strong>
                        <span>Select the tones that describe your brand</span>
                    </div>
                    <div className={styles.toneGrid}>
                        {PREDEFINED_TONES.map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => toggleTone(t)}
                                className={`${styles.toneTag} ${selectedTones.includes(t) ? styles.toneTagActive : ''}`}
                            >
                                {selectedTones.includes(t) ? '✓ ' : ''}{t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Example Posts */}
                <div className={styles.settingRowVertical}>
                    <div className={styles.settingLabel}>
                        <strong>Example Posts</strong>
                        <span>Paste your best posts to help AI learn your style (optional)</span>
                    </div>
                    <div className={styles.examplesContainer}>
                        {profile.examples?.map((example, index) => (
                            <div key={index} className={styles.exampleRow}>
                                <textarea
                                    value={example}
                                    onChange={e => updateExample(index, e.target.value)}
                                    className={styles.exampleTextarea}
                                    placeholder="Paste a high-performing post..."
                                    rows={3}
                                />
                                {(profile.examples?.length || 0) > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeExample(index)}
                                        className={styles.removeBtn}
                                        title="Remove example"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addExample} className={styles.addExampleBtn}>
                            + Add Example
                        </button>
                    </div>
                </div>

                {/* Save Button */}
                <div className={styles.actions}>
                    <button type="submit" disabled={saving} className={styles.saveBtn}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
