'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Library as LibraryIcon, FileText, Sparkles, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import styles from './Libraries.module.css';
import { ContentLibrary, LIBRARY_TEMPLATES, LibraryTemplate, LibraryTemplateType, PLATFORMS, PlatformId } from '@/types';
import Modal from '@/components/ui/Modal';
import LibraryTemplates from '@/components/libraries/LibraryTemplates';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';

const PRESET_COLORS = [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b',
    '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

type WizardStep = 'template' | 'details' | 'generating' | 'review';

interface GeneratedPost {
    id: string;
    content: string;
}

const fetchLibraries = async () => {
    const res = await fetch('/api/libraries');
    if (!res.ok) throw new Error('Failed to fetch libraries');
    return res.json();
};

export default function LibrariesPage() {
    const router = useRouter();

    // React Query for Caching
    const { data: libraries = [], isLoading, refetch } = useQuery<(ContentLibrary & { post_count?: number })[]>({
        queryKey: ['libraries'],
        queryFn: fetchLibraries,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const [isModalOpen, setIsModalOpen] = useState(false);

    // Wizard State
    const [wizardStep, setWizardStep] = useState<WizardStep>('template');
    const [selectedTemplate, setSelectedTemplate] = useState<LibraryTemplateType | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [topicPrompt, setTopicPrompt] = useState('');
    const [platforms, setPlatforms] = useState<PlatformId[]>([]);

    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [generateImages, setGenerateImages] = useState(false);

    // AI Settings State
    const [tone, setTone] = useState('Professional');
    const [length, setLength] = useState('medium');
    const [language, setLanguage] = useState('English');
    const [audience, setAudience] = useState('');
    const [hashtagStrategy, setHashtagStrategy] = useState('none');

    const [editingLibraryId, setEditingLibraryId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Generated Posts State
    const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
    const [newLibraryId, setNewLibraryId] = useState<string | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Pinterest Board State
    const [pinterestBoards, setPinterestBoards] = useState<{ id: string; name: string }[]>([]);
    const [pinterestBoardId, setPinterestBoardId] = useState<string>('');
    const [loadingBoards, setLoadingBoards] = useState(false);

    // Fetch Pinterest boards when Pinterest is added to platforms
    const fetchPinterestBoards = async () => {
        setLoadingBoards(true);
        try {
            const res = await fetch('/api/pinterest/boards');
            if (res.ok) {
                const data = await res.json();
                setPinterestBoards(data.boards || []);
            }
        } catch (error) {
            console.error('Failed to fetch Pinterest boards:', error);
        } finally {
            setLoadingBoards(false);
        }
    };

    const handleOptimizePrompt = async () => {
        if (!topicPrompt.trim() || isOptimizing) return;

        setIsOptimizing(true);
        try {
            const response = await fetch('/api/ai/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: topicPrompt, platform: 'general' })
            });

            if (!response.ok) throw new Error('Failed to optimize');

            const data = await response.json();
            setTopicPrompt(data.optimizedPrompt);
        } catch (error) {
            console.error('Failed to optimize prompt:', error);
        } finally {
            setIsOptimizing(false);
        }
    };

    const resetForm = () => {
        setWizardStep('template');
        setSelectedTemplate(null);
        setName('');
        setTopicPrompt('');
        setPlatforms([]);
        setColor(PRESET_COLORS[0]);
        setGenerateImages(false);
        setTone('Professional');
        setLength('medium');
        setLanguage('English');
        setAudience('');
        setHashtagStrategy('none');
        setEditingLibraryId(null);
        setGeneratedPosts([]);
        setNewLibraryId(null);
        setPinterestBoards([]);
        setPinterestBoardId('');
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
        setGenerateImages(lib.generate_images || false);

        // Populate AI Settings
        const settings = lib.ai_settings || {};
        setTone(settings.tone || 'Professional');
        setLength(settings.length || 'medium');
        setLanguage(settings.language || 'English');
        setLanguage(settings.language || 'English');
        setAudience(settings.audience || '');
        setHashtagStrategy(settings.hashtag_strategy || 'none');
        setPlatforms(lib.platforms || []);
        setPinterestBoardId(settings.pinterest_board_id || '');

        // Fetch boards if Pinterest is in platforms
        if (lib.platforms?.includes('pinterest')) {
            fetchPinterestBoards();
        }

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
                    platforms,
                    is_paused: false,
                    generate_images: generateImages,
                    topic_prompt: topicPrompt,
                    template_type: selectedTemplate || 'custom',
                    ai_settings: {
                        tone,
                        length,
                        language,
                        audience,
                        hashtag_strategy: hashtagStrategy,
                        use_emojis: true,
                        pinterest_board_id: pinterestBoardId || undefined
                    }
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
                refetch();
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
        refetch();
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
                    platforms,
                    is_paused: false,
                    generate_images: generateImages,
                    topic_prompt: topicPrompt,
                    ai_settings: {
                        tone,
                        length,
                        language,
                        audience,
                        hashtag_strategy: hashtagStrategy,
                        use_emojis: true,
                        pinterest_board_id: pinterestBoardId || undefined
                    }
                }),
            });

            if (res.ok) {
                setIsModalOpen(false);
                resetForm();
                refetch();
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
                            <div className={styles.inputActions}>
                                <button
                                    className={styles.optimizeBtn}
                                    onClick={handleOptimizePrompt}
                                    disabled={!topicPrompt.trim() || isOptimizing}
                                    type="button"
                                >
                                    {isOptimizing ? (
                                        <>
                                            <Loader2 size={14} className={styles.spinnerIcon} />
                                            Optimizing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            Optimize prompt
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                Authorized Platforms
                                <span className={styles.labelHint}>AI will create variants for these</span>
                            </label>
                            <div className={styles.platformGrid}>
                                {PLATFORMS.map(p => (
                                    <button
                                        key={p.id}
                                        className={`${styles.platformBtn} ${platforms.includes(p.id) ? styles.active : ''}`}
                                        onClick={() => {
                                            const isAdding = !platforms.includes(p.id);
                                            setPlatforms(prev =>
                                                prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                                            );
                                            // Fetch Pinterest boards when Pinterest is added
                                            if (p.id === 'pinterest' && isAdding && pinterestBoards.length === 0) {
                                                fetchPinterestBoards();
                                            }
                                        }}
                                    >
                                        <span className={styles.platformIcon} style={{ color: platforms.includes(p.id) ? p.color : 'inherit' }}>
                                            {p.icon}
                                        </span>
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Pinterest Board Selector */}
                        {platforms.includes('pinterest') && (
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    Pinterest Board
                                    <span className={styles.labelHint}>Where pins will be posted</span>
                                </label>
                                <select
                                    className={styles.select}
                                    value={pinterestBoardId}
                                    onChange={e => setPinterestBoardId(e.target.value)}
                                    disabled={loadingBoards}
                                >
                                    <option value="">{loadingBoards ? 'Loading boards...' : 'Select a board'}</option>
                                    {pinterestBoards.map(board => (
                                        <option key={board.id} value={board.id}>{board.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Tone</label>
                                <select
                                    className={styles.select}
                                    value={tone}
                                    onChange={e => setTone(e.target.value)}
                                >
                                    <option value="Professional">Professional</option>
                                    <option value="Casual">Casual</option>
                                    <option value="Funny">Funny</option>
                                    <option value="Inspirational">Inspirational</option>
                                    <option value="Edgy">Edgy</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Post Length</label>
                                <select
                                    className={styles.select}
                                    value={length}
                                    onChange={e => setLength(e.target.value)}
                                >
                                    <option value="short">Short</option>
                                    <option value="medium">Medium</option>
                                    <option value="long">Long</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Language</label>
                                <select
                                    className={styles.select}
                                    value={language}
                                    onChange={e => setLanguage(e.target.value)}
                                >
                                    <option value="English">English</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="German">German</option>
                                    <option value="Portuguese">Portuguese</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Hashtags</label>
                                <select
                                    className={styles.select}
                                    value={hashtagStrategy}
                                    onChange={e => setHashtagStrategy(e.target.value)}
                                >
                                    <option value="none">None</option>
                                    <option value="auto">Auto-Generate</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Target Audience</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="e.g. Small business owners, Gamers, etc."
                                value={audience}
                                onChange={e => setAudience(e.target.value)}
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

                            {/* Platform Icons */}
                            {lib.platforms && lib.platforms.length > 0 && (
                                <div className={styles.platformRow}>
                                    {lib.platforms.map(pid => {
                                        const p = PLATFORMS.find(pl => pl.id === pid);
                                        return p ? (
                                            <div
                                                key={pid}
                                                className={styles.platformIconWrapper}
                                                title={p.name}
                                                style={{
                                                    color: p.color,
                                                    borderColor: p.color + '40',
                                                    backgroundColor: p.color + '10'
                                                }}
                                            >
                                                {getPlatformIcon(pid, 16)}
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            )}

                            <div className={styles.postCount}>
                                <FileText size={16} />
                                <span>{lib.post_count || 0} posts</span>
                            </div>


                        </div>
                    ))
                )}

                {/* Add Library Placeholder Card */}
                {!isLoading && libraries.length > 0 && (
                    <div
                        className={`${styles.card} ${styles.addLibraryCard}`}
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                    >
                        <div className={styles.addLibraryContent}>
                            <Plus size={32} className={styles.addIcon} />
                            <span>Add Library</span>
                        </div>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={getModalTitle()}
                footer={renderModalFooter()}
                className={styles.libraryModal}
            >
                {renderWizardContent()}
            </Modal>
        </div>
    );
}
