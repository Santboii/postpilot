'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Pause, Play, Edit3, FileText, Loader2, Check, X, Settings, MessageCircle, Hash, Users, Smile, Trash2 } from 'lucide-react';
import styles from './LibraryDetail.module.css';
import { ContentLibrary, Post, PLATFORMS, PlatformId } from '@/types';
import LibrarySettingsModal, { LibraryAiSettings } from '@/components/libraries/LibrarySettingsModal';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';

export default function LibraryDetailPage() {
    const params = useParams();
    const router = useRouter();
    const libraryId = params.id as string;

    const [library, setLibrary] = useState<ContentLibrary & { ai_settings?: LibraryAiSettings } | null>(null);
    const [posts, setPosts] = useState<(Post & { post_platforms?: { platform: string }[] })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editTopic, setEditTopic] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // AI Settings Modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        if (libraryId) {
            fetchLibraryAndPosts();
        }
    }, [libraryId]);

    const fetchLibraryAndPosts = async () => {
        try {
            setIsLoading(true);
            const libRes = await fetch(`/api/libraries/${libraryId}`);
            if (!libRes.ok) {
                throw new Error('Library not found');
            }
            const libData = await libRes.json();
            setLibrary(libData.library);
            setPosts(libData.posts || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartEdit = () => {
        if (!library) return;
        setEditName(library.name);
        setEditTopic(library.topic_prompt || '');
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    const handleSaveEdit = async () => {
        if (!library || !editName.trim()) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/libraries/${library.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    topic_prompt: editTopic.trim(),
                }),
            });

            if (res.ok) {
                setLibrary({ ...library, name: editName.trim(), topic_prompt: editTopic.trim() });
                setIsEditing(false);
            }
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAiSettings = async (settings: LibraryAiSettings, platforms: PlatformId[]) => {
        if (!library) return;

        try {
            const res = await fetch(`/api/libraries/${libraryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ai_settings: settings,
                    platforms: platforms
                })
            });

            if (res.ok) {
                setLibrary({ ...library, ai_settings: settings, platforms: platforms });
            } else {
                alert('Failed to save settings');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('An error occurred');
            throw error;
        }
    };



    const handleGenerateMore = async () => {
        const topic = isEditing ? editTopic : library?.topic_prompt;
        if (!topic?.trim()) {
            alert('Add a topic prompt first to generate posts.');
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch('/api/libraries/generate-posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    libraryId: library?.id,
                    topicPrompt: topic,
                    count: 5
                }),
            });

            if (res.ok) {
                fetchLibraryAndPosts();
            } else {
                const err = await res.json();
                alert(`Failed to generate: ${err.error}`);
            }
        } catch (error) {
            console.error('Failed to generate posts:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleTogglePause = async () => {
        if (!library) return;

        try {
            const res = await fetch('/api/libraries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: library.id,
                    is_paused: !library.is_paused,
                }),
            });

            if (res.ok) {
                setLibrary({ ...library, is_paused: !library.is_paused });
            }
        } catch (error) {
            console.error('Failed to toggle pause:', error);
        }
    };

    const handleDeleteLibrary = async () => {
        if (!library || !confirm('Are you sure you want to delete this library? This action cannot be undone and will delete all assigned posts.')) return;

        try {
            const res = await fetch(`/api/libraries/${library.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.push('/libraries');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete library');
            }
        } catch (error) {
            console.error('Failed to delete library:', error);
            alert('An error occurred while deleting the library');
        }
    };

    const getPostStats = () => {
        const total = posts.length;
        const scheduled = posts.filter(p => p.status === 'scheduled').length;
        const published = posts.filter(p => p.status === 'published').length;
        const drafts = posts.filter(p => p.status === 'draft').length;
        return { total, scheduled, published, drafts };
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>
                    <Loader2 size={32} className={styles.spinner} />
                    <p>Loading library...</p>
                </div>
            </div>
        );
    }

    if (error || !library) {
        return (
            <div className={styles.container}>
                <div className={styles.errorState}>
                    <h2>Library not found</h2>
                    <p>{error || 'The library you are looking for does not exist.'}</p>
                    <Link href="/libraries" className={styles.backLink}>
                        <ArrowLeft size={16} /> Back to Libraries
                    </Link>
                </div>
            </div>
        );
    }

    const stats = getPostStats();
    // Safely get settings
    const settings = library.ai_settings || {};
    // Check if we have any custom settings to show
    const hasSettings = Object.keys(settings).length > 0 && (
        settings.tone || settings.length || settings.audience || settings.language || settings.hashtag_strategy !== 'none'
    );

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <Link href="/libraries" className={styles.backLink}>
                    <ArrowLeft size={16} /> Back to Libraries
                </Link>
            </div>

            {/* Library Info */}
            <div className={styles.libraryCard}>
                <div className={styles.libraryHeader}>
                    <div className={styles.libraryIcon} style={{ backgroundColor: library.color }}>
                        <FileText size={24} />
                    </div>
                    <div className={styles.libraryInfo}>
                        {isEditing ? (
                            <div className={styles.editForm}>
                                <input
                                    type="text"
                                    className={styles.editInput}
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="Library name"
                                    autoFocus
                                />
                                <textarea
                                    className={styles.editTextarea}
                                    value={editTopic}
                                    onChange={e => setEditTopic(e.target.value)}
                                    placeholder="Topic prompt (e.g. Tips about StarCraft 2)"
                                    rows={2}
                                />
                                <div className={styles.editActions}>
                                    <button className={styles.saveBtn} onClick={handleSaveEdit} disabled={isSaving}>
                                        <Check size={16} /> {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button className={styles.cancelBtn} onClick={handleCancelEdit}>
                                        <X size={16} /> Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className={styles.titleRow}>
                                    <h1 className={styles.libraryName}>{library.name}</h1>
                                    <button className={styles.editLibraryBtn} onClick={handleStartEdit}>
                                        <Edit3 size={14} /> Edit
                                    </button>
                                </div>
                                {library.topic_prompt ? (
                                    <p className={styles.topicPrompt}>{library.topic_prompt}</p>
                                ) : (
                                    <p className={styles.noTopic}>No topic prompt — <button onClick={handleStartEdit}>add one</button></p>
                                )}

                                {/* Platform Icons */}
                                {library.platforms && library.platforms.length > 0 && (
                                    <div className={styles.platformRow} style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                        {library.platforms.map(pid => {
                                            const p = PLATFORMS.find(pl => pl.id === pid);
                                            return p ? (
                                                <div
                                                    key={pid}
                                                    className={styles.platformIconWrapper}
                                                    title={`${p.name} - This library posts to ${p.name}`}
                                                    style={{
                                                        color: p.color,
                                                        borderColor: p.color + '40', // 25% opacity border
                                                        backgroundColor: p.color + '10' // 6% opacity bg
                                                    }}
                                                >
                                                    {getPlatformIcon(pid, 24)}
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                )}

                                {hasSettings && (
                                    <div className={styles.settingsGrid} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: 'none', paddingTop: 0, marginTop: '12px' }}>
                                        {settings.tone && (
                                            <span className={styles.settingPill} title={`Tone: ${settings.tone === 'Custom' ? settings.custom_tone : settings.tone}`}>
                                                <MessageCircle />
                                                <span className={styles.settingValue}>
                                                    {settings.tone === 'Custom' ? settings.custom_tone : settings.tone}
                                                </span>
                                            </span>
                                        )}
                                        {settings.audience && (
                                            <span className={styles.settingPill} title={`Audience: ${settings.audience}`}>
                                                <Users />
                                                <span className={styles.settingValue}>{settings.audience}</span>
                                            </span>
                                        )}
                                        {settings.language && settings.language !== 'English' && (
                                            <span className={styles.settingPill} title={`Language: ${settings.language}`}>
                                                <span className={styles.settingValue}>{settings.language}</span>
                                            </span>
                                        )}
                                        {settings.length && (
                                            <span className={styles.settingPill} title={`Post Length: ${settings.length}`}>
                                                <FileText />
                                                <span className={styles.settingValue}>{settings.length}</span>
                                            </span>
                                        )}
                                        {settings.hashtag_strategy && settings.hashtag_strategy !== 'none' && (
                                            <span className={styles.settingPill} title={`Hashtags: ${settings.hashtag_strategy}`}>
                                                <Hash />
                                                <span className={styles.settingValue}>
                                                    {settings.hashtag_strategy === 'auto' ? 'Auto Tags' : 'Custom Tags'}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Fallback if only platforms exist but no AI settings */}

                            </>
                        )}
                    </div>
                    <div className={styles.libraryActions}>
                        <button
                            className={styles.settingsBtn}
                            onClick={() => setIsSettingsOpen(true)}
                            title="Library AI Generation Settings"
                        >
                            <Settings size={18} />
                        </button>
                        <button
                            className={`${styles.pauseBtn} ${library.is_paused ? styles.resumeBtn : ''}`}
                            onClick={handleTogglePause}
                            title={library.is_paused
                                ? 'Resume: Posts from this library will be auto-published at scheduled times'
                                : 'Pause: Stop auto-publishing posts from this library (drafts remain editable)'}
                        >
                            {library.is_paused ? <Play size={18} /> : <Pause size={18} />}
                            {library.is_paused ? 'Resume Publishing' : 'Pause Publishing'}
                        </button>
                        <button
                            className={styles.deleteLibBtn}
                            onClick={handleDeleteLibrary}
                            title="Delete Library"
                            style={{
                                marginLeft: '8px',
                                padding: '8px',
                                borderRadius: '8px',
                                border: '1px solid #ef4444',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className={styles.statsRow}>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.total}</span>
                        <span className={styles.statLabel}>Total</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.drafts}</span>
                        <span className={styles.statLabel}>Drafts</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.scheduled}</span>
                        <span className={styles.statLabel}>Scheduled</span>
                    </div>
                    <div className={styles.stat}>
                        <span className={styles.statValue}>{stats.published}</span>
                        <span className={styles.statLabel}>Published</span>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className={styles.quickActions}>
                    <button
                        className={styles.generateBtn}
                        onClick={handleGenerateMore}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={16} className={styles.spinner} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Generate 5 More
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Posts List */}
            <div className={styles.postsSection}>
                <h2 className={styles.sectionTitle}>Posts in this Library</h2>

                {posts.length === 0 ? (
                    <div className={styles.emptyPosts}>
                        <p>No posts in this library yet.</p>
                        <button className={styles.generateBtn} onClick={handleGenerateMore}>
                            <Sparkles size={16} /> Generate Posts
                        </button>
                    </div>
                ) : (
                    <div className={styles.postsList}>
                        {posts.map(post => (
                            <Link href={`/posts/${post.id}`} key={post.id} className={styles.postCard}>
                                <div className={styles.postMain}>
                                    <p className={styles.postContent}>{post.content}</p>
                                    <div className={styles.postMeta}>
                                        <div className={styles.platformBadges}>
                                            {post.post_platforms?.map(pp => (
                                                <span key={pp.platform} className={styles.platformBadge}>
                                                    {getPlatformIcon(pp.platform)}
                                                </span>
                                            ))}
                                            {(!post.post_platforms || post.post_platforms.length === 0) && (
                                                <span className={styles.noPlatform}>No platforms</span>
                                            )}
                                        </div>
                                        <span className={`${styles.statusBadge} ${styles[post.status]}`}>
                                            {post.status}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.postAction}>
                                    <Edit3 size={16} />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <LibrarySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                initialSettings={library?.ai_settings || {}}
                initialPlatforms={library?.platforms || []}
                onSave={handleSaveAiSettings}
            />
        </div>
    );
}
