'use client';

import { useState, useEffect } from 'react';
import { X, GripVertical, CalendarPlus } from 'lucide-react';
import styles from './Schedule.module.css';
import { ContentLibrary, WeeklySlot, PlatformId } from '@/types';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useWeeklySlots, useLibraries } from '@/hooks/useQueries';
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queries/constants';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0-23
const EMPTY_SLOTS: WeeklySlot[] = [];

// --- Draggable Slot Component ---
function DraggableSlot({
    slot,
    onClick,
    onDelete,
    isOverlay = false,
    style: styleOverride = {}
}: {
    slot: WeeklySlot & { content_libraries?: any },
    onClick?: (e: React.MouseEvent) => void,
    onDelete?: (e: React.MouseEvent, id: string) => void,
    isOverlay?: boolean,
    style?: React.CSSProperties
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `slot-${slot.id}`,
        data: slot,
    });

    const [hour] = slot.time_of_day.split(':').map(Number);
    const top = hour * 75; // 75px per hour - relative to parent day column

    // Get library platforms for icons
    const libraryPlatforms: PlatformId[] = slot.content_libraries?.platforms || [];

    const baseStyle: React.CSSProperties = {
        top: isOverlay ? 0 : `${top + 4}px`,
        height: `67px`,
        backgroundColor: slot.content_libraries?.color || '#6366f1',
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
        zIndex: isOverlay ? 999 : (isDragging ? 100 : 10),
        position: isOverlay ? 'relative' : 'absolute',
        left: isOverlay ? 0 : '4px',
        right: isOverlay ? 0 : '4px',
        width: isOverlay ? '100%' : 'auto',
        boxShadow: isOverlay ? '0 10px 20px rgba(0,0,0,0.2)' : undefined,
        scale: isOverlay ? '1.05' : '1',
    };

    // Merge overrides (allowing tiling logic to override left/width)
    const style = { ...baseStyle, ...styleOverride };

    return (
        <div
            id={`slot-${slot.id}`}
            ref={setNodeRef}
            style={style}
            className={styles.slot}
            {...attributes}
            onClick={onClick}
            title={`${slot.content_libraries?.name} (${slot.time_of_day})`}
            data-dragging={isDragging}
        >
            {/* Drag Handle - only this part initiates drag */}
            <div
                className={styles.dragHandle}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical size={12} />
            </div>

            {/* Clickable content area */}
            <div className={styles.slotContent}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {slot.content_libraries?.name || 'Unknown'}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                    {slot.time_of_day.slice(0, 5)}
                </div>
                {/* Platform Icons */}
                <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                    {libraryPlatforms.slice(0, 4).map(pid => (
                        <span key={pid} style={{ opacity: 0.85 }}>
                            {getPlatformIcon(pid, 11)}
                        </span>
                    ))}
                    {libraryPlatforms.length > 4 && (
                        <span style={{ fontSize: '9px', opacity: 0.7 }}>+{libraryPlatforms.length - 4}</span>
                    )}
                </div>
            </div>

            {!isOverlay && onDelete && (
                <button
                    className={styles.deleteBtn}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(e, slot.id);
                    }}
                >
                    <X size={10} />
                </button>
            )}
        </div>
    );
}

