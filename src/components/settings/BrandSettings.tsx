"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { BrandProfile } from '@/types';

const PREDEFINED_TONES = [
    'Professional', 'Witty', 'Empathetic', 'Bold', 'Technical', 'Friendly', 'Concise', 'Authoritative'
];

export default function BrandSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [profile, setProfile] = useState<Partial<BrandProfile>>({
        brand_name: '',
        audience: '',
        tone: '',
        examples: ['', '', '']
    });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('brand_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading profile:', error);
                return;
            }

            if (data) {
                const examples = data.examples || [];
                while (examples.length < 3) examples.push('');
                setProfile({ ...data, examples });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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
            setMessage({ type: 'success', text: 'Brand DNA saved successfully!' });
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

    const toggleTone = (t: string) => {
        if (profile.tone?.includes(t)) {
            setProfile({ ...profile, tone: profile.tone.replace(t, '').replace(', ,', ',').trim() });
        } else {
            const newTone = profile.tone ? `${profile.tone}, ${t}` : t;
            setProfile({ ...profile, tone: newTone });
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-t-[var(--accent-purple)] border-r-[var(--accent-purple)] border-b-transparent border-l-transparent animate-spin icon-spin" />
                    <p className="text-[var(--text-secondary)]">Extracting Brand DNA...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
            {/* Header */}
            <div className="text-center space-y-4 mb-6">
                <h1 className="text-4xl font-bold">
                    <span className="text-gradient">Brand DNA</span> 🧬
                </h1>
                <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                    Teach the AI accurately. By defining your voice and providing examples,
                    we ensure every generated post sounds exactly like you.
                </p>
            </div>

            {message && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 animate-slideIn ${message.type === 'success'
                    ? 'bg-[rgba(16,185,129,0.1)] border-[var(--border-success)] text-[var(--accent-green)]'
                    : 'bg-[rgba(239,68,68,0.1)] border-[var(--border-error)] text-[var(--accent-red)]'
                    }`}>
                    <span className="text-xl">{message.type === 'success' ? '✅' : '⚠️'}</span>
                    <p className="font-medium">{message.text}</p>
                </div>
            )}

            <form onSubmit={handleSave} className="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
                {/* Left Column: Core Identity */}
                <div className="card card-static space-y-6 h-fit">
                    <div className="flex items-center gap-3 pb-6 border-b border-[var(--border-subtle)]">
                        <div>
                            <h2 className="text-xl font-bold">Core Identity</h2>
                            <p className="text-sm text-[var(--text-secondary)]">Who you are & who you talk to</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Brand Name</label>
                            <input
                                type="text"
                                value={profile.brand_name}
                                onChange={e => setProfile({ ...profile, brand_name: e.target.value })}
                                className="input"
                                placeholder="e.g. Acme Corp"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Target Audience</label>
                            <input
                                type="text"
                                value={profile.audience}
                                onChange={e => setProfile({ ...profile, audience: e.target.value })}
                                className="input"
                                placeholder="e.g. Busy CTOs, Yoga Moms, Sci-Fi Fans"
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-[var(--text-secondary)]">Tone of Voice</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {PREDEFINED_TONES.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => toggleTone(t)}
                                        className={`badge cursor-pointer transition-all ${profile.tone?.includes(t)
                                            ? 'bg-[var(--accent-purple)] text-white border-transparent'
                                            : 'hover:bg-[var(--bg-elevated)]'
                                            }`}
                                    >
                                        {profile.tone?.includes(t) ? '✓ ' : '+ '}{t}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={profile.tone}
                                onChange={e => setProfile({ ...profile, tone: e.target.value })}
                                className="input min-h-[80px]"
                                placeholder="Describe your style..."
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Writing Style */}
                <div className="card card-static space-y-6">
                    <div className="flex items-center gap-3 pb-6 border-b border-[var(--border-subtle)]">
                        <div>
                            <h2 className="text-xl font-bold">Writing Style</h2>
                            <p className="text-sm text-[var(--text-secondary)]">Paste your best posts to clone your style</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {[0, 1, 2].map((index) => (
                            <div key={index} className="space-y-2 group">
                                <label className="flex justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] group-focus-within:text-[var(--accent-purple)] transition-colors">
                                    <span>Example #{index + 1}</span>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">Paste content</span>
                                </label>
                                <textarea
                                    value={profile.examples?.[index] || ''}
                                    onChange={e => updateExample(index, e.target.value)}
                                    className="input textarea bg-[var(--bg-tertiary)]/50 focus:bg-[var(--bg-elevated)]"
                                    placeholder="Paste a high-performing post here..."
                                    rows={4}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </form>

            <div className="flex justify-center pt-8 pb-12">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`btn btn-primary btn-lg w-full max-w-md text-lg shadow-xl ${saving ? 'opacity-80' : 'hover:scale-105'
                        }`}
                >
                    {saving ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving DNA...
                        </>
                    ) : (
                        <>Save Brand Profile ✨</>
                    )}
                </button>
            </div>
        </div>
    );
}
