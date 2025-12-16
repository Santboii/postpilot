'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Post, PostStatus, PlatformId, PLATFORMS } from '@/types';
import { getPosts, deletePost, publishPost } from '@/lib/storage';
import styles from './page.module.css';

type FilterStatus = 'all' | PostStatus;

function PostsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [posts, setPosts] = useState<Post[]>([]);
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
    const [filterPlatform, setFilterPlatform] = useState<PlatformId | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Read filter from URL params
        const statusParam = searchParams.get('status');
        if (statusParam && ['draft', 'scheduled', 'published', 'failed'].includes(statusParam)) {
            setFilterStatus(statusParam as FilterStatus);
        }
        loadPosts();
    }, [searchParams]);

    const loadPosts = () => {
        setPosts(getPosts());
    };

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

    const handleDelete = (postId: string) => {
        if (confirm('Delete this post?')) {
            deletePost(postId);
            loadPosts();
        }
    };

    const handlePublish = (postId: string) => {
        if (confirm('Publish this post now?')) {
            publishPost(postId);
            loadPosts();
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
                                        {post.status === 'scheduled' && (
                                            <button
                                                className={`${styles.actionBtn} ${styles.publishBtn}`}
                                                onClick={() => handlePublish(post.id)}
                                            >
                                                🚀 Publish
                                            </button>
                                        )}
                                        <button
                                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                            onClick={() => handleDelete(post.id)}
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
