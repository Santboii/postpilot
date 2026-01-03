'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Pause, Play, Edit3, FileText, Loader2, Check, X, Settings, MessageCircle, Hash, Users, Smile, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import styles from './LibraryDetail.module.css';
import { ContentLibrary, Post, PLATFORMS, PlatformId } from '@/types';
import { deletePost } from '@/lib/db';
import LibrarySettingsModal, { LibraryAiSettings } from '@/components/libraries/LibrarySettingsModal';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function LibraryDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const libraryId = params.id as string;

    const [library, setLibrary] = useState<ContentLibrary & { ai_settings?: LibraryAiSettings } | null>(null);
    const [posts, setPosts] = useState<(Post & { post_platforms?: { platform: string }[] })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI Settings Modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Confirmation Modals
    const [showDeleteLibraryConfirm, setShowDeleteLibraryConfirm] = useState(false);
    const [showDeletePostConfirm, setShowDeletePostConfirm] = useState<string | null>(null);

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

    const handleSaveAiSettings = async (name: string, topic: string, settings: LibraryAiSettings, platforms: PlatformId[]) => {
        if (!library) return;

        try {
            const res = await fetch(`/api/libraries/${libraryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    topic_prompt: topic.trim(),
                    ai_settings: settings,
                    platforms: platforms
                })
            });

            if (res.ok) {
                setLibrary({
                    ...library,
                    name: name.trim(),
                    topic_prompt: topic.trim(),
                    ai_settings: settings,
                    platforms: platforms
                });
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
        const topic = library?.topic_prompt;
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
        setShowDeleteLibraryConfirm(true);
    };

    const confirmDeleteLibrary = async () => {
        if (!library) return;

        try {
            const res = await fetch(`/api/libraries/${library.id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                await queryClient.invalidateQueries({ queryKey: ['libraries'] });
                router.refresh();
                router.push('/libraries');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete library');
            }
        } catch (error) {
            console.error('Failed to delete library:', error);
            alert('An error occurred while deleting the library');
        } finally {
            setShowDeleteLibraryConfirm(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        setShowDeletePostConfirm(postId);
    };

    const confirmDeletePost = async () => {
        if (!showDeletePostConfirm) return;
        const postId = showDeletePostConfirm;

        try {
            await deletePost(postId);
            setPosts(posts.filter(p => p.id !== postId));
        } catch (error) {
            console.error('Failed to delete post:', error);
            alert('Failed to delete post');
        } finally {
            setShowDeletePostConfirm(null);
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
                {/* Header Skeleton */}
                <div className={styles.header}>
                    <div className="skeleton" style={{ width: 120, height: 24 }} />
                </div>

                {/* Library Card Skeleton */}
                <div className={styles.libraryCard}>
                    <div className={styles.libraryHeader}>
                        <div className="skeleton" style={{ width: 56, height: 56, borderRadius: 14 }} />
                        <div className={styles.libraryInfo} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div className="skeleton" style={{ width: '40%', height: 32 }} />
                            <div className="skeleton" style={{ width: '70%', height: 20 }} />
                            <div className="skeleton" style={{ width: '30%', height: 20 }} />
                        </div>
                    </div>

                    {/* Stats Skeleton */}
                    <div className={styles.statsRow}>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={styles.stat} style={{ width: '100%' }}>
                                <div className="skeleton" style={{ width: 40, height: 32, marginBottom: 8 }} />
                                <div className="skeleton" style={{ width: 60, height: 12 }} />
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions Skeleton */}
                    <div className={styles.quickActions}>
                        <div className="skeleton" style={{ width: 160, height: 48, borderRadius: 10 }} />
                    </div>
                </div>

                {/* Posts Section Skeleton */}
                <div className={styles.postsSection}>
                    <div className="skeleton" style={{ width: 180, height: 28, marginBottom: 16 }} />
                    <div className={styles.postsList}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className={styles.postCard} style={{ height: 320 }}>
                                <div className={styles.cardMediaPreview}>
                                    <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                                </div>
                                <div className={styles.cardContent}>
                                    <div className="skeleton" style={{ width: '100%', height: 16, marginBottom: 8 }} />
                                    <div className="skeleton" style={{ width: '80%', height: 16, marginBottom: 8 }} />
                                    <div className="skeleton" style={{ width: '60%', height: 16 }} />
                                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
                                        <div className="skeleton" style={{ width: 80, height: 20 }} />
                                        <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 99 }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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
                        <div className={styles.titleRow}>
                            <h1 className={styles.libraryName}>{library.name}</h1>
                        </div>
                        {library.topic_prompt ? (
                            <p className={styles.topicPrompt}>{library.topic_prompt}</p>
                        ) : (
                            <p className={styles.noTopic}>No topic prompt — <button onClick={() => setIsSettingsOpen(true)}>add one</button></p>
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
                        {posts.map(post => {
                            const postPlatforms = post.post_platforms?.map(pp => {
                                const p = PLATFORMS.find(pl => pl.id === pp.platform);
                                return p ? { ...p, id: pp.platform } : null;
                            }).filter(Boolean);

                            return (
                                <div
                                    key={post.id}
                                    className={styles.postCardWrapper}
                                    onClick={() => router.push(`/posts/${post.id}`)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className={styles.postCard}>
                                        <div className={styles.floatingStatus}>
                                            <span className={`${styles.statusBadge} ${styles[post.status]}`}>
                                                {post.status}
                                            </span>
                                        </div>

                                        {post.media && post.media.length > 0 && (
                                            <div className={styles.cardMediaPreview}>
                                                <img src={post.media[0].url} alt="Post media" loading="lazy" />
                                                {post.media.length > 1 && (
                                                    <span className={styles.mediaCount}>+{post.media.length - 1}</span>
                                                )}
                                            </div>
                                        )}
                                        <div className={`${styles.cardContent} ${(!post.media || post.media.length === 0) ? styles.noMedia : ''}`}>
                                            <div className={styles.postMain}>
                                                <p className={styles.postContent}>{post.content}</p>
                                            </div>
                                            <div className={styles.postMeta}>
                                                <div className={styles.platformBadges}>
                                                    {postPlatforms?.map(p => (
                                                        <span
                                                            key={p!.id}
                                                            className={styles.platformBadge}
                                                            style={{ color: p!.color }}
                                                            title={p!.name}
                                                        >
                                                            {getPlatformIcon(p!.id)}
                                                        </span>
                                                    ))}
                                                    {(!postPlatforms || postPlatforms.length === 0) && (
                                                        <span className={styles.noPlatform}>No platforms</span>
                                                    )}
                                                </div>

                                                <div className={styles.inlineActions}>
                                                    <button
                                                        className={styles.cardActionBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/posts/${post.id}`);
                                                        }}
                                                        title="Edit Post"
                                                    >
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button
                                                        className={`${styles.cardActionBtn} ${styles.deleteBtn}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeletePost(post.id);
                                                        }}
                                                        title="Delete Post"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <LibrarySettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                initialSettings={library?.ai_settings || {}}
                initialPlatforms={library?.platforms || []}
                initialName={library?.name}
                initialTopic={library?.topic_prompt || ''}
                onSave={handleSaveAiSettings}

            />

            {/* Confirmation Modals */}
            <ConfirmModal
                isOpen={showDeleteLibraryConfirm}
                title="Delete Library?"
                message="Are you sure you want to delete this library? This cannot be undone and will delete all posts within it."
                confirmText="Delete Library"
                variant="danger"
                onConfirm={confirmDeleteLibrary}
                onCancel={() => setShowDeleteLibraryConfirm(false)}
            />

            <ConfirmModal
                isOpen={!!showDeletePostConfirm}
                title="Delete Post?"
                message="Are you sure you want to delete this post?"
                confirmText="Delete"
                variant="danger"
                onConfirm={confirmDeletePost}
                onCancel={() => setShowDeletePostConfirm(null)}
            />
        </div>
    );
}
