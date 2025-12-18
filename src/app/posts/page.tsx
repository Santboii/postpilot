'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Post, PostStatus, PlatformId, PLATFORMS } from '@/types';
import { getPosts, deletePost, publishPost } from '@/lib/db';
import ConfirmModal from '@/components/ui/ConfirmModal';
import styles from './page.module.css';

type FilterStatus = 'all' | PostStatus;

interface ModalState {
    isOpen: boolean;
    type: 'delete' | 'publish' | null;
    postId: string | null;
    postContent: string;
}

function PostsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterPlatform, setFilterPlatform] = useState<PlatformId | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [modal, setModal] = useState<ModalState>({
        isOpen: false,
        type: null,
        postId: null,
        postContent: '',
    });

    const loadPosts = useCallback(async () => {
        setLoading(true);
        const data = await getPosts();
        setPosts(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        // Read filter from URL params
        const statusParam = searchParams.get('status');
        if (statusParam && ['draft', 'scheduled', 'published', 'failed'].includes(statusParam)) {
            setFilterStatus(statusParam as FilterStatus);
        }
        loadPosts();
    }, [searchParams, loadPosts]);

    const filteredPosts = useMemo(() => {
        return posts.filter(post => {
            // Status filter
            if (filterStatus !== 'all' && post.status !== filterStatus) {
                return false;
            }
            // Platform filter
            if (filterPlatform !== 'all' && !post.platforms.includes(filterPlatform)) {
                return false;
            }
            // Search filter
            if (searchQuery && !post.content.toLowerCase().includes(searchQuery.toLowerCase())) {
                return false;
            }
            return true;
        });
    }, [posts, filterStatus, filterPlatform, searchQuery]);

    const statusCounts = useMemo(() => {
        return {
            all: posts.length,
            draft: posts.filter(p => p.status === 'draft').length,
            scheduled: posts.filter(p => p.status === 'scheduled').length,
            published: posts.filter(p => p.status === 'published').length,
            failed: posts.filter(p => p.status === 'failed').length,
        };
    }, [posts]);

    const handleEdit = (postId: string) => {
        router.push(`/posts/${postId}`);
    };

    const openDeleteModal = (post: Post) => {
        setModal({
            isOpen: true,
            type: 'delete',
            postId: post.id,
            postContent: post.content.slice(0, 100) + (post.content.length > 100 ? '...' : ''),
        });
    };

    const openPublishModal = (post: Post) => {
        setModal({
            isOpen: true,
            type: 'publish',
            postId: post.id,
            postContent: post.content.slice(0, 100) + (post.content.length > 100 ? '...' : ''),
        });
    };

    const closeModal = () => {
        setModal({ isOpen: false, type: null, postId: null, postContent: '' });
    };

    const handleConfirm = async () => {
        if (!modal.postId) return;

        setIsProcessing(true);
        try {
            if (modal.type === 'delete') {
                await deletePost(modal.postId);
            } else if (modal.type === 'publish') {
                await publishPost(modal.postId);
            }
            await loadPosts();
            closeModal();
        } catch (error) {
            console.error(`Failed to ${modal.type} post:`, error);
            // Keep modal open to show error state could be added here
        } finally {
            setIsProcessing(false);
        }
    };

    const getStatusBadge = (status: PostStatus) => {
        const config = {
            draft: { icon: '📝', label: 'Draft', className: styles.statusDraft },
            scheduled: { icon: '📅', label: 'Scheduled', className: styles.statusScheduled },
            published: { icon: '✅', label: 'Published', className: styles.statusPublished },
            failed: { icon: '❌', label: 'Failed', className: styles.statusFailed },
        };
        return config[status];
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const getRelevantDate = (post: Post) => {
        if (post.status === 'published' && post.publishedAt) {
            return { label: 'Published', date: formatDate(post.publishedAt), icon: '✅', className: styles.datePublished };
        }
        if (post.status === 'scheduled' && post.scheduledAt) {
            return { label: 'Scheduled for', date: formatDate(post.scheduledAt), icon: '📅', className: styles.dateScheduled };
        }
        return { label: 'Created', date: formatDate(post.createdAt), icon: '🕐', className: styles.dateCreated };
    };

    const statusTabs: { key: FilterStatus; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'draft', label: 'Drafts' },
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'published', label: 'Published' },
        { key: 'failed', label: 'Failed' },
    ];

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.title}>Posts</h1>
                <Link href="/compose" className={styles.newBtn}>
                    + New Post
                </Link>
            </div>

            {/* Status Tabs */}
            <div className={styles.tabs}>
                {statusTabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tab} ${filterStatus === tab.key ? styles.tabActive : ''}`}
                        onClick={() => setFilterStatus(tab.key)}
                    >
                        {tab.label}
                        {statusCounts[tab.key] > 0 && (
                            <span className={styles.tabCount}>{statusCounts[tab.key]}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                <select
                    className={styles.filterSelect}
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value as PlatformId | 'all')}
                >
                    <option value="all">All Platforms</option>
                    {PLATFORMS.map(p => (
                        <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                    ))}
                </select>

                <div className={styles.searchWrapper}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search posts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Posts List */}
            {filteredPosts.length === 0 ? (
                <div className={styles.empty}>
                    <span className={styles.emptyIcon}>📭</span>
                    <h2>No posts found</h2>
                    <p>
                        {filterStatus === 'all' && !searchQuery
                            ? 'Create your first post to get started'
                            : 'Try adjusting your filters'}
                    </p>
                    {filterStatus === 'all' && !searchQuery && (
                        <Link href="/compose" className={styles.emptyBtn}>
                            + Create Post
                        </Link>
                    )}
                </div>
            ) : (
                <div className={styles.postsList}>
                    {filteredPosts.map(post => {
                        const status = getStatusBadge(post.status);
                        const dateInfo = getRelevantDate(post);

                        return (
                            <div key={post.id} className={styles.postCard}>
                                <div className={styles.postHeader}>
                                    <span className={`${styles.statusBadge} ${status.className}`}>
                                        {status.icon} {status.label}
                                    </span>
                                    {post.media && post.media.length > 0 && (
                                        <span className={styles.mediaBadge} title={`${post.media.length} image${post.media.length > 1 ? 's' : ''} attached`}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                                                <path d="M21 15L16 10L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            {post.media.length}
                                        </span>
                                    )}
                                    <span className={`${styles.postDate} ${dateInfo.className}`}>
                                        {dateInfo.icon} {dateInfo.label} {dateInfo.date}
                                    </span>
                                </div>

                                <p className={styles.postContent}>
                                    {post.content.length > 150
                                        ? post.content.slice(0, 150) + '...'
                                        : post.content}
                                </p>

                                <div className={styles.postFooter}>
                                    <div className={styles.platforms}>
                                        {post.platforms.map(platformId => {
                                            const platform = PLATFORMS.find(p => p.id === platformId);
                                            return (
                                                <span
                                                    key={platformId}
                                                    className={styles.platformIcon}
                                                    style={{ color: platform?.color }}
                                                    title={platform?.name}
                                                >
                                                    {platform?.icon}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    <div className={styles.actions}>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => handleEdit(post.id)}
                                        >
                                            ✏️ Edit
                                        </button>
                                        {(post.status === 'scheduled' || post.status === 'draft') && (
                                            <button
                                                className={`${styles.actionBtn} ${styles.publishBtn}`}
                                                onClick={() => openPublishModal(post)}
                                            >
                                                🚀 Publish
                                            </button>
                                        )}
                                        <button
                                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                            onClick={() => openDeleteModal(post)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={modal.isOpen}
                title={modal.type === 'delete' ? 'Delete Post?' : 'Publish Post?'}
                message={
                    modal.type === 'delete'
                        ? <><strong>This action cannot be undone.</strong><br /><br />Post: "{modal.postContent}"</>
                        : <>Publish this post to Facebook now?<br /><br />Post: "{modal.postContent}"</>
                }
                confirmText={modal.type === 'delete' ? 'Delete' : 'Publish Now'}
                variant={modal.type === 'delete' ? 'danger' : 'success'}
                onConfirm={handleConfirm}
                onCancel={closeModal}
                isLoading={isProcessing}
            />
        </div>
    );
}

export default function PostsPage() {
    return (
        <Suspense fallback={<div className={styles.container}>Loading...</div>}>
            <PostsPageContent />
        </Suspense>
    );
}