// ... Droppable Cell Component ...
function DroppableCell({ dayIndex, hour, onClick, children }: { dayIndex: number, hour: number, onClick: () => void, children?: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({
        id: `cell-${dayIndex}-${hour}`,
        data: { dayIndex, hour },
    });

    return (
        <div
            ref={setNodeRef}
            className={styles.hourCell}
            onClick={onClick}
            style={{
                backgroundColor: isOver ? 'var(--bg-elevated)' : undefined,
                transition: 'background-color 0.2s',
                position: 'relative' // Needed for ghost slot absolute positioning
            }}
        >
            {isOver && <div className={styles.ghostSlot} />}
            {children}
        </div>
    );
}
export default function SchedulePage() {
    const queryClient = useQueryClient();

    // Data Queries
    const { data: rawSlots, refetch: refetchSlots, isLoading: slotsLoading, isError: slotsError, error: slotsErr } = useWeeklySlots();
    const slots = rawSlots || EMPTY_SLOTS;

    const { data: libraries = [], isLoading: libsLoading, isError: libsError, error: libsErr } = useLibraries();

    const isLoading = slotsLoading || libsLoading;
    const isError = slotsError || libsError;

    // Local UI State
    const [activeDragSlot, setActiveDragSlot] = useState<WeeklySlot | null>(null);
    const [dragWidth, setDragWidth] = useState<number | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number>(0);
    const [selectedHour, setSelectedHour] = useState<number>(9);
    const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    // Initialize library selection when libraries load
    useEffect(() => {
        if (libraries.length > 0 && !selectedLibraryId) {
            setSelectedLibraryId(libraries[0].id);
        }
    }, [libraries]);

    const openAddModal = () => {
        const today = new Date().getDay();
        setSelectedDay(today);
        setSelectedHour(9);
        setSelectedLibraryId('');
        setEditingSlotId(null);
        setIsModalOpen(true);
    };

    const handleCellClick = (dayIndex: number, hour: number) => {
        setSelectedDay(dayIndex);
        setSelectedHour(hour);
        setEditingSlotId(null); // Reset editing state
        setIsModalOpen(true);
        // Reset platforms if needed, or keep defaults
    };


    const openEditModal = (slot: WeeklySlot) => {
        setSelectedDay(slot.day_of_week);
        const [hour] = slot.time_of_day.split(':').map(Number);
        setSelectedHour(hour);
        setSelectedLibraryId(slot.library_id);
        setEditingSlotId(slot.id);
        setIsModalOpen(true);
    };


    const handleDeleteSlot = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setPendingDeleteId(id);
    };

    const confirmDeleteSlot = async () => {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        setPendingDeleteId(null);

        // Optimistic Delete via Query Cache
        queryClient.setQueryData<WeeklySlot[]>(queryKeys.weeklySlots, (old) => {
            if (!old) return [];
            return old.filter(s => s.id !== id);
        });

        try {
            await fetch(`/api/schedule/slots?id=${id}`, { method: 'DELETE' });
            refetchSlots();
        } catch (error) {
            console.error('Failed to delete slot', error);
            refetchSlots(); // Revert on failure
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const timeString = `${selectedHour.toString().padStart(2, '0')}:00:00`;

        // Get platforms from selected library
        const selectedLibrary = libraries.find((lib: ContentLibrary) => lib.id === selectedLibraryId);
        const libraryPlatforms = selectedLibrary?.platforms || [];

        try {
            const url = '/api/schedule/slots';
            const method = editingSlotId ? 'PUT' : 'POST';
            const body = {
                id: editingSlotId,
                library_id: selectedLibraryId,
                day_of_week: selectedDay,
                time_of_day: timeString,
                platform_ids: libraryPlatforms
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

    const handleDragStart = (event: DragStartEvent) => {
        const slot = event.active.data.current as WeeklySlot;
        setActiveDragSlot(slot);

        // Capture width from dnd-kit's rect first, fallback to DOM query
        const width = event.active.rect.current.initial?.width;
        if (width) {
            setDragWidth(width);
        } else {
            // Fallback: measure from DOM
            const el = document.getElementById(`slot-${slot.id}`);
            if (el) {
                setDragWidth(el.getBoundingClientRect().width);
            }
        }
    };

    // Drag End Handler
    const handleDragEnd = async (event: DragEndEvent) => {
        // Clear drag state
        setActiveDragSlot(null);
        setDragWidth(null);

        const { active, over } = event;

        if (!over) return;

        const slot = active.data.current as WeeklySlot;
        const { dayIndex, hour } = over.data.current as { dayIndex: number, hour: number };

        // Check if changed
        const currentHour = parseInt(slot.time_of_day.split(':')[0]);
        if (slot.day_of_week === dayIndex && currentHour === hour) {
            return;
        }

        const timeString = `${hour.toString().padStart(2, '0')}:00:00`;
        const updatedSlot = { ...slot, day_of_week: dayIndex, time_of_day: timeString };

        // Save previous state for rollback
        const previousSlots = queryClient.getQueryData<WeeklySlot[]>(queryKeys.weeklySlots);

        // Optimistically update the cache
        queryClient.setQueryData<WeeklySlot[]>(queryKeys.weeklySlots, (old) => {
            if (!old) return [updatedSlot]; // Should rarely happen
            return old.map(s => s.id === slot.id ? updatedSlot : s);
        });
        // We now rely purely on this cache update. No local state sync needed.

        try {
            // Update via API
            const res = await fetch('/api/schedule/slots', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: slot.id,
                    library_id: slot.library_id,
                    day_of_week: dayIndex,
                    time_of_day: timeString,
                    platform_ids: slot.platform_ids
                }),
            });

            if (!res.ok) {
                // Revert only on ERROR
                console.error("Failed to update slot, reverting");
                if (previousSlots) {
                    queryClient.setQueryData(queryKeys.weeklySlots, previousSlots);
                }
                refetchSlots();
            }
        } catch (err) {
            console.error("Failed to move slot", err);
            if (previousSlots) {
                queryClient.setQueryData(queryKeys.weeklySlots, previousSlots);
            }
            refetchSlots();
        }
    };

    // Helper to render slots in a day column
    const renderSlotsForDay = (dayIndex: number) => {
        // Render directly from useQuery slots (which encapsulates optimistic updates)
        const daySlots = slots.filter((s: WeeklySlot) => s.day_of_week === dayIndex);

        // Group slots by hour to handle overlaps
        const slotsByHour: Record<number, WeeklySlot[]> = {};
        daySlots.forEach(slot => {
            const hour = parseInt(slot.time_of_day.split(':')[0]);
            if (!slotsByHour[hour]) slotsByHour[hour] = [];
            slotsByHour[hour].push(slot);
        });

        // Flatten back to array with calculated styles
        const renderedSlots: any[] = [];

        Object.entries(slotsByHour).forEach(([hourStr, hourSlots]) => {
            const count = hourSlots.length;
            // Sort by ID or creation time to ensure stable order? 
            // Slots come ordered by time_of_day, so stable sort is good.

            hourSlots.forEach((slot, index) => {
                let styleOverride: React.CSSProperties = {};

                if (count > 1) {
                    const widthPercent = 100 / count;
                    const leftPercent = index * widthPercent;

                    styleOverride = {
                        width: `calc(${widthPercent}% - 6px)`, // Subtract gap/padding
                        left: `calc(${leftPercent}% + 2px)`,
                        right: 'auto' // unset the default right: 4px
                    };
                }

                renderedSlots.push(
                    <DraggableSlot
                        key={slot.id}
                        slot={slot}
                        onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(slot);
                        }}
                        onDelete={handleDeleteSlot}
                        style={styleOverride}
                    />
                );
            });
        });

        return renderedSlots;
    };

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
        <>
            <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.title}>Weekly Schedule</h1>
                            <p className={styles.subtitle}>Automate your posting cadence by assigning libraries to time slots.</p>
                        </div>
                        <button
                            onClick={openAddModal}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '0.75rem 1rem',
                                background: 'var(--gradient-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                zIndex: 5,
                                boxShadow: 'var(--shadow-md)',
                            }}
                        >
                            <CalendarPlus size={18} />
                            Schedule Library
                        </button>
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
                                            <DroppableCell
                                                key={`${dayIndex}-${h}`}
                                                dayIndex={dayIndex}
                                                hour={h}
                                                onClick={() => handleCellClick(dayIndex, h)}
                                            />
                                        ))}

                                        {/* Render Slots Layered on Top */}
                                        {renderSlotsForDay(dayIndex)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DragOverlay>
                        {activeDragSlot ? (
                            <div style={{ width: dragWidth ? `${dragWidth}px` : 'var(--slot-width, 140px)' }}>
                                <DraggableSlot slot={activeDragSlot} isOverlay />
                            </div>
                        ) : null}
                    </DragOverlay>

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

                                    {/* Day and Hour Selectors */}
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div className={styles.formGroup} style={{ flex: 1 }}>
                                            <label className={styles.label}>Day</label>
                                            <select
                                                className={styles.select}
                                                value={selectedDay}
                                                onChange={e => setSelectedDay(Number(e.target.value))}
                                            >
                                                {DAYS.map((day, i) => (
                                                    <option key={i} value={i}>{day}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className={styles.formGroup} style={{ flex: 1 }}>
                                            <label className={styles.label}>Time</label>
                                            <select
                                                className={styles.select}
                                                value={selectedHour}
                                                onChange={e => setSelectedHour(Number(e.target.value))}
                                            >
                                                {HOURS.map(h => (
                                                    <option key={h} value={h}>
                                                        {h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                                                    </option>
                                                ))}
                                            </select>
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
                                            disabled={isSubmitting || !selectedLibraryId}
                                        >
                                            {editingSlotId ? 'Save Changes' : 'Add Slot'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </DndContext>

            {/* Delete Slot Confirmation Modal */}
            <ConfirmModal
                isOpen={!!pendingDeleteId}
                title="Delete Time Slot"
                message="Are you sure you want to delete this time slot? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={confirmDeleteSlot}
                onCancel={() => setPendingDeleteId(null)}
            />
        </>
    );
}
