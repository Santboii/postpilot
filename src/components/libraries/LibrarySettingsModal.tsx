'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import styles from './LibrarySettingsModal.module.css';
import { Save } from 'lucide-react';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';

// ...

import { PLATFORMS, PlatformId } from '@/types';

export interface LibraryAiSettings {
    tone?: string;
    custom_tone?: string;
    length?: 'short' | 'medium' | 'long';
    audience?: string;
    language?: string;
    hashtag_strategy?: 'none' | 'auto' | 'custom';
    custom_hashtags?: string;
    use_emojis?: boolean;
}

interface LibrarySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSettings: LibraryAiSettings;
    initialPlatforms?: PlatformId[];
    onSave: (settings: LibraryAiSettings, platforms: PlatformId[]) => Promise<void>;
}

export default function LibrarySettingsModal({
    isOpen,
    onClose,
    initialSettings,
    initialPlatforms,
    onSave
}: LibrarySettingsModalProps) {
    const [settings, setSettings] = useState<LibraryAiSettings>(initialSettings || {});
    const [platforms, setPlatforms] = useState<PlatformId[]>(initialPlatforms || []);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSettings(initialSettings || {});
            setPlatforms(initialPlatforms || []);
        }
    }, [isOpen, initialSettings, initialPlatforms]);

    const handleChange = (field: keyof LibraryAiSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handlePlatformToggle = (platformId: PlatformId) => {
        setPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(id => id !== platformId)
                : [...prev, platformId]
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(settings, platforms);
            onClose();
        } catch (error) {
            console.error('Failed to save settings', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Library AI Generation Settings"
            size="lg"
            footer={
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button className={styles.saveBtn} onClick={handleSave} disabled={isSaving}>
                        <Save size={16} />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            }
        >
            <div className={styles.form}>

                {/* Platform Selection */}
                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        Authorized Platforms
                        <span className={styles.subLabel}>Which platforms can this library generate content for?</span>
                    </label>
                    <div className={styles.platformGrid}>
                        {PLATFORMS.map(platform => (
                            <button
                                key={platform.id}
                                className={`${styles.platformBtn} ${platforms.includes(platform.id) ? styles.active : ''}`}
                                onClick={() => handlePlatformToggle(platform.id)}
                            >
                                <span className={styles.platformIcon} style={{ color: platforms.includes(platform.id) ? platform.color : 'inherit' }}>
                                    {platform.icon}
                                </span>
                                {platform.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tone Section */}
                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        Tone
                        <span className={styles.subLabel}>How should the posts sound?</span>
                    </label>
                    <div className={styles.row}>
                        <select
                            className={styles.select}
                            value={settings.tone || 'Professional'}
                            onChange={e => handleChange('tone', e.target.value)}
                        >
                            <option value="Professional">Professional</option>
                            <option value="Casual">Casual</option>
                            <option value="Witty">Witty</option>
                            <option value="Bold">Bold</option>
                            <option value="Educational">Educational</option>
                            <option value="Custom">Custom...</option>
                        </select>
                        {settings.tone === 'Custom' && (
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="E.g. Sarcastic, Empathetic"
                                value={settings.custom_tone || ''}
                                onChange={e => handleChange('custom_tone', e.target.value)}
                            />
                        )}
                    </div>
                </div>

                {/* Length & Language Row */}
                <div className={styles.row}>
                    <div className={`${styles.col}`}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Post Length</label>
                            <select
                                className={styles.select}
                                value={settings.length || 'medium'}
                                onChange={e => handleChange('length', e.target.value)}
                            >
                                <option value="short">Short (under 50 words)</option>
                                <option value="medium">Medium (50-150 words)</option>
                                <option value="long">Long (150+ words)</option>
                            </select>
                        </div>
                    </div>
                    <div className={`${styles.col}`}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Language</label>
                            <select
                                className={styles.select}
                                value={settings.language || 'English'}
                                onChange={e => handleChange('language', e.target.value)}
                            >
                                <option value="English">English</option>
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="German">German</option>
                                <option value="Portuguese">Portuguese</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Audience */}
                <div className={styles.formGroup}>
                    <label className={styles.label}>Target Audience</label>
                    <input
                        type="text"
                        className={styles.input}
                        placeholder="E.g. Startup founders, Stay-at-home parents, Gamers"
                        value={settings.audience || ''}
                        onChange={e => handleChange('audience', e.target.value)}
                    />
                </div>

                {/* Hashtag Strategy */}
                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        Hashtag Strategy
                        <span className={styles.subLabel}>How should hashtags be handled?</span>
                    </label>
                    <select
                        className={styles.select}
                        value={settings.hashtag_strategy || 'none'}
                        onChange={e => handleChange('hashtag_strategy', e.target.value)}
                    >
                        <option value="none">None (No hashtags)</option>
                        <option value="auto">Auto-Generate (AI picks relevant tags)</option>
                        <option value="custom">Custom (Always use specific tags)</option>
                    </select>

                    {settings.hashtag_strategy === 'custom' && (
                        <div style={{ marginTop: '8px' }}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="E.g. #SocialsGenie #Tech #Growth"
                                value={settings.custom_hashtags || ''}
                                onChange={e => handleChange('custom_hashtags', e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {/* Emojis Checkbox */}
                <div className={styles.formGroup}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.use_emojis !== false} // Default true
                            onChange={e => handleChange('use_emojis', e.target.checked)}
                        />
                        <span className={styles.label} style={{ margin: 0 }}>Use Emojis</span>
                    </label>
                </div>

            </div>
        </Modal>
    );
}
