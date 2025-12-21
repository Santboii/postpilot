'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Post, Platform, PlatformId } from '@/types';
import { PLATFORMS } from '@/types';
import { useRouter } from 'next/navigation';

export default function AIComposer() {
    const router = useRouter();
    const [topic, setTopic] = useState('');
    const [originalTopic, setOriginalTopic] = useState<string | null>(null);
    const [isOptimized, setIsOptimized] = useState(false);
    const [optimizing, setOptimizing] = useState(false);
    const [platform, setPlatform] = useState<PlatformId>('twitter');
    const [includeImage, setIncludeImage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [generatedResult, setGeneratedResult] = useState<{
        post: { content: string };
        imageUrl: string | null;
    } | null>(null);

    const handleOptimizePrompt = async () => {
        if (!topic || optimizing) return;

        setOptimizing(true);
        try {
            const response = await fetch('/api/ai/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: topic, platform })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to optimize');
            }

            const data = await response.json();
            setOriginalTopic(topic);
            setTopic(data.optimizedPrompt);
            setIsOptimized(true);
        } catch (error: unknown) {
            console.error('Optimization failed', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to optimize prompt';
            alert(errorMessage);
        } finally {
            setOptimizing(false);
        }
    };

    const handleRevertPrompt = () => {
        if (originalTopic) {
            setTopic(originalTopic);
            setOriginalTopic(null);
            setIsOptimized(false);
        }
    };

    const handleGenerate = async () => {
        if (!topic) return;

        setLoading(true);
        setGeneratedResult(null);

        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic,
                    platform,
                    includeImage
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate');
            }

            const data = await response.json();
            setGeneratedResult(data);
        } catch (error: any) {
            console.error('Generation failed', error);
            alert(error.message || 'Failed to generate post. Please check your API keys.');
        } finally {
            setLoading(false);
        }
    };

    const handleUsePost = () => {
        if (!generatedResult) return;

        // Ideally, we pass this state to the main composer via URL params or global state/context.
        // For simplicity in this MVP, we'll assume a query param approach or similar.
        // Constructing specific URL for main composer pre-fill:
        const params = new URLSearchParams();
        params.set('content', generatedResult.post.content);
        params.set('platform', platform);
        if (generatedResult.imageUrl) {
            // Store oversized base64 strings in session storage to avoid URL length limits
            try {
                sessionStorage.setItem('ai_generated_image', generatedResult.imageUrl);
                params.set('image', 'session_storage');
            } catch (e) {
                console.warn('Failed to save image to session storage, falling back to URL param (may fail)', e);
                params.set('image', generatedResult.imageUrl);
            }
        }

        router.push(`/compose?${params.toString()}`);
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8 animate-fadeIn">
            <div className="text-center space-y-4 mb-8">
                <h1 className="text-4xl md:text-5xl font-bold">
                    <span className="text-gradient">Magic Composer</span> ✨
                </h1>
                <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                    Turn a simple idea into a viral post. Choose your platform, define your topic, and let the AI do the rest.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Column: Controls */}
                <div className="space-y-6">
                    <div className="card space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                    1. What's your post about?
                                </label>
                                {isOptimized && (
                                    <span className="badge badge-success text-[10px] py-0.5 px-2">
                                        ✨ Optimized
                                    </span>
                                )}
                            </div>
                            <textarea
                                value={topic}
                                onChange={(e) => {
                                    setTopic(e.target.value);
                                    // Clear optimized state if user edits
                                    if (isOptimized) {
                                        setIsOptimized(false);
                                        setOriginalTopic(null);
                                    }
                                }}
                                className={`input min-h-[160px] text-lg leading-relaxed p-4 resize-none ${isOptimized ? 'border-[var(--accent-green)]' : ''}`}
                                placeholder="e.g. Announcing our new feature launch next week... or simple thoughts on leadership."
                            />
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={handleOptimizePrompt}
                                    disabled={!topic || optimizing || isOptimized}
                                    className={`
                                        btn btn-sm gap-2 transition-all
                                        ${isOptimized
                                            ? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed'
                                            : 'bg-[var(--gradient-subtle)] border border-[var(--border-light)] hover:border-[var(--accent-purple)] text-[var(--text-primary)]'
                                        }
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    `}
                                >
                                    {optimizing ? (
                                        <>
                                            <span className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                            <span>Optimizing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>🪄</span>
                                            <span>Optimize Prompt</span>
                                        </>
                                    )}
                                </button>
                                {isOptimized && originalTopic && (
                                    <button
                                        onClick={handleRevertPrompt}
                                        className="btn btn-sm btn-ghost text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    >
                                        ↩ Revert to original
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                                2. Choose Platform
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {PLATFORMS.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPlatform(p.id as PlatformId)}
                                        className={`
                                            relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200
                                            ${platform === p.id
                                                ? 'bg-[var(--bg-elevated)] border-[var(--accent-purple)] shadow-glow-purple'
                                                : 'bg-[var(--bg-tertiary)] border-transparent hover:bg-[var(--bg-elevated)]'
                                            }
                                        `}
                                    >
                                        <span className="text-2xl" style={{ color: p.color }}>{p.icon}</span>
                                        <span className="text-sm font-medium">{p.name}</span>
                                        {platform === p.id && (
                                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--accent-purple)] animate-pulse" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--border-subtle)]">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="space-y-1">
                                    <span className="font-medium flex items-center gap-2">
                                        <span>Generate Image</span>
                                        <span className="badge badge-purple text-[10px] py-0.5 px-1.5 uppercase">Beta</span>
                                    </span>
                                    <p className="text-sm text-[var(--text-secondary)]">Create a visual with Gemini & Imagen</p>
                                </div>
                                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${includeImage ? 'bg-[var(--accent-purple)]' : 'bg-[var(--bg-tertiary)]'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${includeImage ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={includeImage}
                                    onChange={(e) => setIncludeImage(e.target.checked)}
                                />
                            </label>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !topic}
                        className={`
                            btn btn-primary btn-lg w-full text-lg font-bold shadow-xl transition-all mt-6
                            ${loading ? 'opacity-90 cursor-wait' : 'hover:shadow-glow-purple'}
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                        `}
                    >
                        {loading ? (
                            <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Dreaming up ideas...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-xl">✨</span>
                                <span>Generate Magic Post</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Right Column: Preview */}
                <div className="sticky top-6">
                    {!generatedResult && !loading && (
                        <div className="card h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 border-dashed border-2 bg-[var(--bg-tertiary)]/30">
                            <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4 text-4xl opacity-50">
                                🪄
                            </div>
                            <h3 className="text-xl font-semibold mb-2">Ready to Create</h3>
                            <p className="text-[var(--text-secondary)] max-w-xs">
                                FIll out the details on the left and watch the magic happen here.
                            </p>
                        </div>
                    )}

                    {loading && (
                        <div className="card h-full min-h-[400px] p-6 space-y-6 animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)]" />
                                <div className="space-y-2">
                                    <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
                                    <div className="h-3 w-20 bg-[var(--bg-tertiary)] rounded opacity-60" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-4 w-full bg-[var(--bg-tertiary)] rounded" />
                                <div className="h-4 w-full bg-[var(--bg-tertiary)] rounded" />
                                <div className="h-4 w-3/4 bg-[var(--bg-tertiary)] rounded" />
                            </div>
                            <div className="h-48 w-full bg-[var(--bg-tertiary)] rounded-xl" />
                        </div>
                    )}

                    {generatedResult && !loading && (
                        <div className="animate-scaleIn space-y-6">
                            <div className="card border-[var(--accent-purple)] shadow-glow-purple relative overflow-hidden group">
                                {/* Platform Header Mockup */}
                                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border-subtle)]">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-blue)] flex items-center justify-center text-white font-bold text-sm">
                                        AI
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-semibold text-sm">Your Brand</div>
                                        <div className="text-xs text-[var(--text-secondary)]">Just now • {PLATFORMS.find(p => p.id === platform)?.name}</div>
                                    </div>
                                    <div className="text-[var(--text-secondary)]">•••</div>
                                </div>

                                <div className="space-y-4">
                                    <p className="whitespace-pre-wrap text-[var(--text-primary)] leading-relaxed">
                                        {generatedResult.post.content}
                                    </p>

                                    {generatedResult.imageUrl && (
                                        <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] relative">
                                            <img
                                                src={generatedResult.imageUrl}
                                                alt="Generated visual"
                                                className="w-full h-auto object-cover transition-transform duration-700 hover:scale-105"
                                            />
                                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs text-white/90 font-medium">
                                                AI Generated
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setGeneratedResult(null)}
                                    className="btn btn-ghost w-full justify-center border border-[var(--border-light)] hover:border-[var(--border-medium)]"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={handleUsePost}
                                    className="btn btn-primary w-full justify-center group"
                                >
                                    <span>Use This Post</span>
                                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
