'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Post, PLATFORMS } from '@/types';
import { getPosts } from '@/lib/db';
import PostPopover from '@/components/calendar/PostPopover';
import styles from './page.module.css';

type ViewType = 'month' | 'week' | 'day';

export default function CalendarPage() {
    const router = useRouter();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<ViewType>('month');
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

    const loadPosts = useCallback(async () => {
        setLoading(true);
        const data = await getPosts();
        setPosts(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Days from previous month to fill grid
        const startPadding = firstDay.getDay();
        const days = [];

        // Previous month days
        for (let i = startPadding - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month, -i),
                isCurrentMonth: false
            });
        }

        // Current month days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }

        // Next month days to fill remaining grid cells (assuming 6 rows max -> 42 cells)
        const endPadding = 42 - days.length;
        for (let i = 1; i <= endPadding; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }

        return days;
    };

    const getWeekDays = (date: Date) => {
        const day = date.getDay();
        const diff = date.getDate() - day;
        const days = [];

        for (let i = 0; i < 7; i++) {
            days.push(new Date(date.getFullYear(), date.getMonth(), diff + i));
        }

        return days;
    };

    const changeMonth = (delta: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
    };

    const changeWeek = (delta: number) => {
        setCurrentDate(new Date(currentDate.getTime() + delta * 7 * 24 * 60 * 60 * 1000));
    };

    const changeDay = (delta: number) => {
        setCurrentDate(new Date(currentDate.getTime() + delta * 24 * 60 * 60 * 1000));
    };

    const navigate = (delta: number) => {
        if (view === 'month') changeMonth(delta);
        else if (view === 'week') changeWeek(delta);
        else changeDay(delta);
    };

    const getDayPosts = (date: Date) => {
        return posts.filter(post => {
            const postDate = post.scheduledAt || post.publishedAt || post.createdAt;
            if (!postDate) return false;
            const d = new Date(postDate);
            return d.getDate() === date.getDate() &&
                d.getMonth() === date.getMonth() &&
                d.getFullYear() === date.getFullYear();
        });
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const getHeaderText = () => {
        if (view === 'month') {
            return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (view === 'week') {
            const weekDays = getWeekDays(currentDate);
            const start = weekDays[0];
            const end = weekDays[6];
            return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        }
    };

    const handlePostClick = (post: Post, event: React.MouseEvent) => {
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        setPopoverPosition({
            x: rect.right + 8,
            y: rect.top
        });
        setSelectedPost(post);
    };

    const handleCloseDetail = () => {
        setSelectedPost(null);
    };

    const handleEditPost = (post: Post) => {
        setSelectedPost(null);
        router.push(`/posts/${post.id}`);
    };

    const handlePostUpdated = () => {
        loadPosts();
        setSelectedPost(null);
    };

    const days = getDaysInMonth(currentDate);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const renderPostItem = (post: Post, showTime: boolean = true) => {
        const platform = PLATFORMS.find(p => p.id === post.platforms[0]);
        const borderColor = platform?.color || '#8b5cf6';
        const postDate = post.scheduledAt || post.createdAt;

        return (
            <button
                key={post.id}
                className={styles.postItem}
                style={{ borderLeftColor: borderColor }}
                onClick={(e) => handlePostClick(post, e)}
            >
                {showTime && (
                    <span className={styles.postTime}>
                        {new Date(postDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
                <span className={styles.postText}>{post.content}</span>
                <div className={styles.postPlatforms}>
                    {post.platforms.slice(0, 3).map(pId => {
                        const p = PLATFORMS.find(pl => pl.id === pId);
                        return p ? <span key={pId} style={{ color: p.color }}>{p.icon}</span> : null;
                    })}
                    {post.platforms.length > 3 && <span>+{post.platforms.length - 3}</span>}
                </div>
            </button>
        );
    };

    return (
        <div className={styles.calendarContainer}>
            <div className={styles.header}>
                <h1 className={styles.title}>{getHeaderText()}</h1>
                <div className={styles.headerControls}>
                    <div className={styles.viewToggle}>
                        <button
                            className={`${styles.viewBtn} ${view === 'month' ? styles.viewBtnActive : ''}`}
                            onClick={() => setView('month')}
                        >
                            Month
                        </button>
                        <button
                            className={`${styles.viewBtn} ${view === 'week' ? styles.viewBtnActive : ''}`}
                            onClick={() => setView('week')}
                        >
                            Week
                        </button>
                        <button
                            className={`${styles.viewBtn} ${view === 'day' ? styles.viewBtnActive : ''}`}
                            onClick={() => setView('day')}
                        >
                            Day
                        </button>
                    </div>
                    <div className={styles.controls}>
                        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Previous</button>
                        <button className="btn btn-secondary" onClick={() => setCurrentDate(new Date())}>Today</button>
                        <button className="btn btn-secondary" onClick={() => navigate(1)}>Next →</button>
                    </div>
                </div>
            </div>

            {/* Month View */}
            {view === 'month' && (
                <div className={styles.calendarGrid}>
                    {weekDays.map(day => (
                        <div key={day} className={styles.dayHeader}>{day}</div>
                    ))}

                    {days.map((day, index) => (
                        <div
                            key={index}
                            className={`${styles.dayCell} ${!day.isCurrentMonth ? styles.otherMonth : ''} ${isToday(day.date) ? styles.currentDay : ''}`}
                            onClick={() => {
                                setCurrentDate(day.date);
                                setView('day');
                            }}
                        >
                            <span className={styles.dayNumber}>{day.date.getDate()}</span>
                            <div className={styles.postsContainer}>
                                {getDayPosts(day.date).slice(0, 3).map(post => renderPostItem(post))}
                                {getDayPosts(day.date).length > 3 && (
                                    <span className={styles.morePosts}>
                                        +{getDayPosts(day.date).length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Week View */}
            {view === 'week' && (
                <div className={styles.weekView}>
                    <div className={styles.weekHeader}>
                        <div className={styles.timeGutter}></div>
                        {getWeekDays(currentDate).map((day, i) => (
                            <div
                                key={i}
                                className={`${styles.weekDayHeader} ${isToday(day) ? styles.weekDayToday : ''}`}
                                onClick={() => {
                                    setCurrentDate(day);
                                    setView('day');
                                }}
                            >
                                <span className={styles.weekDayName}>{weekDays[day.getDay()]}</span>
                                <span className={styles.weekDayNumber}>{day.getDate()}</span>
                            </div>
                        ))}
                    </div>
                    <div className={styles.weekBody}>
                        <div className={styles.timeColumn}>
                            {hours.map(hour => (
                                <div key={hour} className={styles.timeSlot}>
                                    {hour.toString().padStart(2, '0')}:00
                                </div>
                            ))}
                        </div>
                        <div className={styles.weekGrid}>
                            {getWeekDays(currentDate).map((day, dayIndex) => (
                                <div key={dayIndex} className={styles.weekDayColumn}>
                                    {getDayPosts(day).map(post => {
                                        const postDate = new Date(post.scheduledAt || post.createdAt);
                                        const hour = postDate.getHours();
                                        const minutes = postDate.getMinutes();
                                        const top = (hour * 60 + minutes) / (24 * 60) * 100;

                                        return (
                                            <div
                                                key={post.id}
                                                className={styles.weekPostItem}
                                                style={{
                                                    top: `${top}%`,
                                                    borderLeftColor: PLATFORMS.find(p => p.id === post.platforms[0])?.color
                                                }}
                                                onClick={(e) => handlePostClick(post, e)}
                                            >
                                                <span className={styles.weekPostTime}>
                                                    {postDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={styles.weekPostText}>{post.content}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Day View */}
            {view === 'day' && (
                <div className={styles.dayView}>
                    <div className={styles.dayTimeline}>
                        {hours.map(hour => {
                            const hourPosts = getDayPosts(currentDate).filter(post => {
                                const postDate = new Date(post.scheduledAt || post.createdAt);
                                return postDate.getHours() === hour;
                            });

                            return (
                                <div key={hour} className={styles.dayTimeSlot}>
                                    <div className={styles.dayTimeLabel}>
                                        {hour.toString().padStart(2, '0')}:00
                                    </div>
                                    <div className={styles.dayTimeContent}>
                                        {hourPosts.map(post => renderPostItem(post, true))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Post Popover */}
            {selectedPost && (
                <PostPopover
                    post={selectedPost}
                    position={popoverPosition}
                    onClose={handleCloseDetail}
                    onEdit={handleEditPost}
                    onPostUpdated={handlePostUpdated}
                />
            )}
        </div>
    );
}
