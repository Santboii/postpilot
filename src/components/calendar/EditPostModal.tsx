'use client';

import { useState, useEffect } from 'react';
import { Post, PLATFORMS, PlatformId, getCharacterLimit } from '@/types';
import { updatePost } from '@/lib/db';
import styles from './EditPostModal.module.css';

interface EditPostModalProps {
    post: Post | null;
    onClose: () => void;
    onSaved: () => void;
}

export default function EditPostModal({ post, onClose, onSaved }: EditPostModalProps) {
    const [content, setContent] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [status, setStatus] = useState<'draft' | 'scheduled'>('draft');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (post) {
            setContent(post.content);
            setSelectedPlatforms(post.platforms);

            if (post.scheduledAt) {
                const date = new Date(post.scheduledAt);
                setScheduledDate(date.toISOString().slice(0, 10));
                setScheduledTime(date.toTimeString().slice(0, 5));
                setStatus('scheduled');
            } else {
                setStatus('draft');
            }
        }
    }, [post]);

    if (!post) return null;

    const togglePlatform = (id: PlatformId) => {
        setSelectedPlatforms(prev =>
            prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id]
        );
    };

    const getCharStatus = (platformId: PlatformId): 'ok' | 'warning' | 'error' => {
        const limit = getCharacterLimit(platformId);
        if (!limit) return 'ok';
        const ratio = content.length / limit;
        if (ratio > 1) return 'error';
        if (ratio > 0.9) return 'warning';
        return 'ok';
    };

    const hasErrors = () => {
        return selectedPlatforms.some(p => getCharStatus(p) === 'error') ||
            selectedPlatforms.length === 0 ||
            content.trim().length === 0;
    };

    const handleSave = async () => {
        if (hasErrors()) return;
        setSaving(true);

        try {
            let scheduledAt: string | undefined;
            if (status === 'scheduled' && scheduledDate && scheduledTime) {
                scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            }

            await updatePost(post.id, {
                content,
                platforms: selectedPlatforms,
                status,
                scheduledAt,
            });

            onSaved();
            onClose();
        } catch (err) {
            console.error('Failed to save:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Edit Post</h2>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Platform Selection */}
                    <div className={styles.section}>
                        <label className={styles.label}>Platforms</label>
                        <div className={styles.platformGrid}>
                            {PLATFORMS.map(platform => {
                                const isSelected = selectedPlatforms.includes(platform.id);
                                const charStatus = isSelected ? getCharStatus(platform.id) : 'ok';
                                const limit = getCharacterLimit(platform.id);

                                return (
                                    <button
                                        key={platform.id}
                                        type="button"
                                        className={`${styles.platformToggle} ${isSelected ? styles.platformSelected : ''}`}
                                        style={{
                                            borderColor: isSelected ? platform.color : undefined,
                                            '--platform-color': platform.color
                                        } as React.CSSProperties}
                                        onClick={() => togglePlatform(platform.id)}
                                    >
                                        <span className={styles.platformIcon}>{platform.icon}</span>
                                        <span className={styles.platformName}>{platform.name}</span>
                                        {isSelected && limit && (
                                            <span className={`${styles.charIndicator} ${styles[charStatus]}`}>
                                                {content.length}/{limit}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content */}
                    <div className={styles.section}>
                        <label className={styles.label}>Content</label>
                        <textarea
                            className={styles.textarea}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="What do you want to share?"
                            rows={6}
                        />
                    </div>

                    {/* Schedule */}
                    <div className={styles.section}>
                        <label className={styles.label}>Schedule</label>
                        <div className={styles.scheduleOptions}>
                            <label className={styles.radioLabel}>
                                <input
                                    type="radio"
                                    name="status"
                                    checked={status === 'draft'}
                                    onChange={() => setStatus('draft')}
                                />
                                <span>Save as draft</span>
                            </label>
                            <label className={styles.radioLabel}>
                                <input
                                    type="radio"
                                    name="status"
                                    checked={status === 'scheduled'}
                                    onChange={() => setStatus('scheduled')}
                                />
                                <span>Schedule for later</span>
                            </label>
                        </div>

                        {status === 'scheduled' && (
                            <div className={styles.dateTimeInputs}>
                                <input
                                    type="date"
                                    className={styles.dateInput}
                                    value={scheduledDate}
                                    onChange={(e) => setScheduledDate(e.target.value)}
                                />
                                <input
                                    type="time"
                                    className={styles.timeInput}
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={hasErrors()}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
