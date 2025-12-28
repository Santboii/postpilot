'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Library as LibraryIcon, FileText, Sparkles, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import styles from './Libraries.module.css';
import { ContentLibrary, LIBRARY_TEMPLATES, LibraryTemplate, LibraryTemplateType } from '@/types';
import Modal from '@/components/ui/Modal';
import LibraryTemplates from '@/components/libraries/LibraryTemplates';

const PRESET_COLORS = [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b',
    '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

type WizardStep = 'template' | 'details' | 'generating' | 'review';

interface GeneratedPost {
    id: string;
    content: string;
}

export default function LibrariesPage() {
    const router = useRouter();
    const [libraries, setLibraries] = useState<(ContentLibrary & { post_count?: number })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Wizard State
    const [wizardStep, setWizardStep] = useState<WizardStep>('template');
    const [selectedTemplate, setSelectedTemplate] = useState<LibraryTemplateType | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [topicPrompt, setTopicPrompt] = useState('');
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [autoRemix, setAutoRemix] = useState(true);
    const [generateImages, setGenerateImages] = useState(false);
    const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Generated Posts State
    const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
    const [newLibraryId, setNewLibraryId] = useState<string | null>(null);

    useEffect(() => {
        fetchLibraries();
    }, []);

    const fetchLibraries = async () => {
        try {
            const res = await fetch('/api/libraries');
            if (res.ok) {
                const data = await res.json();
                setLibraries(data);
            }
        } catch (error) {
            console.error('Failed to fetch libraries', error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setWizardStep('template');
        setSelectedTemplate(null);
        setName('');
        setTopicPrompt('');
        setColor(PRESET_COLORS[0]);
        setAutoRemix(true);
        setGenerateImages(false);
        setEditingLibraryId(null);
        setGeneratedPosts([]);
        setNewLibraryId(null);
    };

    const handleTemplateSelect = (template: LibraryTemplate | null) => {
        if (template) {
            setSelectedTemplate(template.id);
            setColor(template.color);
            setTopicPrompt(template.promptPrefix + ' ');
        } else {
            setSelectedTemplate('custom');
            setTopicPrompt('');
        }
    };

    const handleEdit = (lib: ContentLibrary & { post_count?: number }) => {
        setName(lib.name);
        setColor(lib.color);
        setTopicPrompt(lib.topic_prompt || '');
        setAutoRemix(lib.auto_remix);
        setGenerateImages(lib.generate_images || false);
        setEditingLibraryId(lib.id);
        setWizardStep('details');
        setIsModalOpen(true);
    };

    const handleNextStep = () => {
        if (wizardStep === 'template') {
            setWizardStep('details');
        }
    };

    const handlePrevStep = () => {
        if (wizardStep === 'details') {
            setWizardStep('template');
        }
    };

    const handleCreateLibrary = async () => {
        if (!name.trim()) return;

        console.log('[Libraries] Starting library creation...', { name, topicPrompt, selectedTemplate });
        setIsSubmitting(true);
        setWizardStep('generating');

        try {
            // Step 1: Create the library
            console.log('[Libraries] Step 1: Creating library...');
            const createRes = await fetch('/api/libraries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    color,
                    is_paused: false,
                    auto_remix: autoRemix,
                    generate_images: generateImages,
                    topic_prompt: topicPrompt,
                    template_type: selectedTemplate || 'custom'
                }),
            });

            if (!createRes.ok) {
                const errorData = await createRes.json();
                console.error('[Libraries] Failed to create library:', errorData);
                throw new Error('Failed to create library');
            }
            const library = await createRes.json();
            console.log('[Libraries] Library created:', library.id);
            setNewLibraryId(library.id);

            // Step 2: Generate posts if we have a topic prompt
            if (topicPrompt.trim()) {
                console.log('[Libraries] Step 2: Generating posts for topic:', topicPrompt);
                const genRes = await fetch('/api/libraries/generate-posts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        libraryId: library.id,
                        topicPrompt: topicPrompt,
                        count: 5
                    }),
                });

                console.log('[Libraries] Generate posts response status:', genRes.status);

                if (genRes.ok) {
                    const result = await genRes.json();
                    console.log('[Libraries] Generated posts:', result.count);
                    setGeneratedPosts(result.posts || []);
                    setWizardStep('review');
                } else {
                    const errorData = await genRes.json();
                    console.error('[Libraries] Failed to generate posts:', errorData);
                    // Generation failed, but library was created
                    setWizardStep('review');
                }
            } else {
                console.log('[Libraries] No topic prompt, skipping post generation');
                // No topic, just finish
                setIsModalOpen(false);
                resetForm();
                fetchLibraries();
            }
        } catch (error) {
            console.error('Failed to create library:', error);
            setWizardStep('details');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinish = () => {
        setIsModalOpen(false);
        resetForm();
        fetchLibraries();
    };

    const handleUpdateLibrary = async () => {
        if (!editingLibraryId || !name.trim()) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/libraries', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingLibraryId,
                    name,
                    color,
                    is_paused: false,
                    auto_remix: autoRemix,
                    generate_images: generateImages,
                    topic_prompt: topicPrompt,
                }),
            });

            if (res.ok) {
                setIsModalOpen(false);
                resetForm();
                fetchLibraries();
            }
        } catch (error) {
            console.error('Failed to update library:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getModalTitle = () => {
        if (editingLibraryId) return 'Edit Library';
        switch (wizardStep) {
            case 'template': return 'Choose a Template';
            case 'details': return 'Library Details';
            case 'generating': return 'Creating Your Library...';
            case 'review': return 'Library Created! 🎉';
            default: return 'Create Library';
        }
    };

    const renderWizardContent = () => {
        switch (wizardStep) {
            case 'template':
                return (
                    <LibraryTemplates
                        selectedTemplate={selectedTemplate}
                        onSelectTemplate={handleTemplateSelect}
                    />
                );

            case 'details':
                return (
                    <div className={styles.detailsForm}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>Library Name</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g. SC2 Pro Tips"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                Content Topic
                                <span className={styles.labelHint}>AI will generate posts based on this</span>
                            </label>
                            <textarea
                                className={styles.textarea}
                                placeholder="e.g. Tips and strategies for StarCraft 2 players"
                                value={topicPrompt}
                                onChange={e => setTopicPrompt(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Color</label>
                            <div className={styles.colorGrid}>
                                {PRESET_COLORS.map(c => (
                                    <div
                                        key={c}
                                        className={`${styles.colorOption} ${color === c ? styles.selected : ''}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setColor(c)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className={styles.toggleGroup}>
                            <label className={styles.toggle}>
                                <input
                                    type="checkbox"
                                    checked={autoRemix}
                                    onChange={e => setAutoRemix(e.target.checked)}
                                />
                                <div>
                                    <span className={styles.toggleTitle}>✨ AI Smart Remix</span>
                                    <span className={styles.toggleDesc}>Rephrase posts before publishing</span>
                                </div>
                            </label>

                            <label className={styles.toggle}>
                                <input
                                    type="checkbox"
                                    checked={generateImages}
                                    onChange={e => setGenerateImages(e.target.checked)}
                                />
                                <div>
                                    <span className={styles.toggleTitle}>🎨 Auto-Generate Images</span>
                                    <span className={styles.toggleDesc}>Create visuals using AI</span>
                                </div>
                            </label>
                        </div>
                    </div>
                );

            case 'generating':
                return (
                    <div className={styles.generatingState}>
                        <div className={styles.spinner}>
                            <Loader2 size={48} className={styles.spinnerIcon} />
                        </div>
                        <h3>Generating your first posts...</h3>
                        <p>Our AI is crafting 5 starter posts for your library.</p>
                    </div>
                );

            case 'review':
                return (
                    <div className={styles.reviewState}>
                        <div className={styles.successIcon}>
                            <Check size={32} />
                        </div>
                        <p className={styles.reviewText}>
                            Created <strong>{name}</strong> with {generatedPosts.length} posts ready to go!
                        </p>
                        <div className={styles.postPreviewList}>
                            {generatedPosts.slice(0, 3).map((post, idx) => (
                                <div key={post.id || idx} className={styles.postPreview}>
                                    <span className={styles.postNumber}>{idx + 1}</span>
                                    <p>{post.content}</p>
                                </div>
                            ))}
                            {generatedPosts.length > 3 && (
                                <p className={styles.morePostsHint}>
                                    +{generatedPosts.length - 3} more posts in your library
                                </p>
                            )}
                        </div>
                    </div>
                );
        }
    };

    const renderModalFooter = () => {
        if (wizardStep === 'generating') return null;

        if (wizardStep === 'review') {
            return (
                <button className={styles.submitBtn} onClick={handleFinish}>
                    Done
                </button>
            );
        }

        if (editingLibraryId) {
            return (
                <>
                    <button className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                        Cancel
                    </button>
                    <button className={styles.submitBtn} onClick={handleUpdateLibrary} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </>
            );
        }

        return (
            <>
                {wizardStep === 'details' && (
                    <button className={styles.backBtn} onClick={handlePrevStep}>
                        <ArrowLeft size={16} /> Back
                    </button>
                )}
                {wizardStep === 'template' ? (
                    <button
                        className={styles.submitBtn}
                        onClick={handleNextStep}
                        disabled={!selectedTemplate}
                    >
                        Continue <ArrowRight size={16} />
                    </button>
                ) : (
                    <button
                        className={styles.submitBtn}
                        onClick={handleCreateLibrary}
                        disabled={!name.trim() || isSubmitting}
                    >
                        <Sparkles size={16} />
                        {isSubmitting ? 'Creating...' : 'Create & Generate Posts'}
                    </button>
                )}
            </>
        );
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Content Libraries</h1>
                    <p className={styles.subtitle}>Manage your evergreen content collections.</p>
                </div>
                <button className={styles.addButton} onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Plus size={20} />
                    New Library
                </button>
            </div>

            <div className={styles.grid}>
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={styles.card} style={{ cursor: 'default' }}>
                            <div className={styles.cardHeader}>
                                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', opacity: 0.5 }} />
                                <div style={{ width: 60, height: 24, borderRadius: 'var(--radius-full)', background: 'var(--bg-tertiary)', opacity: 0.5 }} />
                            </div>
                            <div style={{ height: 24, width: '70%', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', opacity: 0.5 }} />
                            <div style={{ height: 16, width: '40%', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', opacity: 0.5 }} />
                        </div>
                    ))
                ) : libraries.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>
                            <LibraryIcon size={48} />
                        </div>
                        <h3 className={styles.emptyTitle}>No Libraries Yet</h3>
                        <p className={styles.emptyText}>Create your first content library to start generating evergreen posts.</p>
                        <button className={styles.emptyButton} onClick={() => setIsModalOpen(true)}>
                            <Plus size={18} />
                            Create Library
                        </button>
                    </div>
                ) : (
                    libraries.map((lib) => (
                        <div key={lib.id} className={styles.card} onClick={() => router.push(`/libraries/${lib.id}`)}>
                            <div className={styles.cardHeader}>
                                <div className={styles.libraryIcon} style={{ backgroundColor: lib.color }}>
                                    <LibraryIcon size={24} />
                                </div>
                                <span className={`${styles.badge} ${lib.is_paused ? styles.paused : styles.active}`}>
                                    {lib.is_paused ? 'Paused' : 'Active'}
                                </span>
                            </div>

                            <h3 className={styles.cardTitle}>{lib.name}</h3>

                            {lib.topic_prompt && (
                                <p className={styles.topicPrompt}>{lib.topic_prompt}</p>
                            )}

                            <div className={styles.postCount}>
                                <FileText size={16} />
                                <span>{lib.post_count || 0} posts</span>
                            </div>

                            {lib.auto_remix && (
                                <div className={styles.featureBadge}>
                                    <span>✨ Smart Remix</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={getModalTitle()}
                footer={renderModalFooter()}
            >
                {renderWizardContent()}
            </Modal>
        </div>
    );
}
