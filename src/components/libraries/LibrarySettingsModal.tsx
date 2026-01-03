'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import styles from './LibrarySettingsModal.module.css';
import { Save, Sparkles, Loader2 } from 'lucide-react';
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
    generate_images?: boolean;
    pinterest_board_id?: string;
}

interface LibrarySettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialSettings: LibraryAiSettings;
    initialPlatforms?: PlatformId[];
    initialName?: string;
    initialTopic?: string;
    onSave: (name: string, topic: string, settings: LibraryAiSettings, platforms: PlatformId[]) => Promise<void>;
}

export default function LibrarySettingsModal({
    isOpen,
    onClose,
    initialSettings,
    initialPlatforms,
    initialName,
    initialTopic,
    onSave
}: LibrarySettingsModalProps) {
    const [settings, setSettings] = useState<LibraryAiSettings>(initialSettings || {});
    const [platforms, setPlatforms] = useState<PlatformId[]>(initialPlatforms || []);
    const [name, setName] = useState(initialName || '');
    const [topic, setTopic] = useState(initialTopic || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Pinterest board state
    const [pinterestBoards, setPinterestBoards] = useState<{ id: string; name: string }[]>([]);
    const [loadingBoards, setLoadingBoards] = useState(false);

    const fetchPinterestBoards = async () => {
        setLoadingBoards(true);
        try {
            const res = await fetch('/api/pinterest/boards');
            if (res.ok) {
                const data = await res.json();
                setPinterestBoards(data.boards || []);
            }
        } catch (error) {
            console.error('Failed to fetch Pinterest boards:', error);
        } finally {
            setLoadingBoards(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setSettings(initialSettings || {});
            setPlatforms(initialPlatforms || []);
            setName(initialName || '');
            setTopic(initialTopic || '');
            // Fetch boards if Pinterest is in platforms
            if (initialPlatforms?.includes('pinterest')) {
                fetchPinterestBoards();
            }
        }
    }, [isOpen, initialSettings, initialPlatforms, initialName, initialTopic]);

    const handleChange = (field: keyof LibraryAiSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleOptimizePrompt = async () => {
        if (!topic.trim() || isOptimizing) return;

        setIsOptimizing(true);
        try {
            const response = await fetch('/api/ai/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: topic, platform: 'general' })
            });

            if (!response.ok) throw new Error('Failed to optimize');

            const data = await response.json();
            setTopic(data.optimizedPrompt);
        } catch (error) {
            console.error('Failed to optimize prompt:', error);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handlePlatformToggle = (platformId: PlatformId) => {
        const isAdding = !platforms.includes(platformId);
        setPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(id => id !== platformId)
                : [...prev, platformId]
        );
        // Fetch boards when Pinterest is added
        if (platformId === 'pinterest' && isAdding && pinterestBoards.length === 0) {
            fetchPinterestBoards();
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            alert('Library name is required');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(name, topic, settings, platforms);
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
            title="Edit Library Settings"
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

                {/* Basic Info */}
                <div className={styles.formGroup}>
                    <label className={styles.label}>Library Name</label>
                    <input
                        type="text"
                        className={styles.input}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Daily Inspiration"
                    />
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.label}>
                        Topic Prompt
                        <span className={styles.subLabel}>What is this library about?</span>
                    </label>
                    <textarea
                        className={styles.textarea}
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g. Tips and tricks for playing StarCraft 2"
                        rows={3}
                    />
                    <div className={styles.inputActions}>
                        <button
                            className={styles.optimizeBtn}
                            onClick={handleOptimizePrompt}
                            disabled={!topic.trim() || isOptimizing}
                            type="button"
                        >
                            {isOptimizing ? (
                                <>
                                    <Loader2 size={14} className={styles.spinnerIcon} />
                                    Optimizing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    Optimize prompt
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className={styles.divider} />

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
                                    {getPlatformIcon(platform.id, 16)}
                                </span>
                                {platform.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Pinterest Board Selector */}
                {platforms.includes('pinterest') && (
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            Pinterest Board
                            <span className={styles.subLabel}>Where pins will be posted</span>
                        </label>
                        <select
                            className={styles.select}
                            value={settings.pinterest_board_id || ''}
                            onChange={e => handleChange('pinterest_board_id', e.target.value)}
                            disabled={loadingBoards}
                        >
                            <option value="">{loadingBoards ? 'Loading boards...' : 'Select a board'}</option>
                            {pinterestBoards.map(board => (
                                <option key={board.id} value={board.id}>{board.name}</option>
                            ))}
                        </select>
                    </div>
                )}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.use_emojis !== false} // Default true
                                onChange={e => handleChange('use_emojis', e.target.checked)}
                            />
                            <span className={styles.label} style={{ margin: 0 }}>Use Emojis</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={settings.generate_images === true}
                                onChange={e => handleChange('generate_images', e.target.checked)}
                            />
                            <div>
                                <span className={styles.label} style={{ margin: 0 }}>Generate Images</span>
                                <p className={styles.subLabel} style={{ margin: '2px 0 0 0', fontWeight: 400 }}>
                                    Automatically create AI images for each post
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

            </div>
        </Modal >
    );
}
