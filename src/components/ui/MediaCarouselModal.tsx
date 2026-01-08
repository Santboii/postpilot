'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import styles from './MediaCarouselModal.module.css';

interface MediaItem {
    url: string;
    type: string; // 'image' | 'video' | 'video/mp4' etc.
    alt?: string;
}

interface MediaCarouselModalProps {
    isOpen: boolean;
    onClose: () => void;
    mediaItems: MediaItem[];
    initialIndex: number;
}

export default function MediaCarouselModal({
    isOpen,
    onClose,
    mediaItems,
    initialIndex,
}: MediaCarouselModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    // Sync index if initialIndex changes while open (optional, but good practice)
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
        }
    }, [initialIndex, isOpen]);

    const handleNext = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
    }, [mediaItems.length]);

    const handlePrev = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
        e?.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
    }, [mediaItems.length]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') handleNext(e);
            if (e.key === 'ArrowLeft') handlePrev(e);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, handleNext, handlePrev]);

    if (!isOpen || mediaItems.length === 0) return null;

    // Helper to normalize strict type check
    const isVideo = (type: string) => type?.startsWith('video') || type === 'video';

    const currentItem = mediaItems[currentIndex];

    // Safety check if index is out of bounds or item is undefined
    if (!currentItem) return null;

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>
                    ✕
                </button>

                {/* Navigation Buttons */}
                {mediaItems.length > 1 && (
                    <>
                        <button className={`${styles.navBtn} ${styles.prevBtn}`} onClick={handlePrev}>
                            ‹
                        </button>
                        <button className={`${styles.navBtn} ${styles.nextBtn}`} onClick={handleNext}>
                            ›
                        </button>
                    </>
                )}

                {/* Media Content */}
                <div className={styles.mediaWrapper}>
                    {isVideo(currentItem.type) ? (
                        <video
                            src={currentItem.url}
                            controls
                            autoPlay
                            className={styles.mediaElement}
                            playsInline
                        />
                    ) : (
                        <div className={styles.imageContainer}>
                            <Image
                                src={currentItem.url}
                                alt={currentItem.alt || `Media ${currentIndex + 1}`}
                                fill
                                className={styles.mediaImage}
                                unoptimized
                            />
                        </div>
                    )}
                </div>

                {/* Counter */}
                {mediaItems.length > 1 && (
                    <div className={styles.counter}>
                        {currentIndex + 1} / {mediaItems.length}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
