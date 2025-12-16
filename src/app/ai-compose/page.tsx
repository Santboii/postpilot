'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformId, ToneType, PLATFORMS, getPlatform } from '@/types';
import { generatePosts, fetchUrlContent } from '@/lib/ai';
import { createPost } from '@/lib/db';
import styles from './page.module.css';

type ScheduleMode = 'now' | 'scheduled' | 'batch';

interface BatchSlot {
    date: string;
    time: string;
}

interface GeneratedContent {
    platformId: PlatformId;
    content: string;
    isEditing: boolean;
}

export default function AIComposePage() {
    const router = useRouter();

    // Input state
    const [topic, setTopic] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [tone, setTone] = useState<ToneType>('casual');
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['twitter']);

    // Scheduling state
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('scheduled');
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [batchSlots, setBatchSlots] = useState<BatchSlot[]>([
        { date: '', time: '10:00' },
        { date: '', time: '14:00' },
        { date: '', time: '09:00' },
    ]);
    const [uniqueBatchContent, setUniqueBatchContent] = useState(false);

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
    const [error, setError] = useState<string | null>(null);

    const togglePlatform = (id: PlatformId) => {
        setSelectedPlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const getMinDate = (): string => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    };

    const handleGenerate = async () => {
        if (!topic.trim()) {
            setError('Please enter a topic');
            return;
        }
        if (selectedPlatforms.length === 0) {
            setError('Please select at least one platform');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedContent([]);

        try {
            // Fetch URL content if provided
            let urlContent: string | undefined;
            if (sourceUrl.trim()) {
                try {
                    urlContent = await fetchUrlContent(sourceUrl);
                } catch {
                    console.warn('Could not fetch URL content');
                }
            }

            const suggestion = await generatePosts({
                topic,
                tone,
                platforms: selectedPlatforms,
                sourceUrl: sourceUrl || undefined,
                urlContent,
                pastPosts: [], // AI doesn't need past posts for now
            });

            // Convert suggestion variants to editable content
            setGeneratedContent(
                suggestion.variants.map(v => ({
                    platformId: v.platformId,
                    content: v.content,
                    isEditing: false,
                }))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate content');
        } finally {
            setIsGenerating(false);
        }
    };

    const updateGeneratedContent = (platformId: PlatformId, content: string) => {
        setGeneratedContent(prev =>
            prev.map(gc =>
                gc.platformId === platformId ? { ...gc, content } : gc
            )
        );
    };

    const toggleEditing = (platformId: PlatformId) => {
        setGeneratedContent(prev =>
            prev.map(gc =>
                gc.platformId === platformId ? { ...gc, isEditing: !gc.isEditing } : gc
            )
        );
    };

    const getScheduledAt = (): string | undefined => {
        if (scheduleMode === 'now') return undefined;
        if (!scheduleDate || !scheduleTime) return undefined;
        return new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    };

    const handleSchedule = async () => {
        if (generatedContent.length === 0) return;

        const scheduledAt = getScheduledAt();
        const status = scheduleMode === 'now' ? 'draft' : 'scheduled';

        try {
            if (scheduleMode === 'batch') {
                // Create separate posts for each batch slot
                for (const slot of batchSlots) {
                    if (slot.date && slot.time) {
                        const slotScheduledAt = new Date(`${slot.date}T${slot.time}`).toISOString();
                        for (const gc of generatedContent) {
                            await createPost({
                                content: gc.content,
                                platforms: [gc.platformId],
                                status: 'scheduled',
                                scheduledAt: slotScheduledAt,
                            });
                        }
                    }
                }
            } else {
                // Create single post for each platform
                for (const gc of generatedContent) {
                    await createPost({
                        content: gc.content,
                        platforms: [gc.platformId],
                        status,
                        scheduledAt,
                    });
                }
            }

            router.push('/calendar');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to schedule posts');
        }
    };

    const formatSchedulePreview = (): string => {
        if (!scheduleDate || !scheduleTime) return '';
        const date = new Date(`${scheduleDate}T${scheduleTime}`);
        return date.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const tones: { key: ToneType; icon: string; label: string }[] = [
        { key: 'casual', icon: '😊', label: 'Casual' },
        { key: 'professional', icon: '💼', label: 'Professional' },
        { key: 'promotional', icon: '🎉', label: 'Promotional' },
    ];

    return (
        <div className={styles.container}>
            {/* Left Column - Inputs */}
            <div className={styles.inputSection}>
                <div className={styles.sectionHeader}>
                    <h2>✨ AI Compose</h2>
                    <button
                        className={styles.manualBtn}
                        onClick={() => router.push('/compose')}
                    >
                        ✏️ Manual Mode
                    </button>
                </div>

                <div className={styles.inputCard}>
                    {/* Topic */}
                    <div className={styles.field}>
                        <label className={styles.label}>
                            What's this post about? <span className={styles.required}>*</span>
                        </label>
                        <textarea
                            className={styles.topicInput}
                            placeholder="Announce our new product launch, share productivity tips, promote upcoming webinar..."
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* URL */}
                    <div className={styles.field}>
                        <label className={styles.label}>
                            Reference URL <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                            type="url"
                            className={styles.urlInput}
                            placeholder="https://example.com/article-to-summarize"
                            value={sourceUrl}
                            onChange={e => setSourceUrl(e.target.value)}
                        />
                    </div>

                    {/* Tone */}
                    <div className={styles.field}>
                        <label className={styles.label}>Tone</label>
                        <div className={styles.toneGroup}>
                            {tones.map(t => (
                                <button
                                    key={t.key}
                                    className={`${styles.toneBtn} ${tone === t.key ? styles.toneBtnActive : ''}`}
                                    onClick={() => setTone(t.key)}
                                >
                                    <span>{t.icon}</span>
                                    <span>{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Platforms */}
                    <div className={styles.field}>
                        <label className={styles.label}>Platforms</label>
                        <div className={styles.platformGrid}>
                            {PLATFORMS.map(platform => (
                                <button
                                    key={platform.id}
                                    className={`${styles.platformBtn} ${selectedPlatforms.includes(platform.id) ? styles.platformBtnActive : ''}`}
                                    onClick={() => togglePlatform(platform.id)}
                                    style={{ '--platform-color': platform.color } as React.CSSProperties}
                                >
                                    <span className={styles.platformIcon}>{platform.icon}</span>
                                    <span>{platform.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <hr className={styles.divider} />

                    {/* Scheduling */}
                    <div className={styles.field}>
                        <label className={styles.label}>📅 Scheduling</label>
                        <div className={styles.scheduleOptions}>
                            <label className={styles.scheduleOption}>
                                <input
                                    type="radio"
                                    name="scheduleMode"
                                    checked={scheduleMode === 'now'}
                                    onChange={() => setScheduleMode('now')}
                                />
                                <span>Save as Draft</span>
                            </label>
                            <label className={styles.scheduleOption}>
                                <input
                                    type="radio"
                                    name="scheduleMode"
                                    checked={scheduleMode === 'scheduled'}
                                    onChange={() => setScheduleMode('scheduled')}
                                />
                                <span>Schedule for</span>
                            </label>
                            <label className={styles.scheduleOption}>
                                <input
                                    type="radio"
                                    name="scheduleMode"
                                    checked={scheduleMode === 'batch'}
                                    onChange={() => setScheduleMode('batch')}
                                />
                                <span>Batch Schedule</span>
                            </label>
                        </div>

                        {scheduleMode === 'scheduled' && (
                            <div className={styles.schedulePicker}>
                                <input
                                    type="date"
                                    className={styles.scheduleInput}
                                    value={scheduleDate}
                                    onChange={e => setScheduleDate(e.target.value)}
                                    min={getMinDate()}
                                />
                                <input
                                    type="time"
                                    className={styles.scheduleInput}
                                    value={scheduleTime}
                                    onChange={e => setScheduleTime(e.target.value)}
                                />
                                {scheduleDate && scheduleTime && (
                                    <span className={styles.schedulePreview}>
                                        🕐 {formatSchedulePreview()}
                                    </span>
                                )}
                            </div>
                        )}

                        {scheduleMode === 'batch' && (
                            <div className={styles.batchSection}>
                                <div className={styles.batchInfo}>
                                    <span>Schedule same content at different times</span>
                                </div>
                                {batchSlots.map((slot, index) => (
                                    <div key={index} className={styles.batchSlot}>
                                        <span className={styles.batchSlotLabel}>Slot {index + 1}</span>
                                        <input
                                            type="date"
                                            className={styles.scheduleInput}
                                            value={slot.date}
                                            onChange={e => {
                                                const newSlots = [...batchSlots];
                                                newSlots[index].date = e.target.value;
                                                setBatchSlots(newSlots);
                                            }}
                                            min={getMinDate()}
                                        />
                                        <input
                                            type="time"
                                            className={styles.scheduleInput}
                                            value={slot.time}
                                            onChange={e => {
                                                const newSlots = [...batchSlots];
                                                newSlots[index].time = e.target.value;
                                                setBatchSlots(newSlots);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className={styles.error}>⚠️ {error}</div>
                )}

                {/* Generate Button - Outside scrollable card */}
                <button
                    className={styles.generateBtn}
                    onClick={handleGenerate}
                    disabled={isGenerating || !topic.trim()}
                >
                    {isGenerating ? (
                        <>
                            <span className={styles.spinner}></span>
                            Generating...
                        </>
                    ) : (
                        <>✨ Generate Posts</>
                    )}
                </button>
            </div>

            {/* Right Column - Preview */}
            <div className={styles.previewSection}>
                <div className={styles.previewHeader}>
                    <span>👁️</span>
                    <span>Preview</span>
                </div>

                {generatedContent.length === 0 ? (
                    <div className={styles.emptyPreview}>
                        <span>✨</span>
                        <p>Enter a topic and click Generate to see AI-created posts</p>
                    </div>
                ) : (
                    <>
                        <div className={styles.previewCards}>
                            {generatedContent.map(gc => {
                                const platform = getPlatform(gc.platformId);
                                const charLimit = platform?.maxLength;
                                const isOverLimit = charLimit && gc.content.length > charLimit;

                                return (
                                    <div
                                        key={gc.platformId}
                                        className={`${styles.previewCard} ${gc.isEditing ? styles.previewCardEditing : ''} ${isOverLimit ? styles.previewCardError : ''}`}
                                    >
                                        <div className={styles.previewCardHeader}>
                                            <span
                                                className={styles.platformBadge}
                                                style={{ color: platform?.color }}
                                            >
                                                {platform?.icon} {platform?.name}
                                            </span>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => toggleEditing(gc.platformId)}
                                            >
                                                {gc.isEditing ? '✓ Done' : '✏️ Edit'}
                                            </button>
                                        </div>

                                        {gc.isEditing ? (
                                            <textarea
                                                className={styles.editTextarea}
                                                value={gc.content}
                                                onChange={e => updateGeneratedContent(gc.platformId, e.target.value)}
                                                rows={5}
                                            />
                                        ) : (
                                            <p className={styles.previewContent}>{gc.content}</p>
                                        )}

                                        {charLimit && (
                                            <span className={`${styles.charCount} ${isOverLimit ? styles.charCountError : ''}`}>
                                                {gc.content.length}/{charLimit}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className={styles.previewActions}>
                            <button
                                className={styles.scheduleBtn}
                                onClick={handleSchedule}
                            >
                                {scheduleMode === 'now' ? '📝 Save as Drafts' : '📅 Schedule Posts'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
