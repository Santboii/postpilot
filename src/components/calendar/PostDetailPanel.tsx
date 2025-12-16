'use client';

import { Post, PLATFORMS, PlatformId } from '@/types';
import { updatePost, deletePost, publishPost } from '@/lib/db';
import styles from './PostDetailPanel.module.css';

interface PostDetailPanelProps {
    post: Post | null;
    onClose: () => void;
    onEdit: (post: Post) => void;
    onPostUpdated: () => void;
}

export default function PostDetailPanel({ post, onClose, onEdit, onPostUpdated }: PostDetailPanelProps) {
    if (!post) return null;

    const getPlatformInfo = (platformId: PlatformId) => {
        return PLATFORMS.find(p => p.id === platformId);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'published': return styles.statusPublished;
            case 'scheduled': return styles.statusScheduled;
            case 'draft': return styles.statusDraft;
            case 'failed': return styles.statusFailed;
            default: return '';
        }
    };

    const handlePublishNow = async () => {
        if (confirm('Publish this post now?')) {
            try {
                await publishPost(post.id);
                onPostUpdated();
            } catch (err) {
                console.error('Failed to publish:', err);
            }
        }
    };

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this post?')) {
            try {
                await deletePost(post.id);
                onPostUpdated();
                onClose();
            } catch (err) {
                console.error('Failed to delete:', err);
            }
        }
    };

    const handleReschedule = async () => {
        const newDateTime = prompt(
            'Enter new date and time (YYYY-MM-DD HH:MM):',
            post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16).replace('T', ' ') : ''
        );

        if (newDateTime) {
            const dateObj = new Date(newDateTime.replace(' ', 'T'));
            if (!isNaN(dateObj.getTime())) {
                try {
                    await updatePost(post.id, {
                        scheduledAt: dateObj.toISOString(),
                        status: 'scheduled'
                    });
                    onPostUpdated();
                } catch (err) {
                    console.error('Failed to reschedule:', err);
                }
            } else {
                alert('Invalid date format. Please use YYYY-MM-DD HH:MM');
            }
        }
    };

    const scheduledDate = post.scheduledAt || post.publishedAt || post.createdAt;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.panel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Post Details</h2>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Status Badge */}
                    <div className={styles.statusRow}>
                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(post.status)}`}>
                            {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                    </div>

                    {/* Date & Time */}
                    <div className={styles.dateTimeSection}>
                        <div className={styles.dateIcon}>📅</div>
                        <div className={styles.dateInfo}>
                            <span className={styles.date}>{formatDate(scheduledDate)}</span>
                            <span className={styles.time}>{formatTime(scheduledDate)}</span>
                        </div>
                    </div>

                    {/* Platforms */}
                    <div className={styles.platformsSection}>
                        <h3 className={styles.sectionLabel}>Platforms</h3>
                        <div className={styles.platformList}>
                            {post.platforms.map(platformId => {
                                const platform = getPlatformInfo(platformId);
                                if (!platform) return null;
                                return (
                                    <div
                                        key={platformId}
                                        className={styles.platformBadge}
                                        style={{ borderColor: platform.color }}
                                    >
                                        <span className={styles.platformIcon} style={{ color: platform.color }}>
                                            {platform.icon}
                                        </span>
                                        <span>{platform.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Content */}
                    <div className={styles.contentSection}>
                        <h3 className={styles.sectionLabel}>Content</h3>
                        <div className={styles.postContent}>
                            {post.content}
                        </div>
                    </div>

                    {/* Character Counts */}
                    <div className={styles.characterCounts}>
                        {post.platforms.map(platformId => {
                            const platform = getPlatformInfo(platformId);
                            if (!platform?.maxLength) return null;
                            const count = post.content.length;
                            const isOver = count > platform.maxLength;
                            return (
                                <div key={platformId} className={styles.charCount}>
                                    <span style={{ color: platform.color }}>{platform.icon}</span>
                                    <span className={isOver ? styles.charOver : ''}>
                                        {count}/{platform.maxLength}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button
                        className={`btn btn-primary ${styles.actionBtn}`}
                        onClick={() => onEdit(post)}
                    >
                        ✏️ Edit
                    </button>

                    {post.status !== 'published' && (
                        <button
                            className={`btn btn-secondary ${styles.actionBtn}`}
                            onClick={handleReschedule}
                        >
                            🗓️ Reschedule
                        </button>
                    )}

                    {post.status === 'scheduled' && (
                        <button
                            className={`btn btn-secondary ${styles.actionBtn}`}
                            onClick={handlePublishNow}
                        >
                            🚀 Publish Now
                        </button>
                    )}

                    <button
                        className={`btn btn-ghost ${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={handleDelete}
                    >
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
