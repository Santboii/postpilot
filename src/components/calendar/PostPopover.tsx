'use client';

import { useEffect, useRef, useState } from 'react';
import { Post, PLATFORMS, PlatformId } from '@/types';
import { deletePost, publishPost } from '@/lib/db';
import styles from './PostPopover.module.css';

interface PopoverPosition {
    x: number;
    y: number;
}

interface PostPopoverProps {
    post: Post;
    position: PopoverPosition;
    onClose: () => void;
    onEdit: (post: Post) => void;
    onPostUpdated: () => void;
}

export default function PostPopover({ post, position, onClose, onEdit, onPostUpdated }: PostPopoverProps) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        // Adjust position to keep popover in viewport
        if (popoverRef.current) {
            const rect = popoverRef.current.getBoundingClientRect();
            const padding = 16;
            let x = position.x;
            let y = position.y;

            // Adjust horizontal position
            if (x + rect.width > window.innerWidth - padding) {
                x = window.innerWidth - rect.width - padding;
            }
            if (x < padding) x = padding;

            // Adjust vertical position
            if (y + rect.height > window.innerHeight - padding) {
                y = position.y - rect.height - 10;
            }
            if (y < padding) y = padding;

            setAdjustedPosition({ x, y });
        }
    }, [position]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const getPlatformInfo = (platformId: PlatformId) => {
        return PLATFORMS.find(p => p.id === platformId);
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handlePublishNow = async () => {
        if (confirm('Publish this post now?')) {
            try {
                await publishPost(post.id);
                onPostUpdated();
                onClose();
            } catch (err) {
                console.error('Failed to publish:', err);
            }
        }
    };

    const handleDelete = async () => {
        if (confirm('Delete this post?')) {
            try {
                await deletePost(post.id);
                onPostUpdated();
                onClose();
            } catch (err) {
                console.error('Failed to delete:', err);
            }
        }
    };

    const scheduledDate = post.scheduledAt || post.publishedAt || post.createdAt;

    return (
        <>
            <div className={styles.backdrop} onClick={onClose} />
            <div
                ref={popoverRef}
                className={styles.popover}
                style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className={styles.header}>
                    <span className={`${styles.status} ${styles[post.status]}`}>
                        {post.status}
                    </span>
                    <span className={styles.datetime}>
                        📅 {formatDateTime(scheduledDate)}
                    </span>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                {/* Platforms */}
                <div className={styles.platforms}>
                    {post.platforms.map(platformId => {
                        const platform = getPlatformInfo(platformId);
                        if (!platform) return null;
                        return (
                            <span key={platformId} className={styles.platformBadge} style={{ color: platform.color }}>
                                {platform.icon} {platform.name}
                            </span>
                        );
                    })}
                </div>

                {/* Content Preview */}
                <div className={styles.content}>
                    {post.content}
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => onEdit(post)}>
                        ✏️ Edit
                    </button>
                    {post.status === 'scheduled' && (
                        <button className={styles.publishBtn} onClick={handlePublishNow}>
                            🚀 Publish
                        </button>
                    )}
                    <button className={styles.deleteBtn} onClick={handleDelete}>
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </>
    );
}
