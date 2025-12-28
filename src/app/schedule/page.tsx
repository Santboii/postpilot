'use client';

import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, ChevronDown } from 'lucide-react';
import styles from './Schedule.module.css';
import { ContentLibrary, WeeklySlot, PlatformId, PLATFORMS } from '@/types';
import { useWeeklySlots, useLibraries } from '@/hooks/useQueries';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23

export default function SchedulePage() {
    // Data Queries
    const { data: slots = [], refetch: refetchSlots, isLoading: slotsLoading, isError: slotsError, error: slotsErr } = useWeeklySlots();
    const { data: libraries = [], isLoading: libsLoading, isError: libsError, error: libsErr } = useLibraries();

    const isLoading = slotsLoading || libsLoading;
    const isError = slotsError || libsError;

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number>(0);
    const [selectedHour, setSelectedHour] = useState<number>(9);
    const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(['twitter', 'linkedin']);
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize library selection when libraries load
    useEffect(() => {
        if (libraries.length > 0 && !selectedLibraryId) {
            setSelectedLibraryId(libraries[0].id);
        }
    }, [libraries]);

    const handleCellClick = (dayIndex: number, hour: number) => {
        setSelectedDay(dayIndex);
        setSelectedHour(hour);
        setEditingSlotId(null); // Reset editing state
        setIsModalOpen(true);
        // Reset platforms if needed, or keep defaults
    };

    const handleSlotClick = (e: React.MouseEvent, slot: WeeklySlot) => {
        e.stopPropagation(); // Prevent triggering cell click
        setSelectedDay(slot.day_of_week);
        const [hour] = slot.time_of_day.split(':').map(Number);
        setSelectedHour(hour);
        setSelectedLibraryId(slot.library_id);
        setSelectedPlatforms(slot.platform_ids);
        setEditingSlotId(slot.id);
        setIsModalOpen(true);
    };

    const handleDeleteSlot = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this slot?')) return;

        try {
            await fetch(`/api/schedule/slots?id=${id}`, { method: 'DELETE' });
            refetchSlots();
        } catch (error) {
            console.error('Failed to delete slot', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const timeString = `${selectedHour.toString().padStart(2, '0')}:00:00`;

        try {
            const url = '/api/schedule/slots';
            const method = editingSlotId ? 'PUT' : 'POST';
            const body = {
                id: editingSlotId,
                library_id: selectedLibraryId,
                day_of_week: selectedDay,
                time_of_day: timeString,
                platform_ids: selectedPlatforms
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                refetchSlots();
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error('Failed to create slot', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const togglePlatform = (id: PlatformId) => {
        if (selectedPlatforms.includes(id)) {
            setSelectedPlatforms(selectedPlatforms.filter(p => p !== id));
        } else {
            setSelectedPlatforms([...selectedPlatforms, id]);
        }
    };

    // Helper to render slots in a day column
    const renderSlotsForDay = (dayIndex: number) => {
        const daySlots = slots.filter((s: WeeklySlot) => s.day_of_week === dayIndex);

        return daySlots.map((slot: WeeklySlot & { content_libraries?: any }) => {
            const [hour] = slot.time_of_day.split(':').map(Number);
            const top = hour * 60; // 60px per hour

            return (
                <div
                    key={slot.id}
                    className={styles.slot}
                    style={{
                        top: `${top + 4}px`,
                        height: `52px`,
                        backgroundColor: slot.content_libraries?.color || '#6366f1'
                    }}
                    title={`${slot.content_libraries?.name} (${slot.time_of_day})`}
                >
                    <div
                        style={{ height: '100%', width: '100%' }}
                        onClick={(e) => handleSlotClick(e, slot)}
                    >
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {slot.content_libraries?.name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            {slot.time_of_day.slice(0, 5)}
                        </div>
                        <button
                            className={styles.deleteBtn}
                            onClick={(e) => handleDeleteSlot(e, slot.id)}
                        >
                            <X size={10} />
                        </button>
                    </div>
                </div>
            );
        });
    };

    // if (isLoading) return <div className={styles.container}>Loading...</div>;

    if (isError) {
        return (
            <div className={styles.container}>
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <h2>Unable to load schedule</h2>
                    <p style={{ marginBottom: '1rem', color: 'red' }}>
                        {(slotsErr as any)?.message || (libsErr as any)?.message || 'Something went wrong.'}
                    </p>
                    <p>Please check your database migrations if this persists.</p>
                    <button
                        onClick={() => { refetchSlots(); window.location.reload(); }}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            marginTop: '1rem'
                        }}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Weekly Schedule</h1>
                    <p className={styles.subtitle}>Automate your posting cadence by assigning libraries to time slots.</p>
                </div>
            </div>

            <div className={styles.calendarWrapper}>
                <div className={styles.daysHeader}>
                    <div className={styles.timeColHeader} />
                    {DAYS.map((day, i) => (
                        <div key={day} className={styles.dayHeader}>
                            {day}
                        </div>
                    ))}
                </div>

                <div className={styles.gridScroller}>
                    <div className={styles.timeGrid}>
                        <div className={styles.timeLabels}>
                            {HOURS.map(h => (
                                <div key={h} className={styles.timeLabel}>
                                    {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                                </div>
                            ))}
                        </div>

                        {DAYS.map((_, dayIndex) => (
                            <div key={dayIndex} className={styles.dayColumn}>
                                {HOURS.map(h => (
                                    <div
                                        key={`${dayIndex}-${h}`}
                                        className={styles.hourCell}
                                        onClick={() => handleCellClick(dayIndex, h)}
                                    />
                                ))}
                                {isLoading ? (
                                    // Loading Placeholder Lines
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                position: 'absolute',
                                                top: `${(9 + i * 3) * 60}px`,
                                                left: 4, right: 4,
                                                height: 52,
                                                background: 'var(--bg-tertiary)',
                                                borderRadius: 'var(--radius-md)',
                                                opacity: 0.5,
                                                pointerEvents: 'none'
                                            }}
                                        />
                                    ))
                                ) : renderSlotsForDay(dayIndex)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>
                            {editingSlotId ? 'Edit Slot' : 'Add Slot'} for {DAYS[selectedDay]} @ {selectedHour}:00
                        </h2>

                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Select Library</label>
                                <select
                                    className={styles.select}
                                    value={selectedLibraryId}
                                    onChange={e => setSelectedLibraryId(e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Choose a library...</option>
                                    {libraries.map((lib: any) => (
                                        <option key={lib.id} value={lib.id}>
                                            {lib.name} ({lib.post_count || 0} posts)
                                        </option>
                                    ))}
                                </select>
                                <p className={styles.helperText}>
                                    📚 Posts from this library will be automatically published at this time slot each week.
                                </p>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Platforms to Publish To</label>
                                <div className={styles.platformGrid}>
                                    {PLATFORMS.filter(p => p.id !== 'threads').map(platform => {
                                        const isSelected = selectedPlatforms.includes(platform.id as PlatformId);
                                        return (
                                            <div
                                                key={platform.id}
                                                className={`${styles.platformOption} ${isSelected ? styles.selected : ''}`}
                                                onClick={() => togglePlatform(platform.id as PlatformId)}
                                                title={platform.name}
                                            >
                                                {platform.icon}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={isSubmitting || !selectedLibraryId || selectedPlatforms.length === 0}
                                >
                                    {editingSlotId ? 'Save Changes' : 'Add Slot'}
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )
            }
        </div >
    );
}
