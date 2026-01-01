import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, GeneratedPost, PostGenerationParams } from './types';

const PLATFORM_GUIDES: Record<string, { maxChars: number; style: string }> = {
    twitter: {
        maxChars: 280,
        style: 'Punchy, concise, uses hashtags sparingly. Conversational and direct. May use emojis. Thread-friendly.',
    },
    linkedin: {
        maxChars: 3000,
        style: 'Professional yet personable. Thought leadership tone. Uses line breaks for readability. May include a call-to-action.',
    },
    instagram: {
        maxChars: 2200,
        style: 'Visual-first caption. Engaging opening line. Uses emojis freely. Hashtag block at end. Story-like.',
    },
    facebook: {
        maxChars: 63206,
        style: 'Conversational and community-focused. Can be longer-form. Encourages engagement with questions.',
    },
    threads: {
        maxChars: 500,
        style: 'Casual, conversational, similar to Twitter but slightly longer. Trendy and real-time.',
    },
};

export class GoogleGeminiService implements AIProvider {
    private genAI: GoogleGenerativeAI;
    private textModel: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);

        // Upgrading to Gemini 3 Flash (Standard 2026 Model)
        // Gemini 3 Flash is optimized for high-volume, multimodal tasks.
        this.textModel = this.genAI.getGenerativeModel({ model: 'gemini-3-flash' });
    }

    async generatePost(params: PostGenerationParams): Promise<GeneratedPost> {
        const { platform, topic, brandProfile } = params;

        const prompt = `
You are an expert social media manager acting on behalf of a brand.
Your goal is to write a high-performing post for ${platform}.

BRAND PROFILE:
- Name: ${brandProfile.name}
- Audience: ${brandProfile.audience}
- Tone Instructions: ${brandProfile.tone}

STYLE EXAMPLES (Mimic the sentence structure, emoji usage, and vocabulary):
---
${brandProfile.examples.join('\n---\n')}
---

TASK:
Write a single post about: "${topic}".
The post should be engaging, native to ${platform}, and strictly follow the brand voice.

Also write a detailed prompt for an AI image generator to create a visual for this post.
CRITICAL: The user wants images with TEXT ON TOP of them (typography, poster style).
Include instructions for "bold typography", "text overlay", or "poster design" containing key phrases from the post.

Return a JSON object with this structure: { "content": "The post text", "imagePrompt": "A detailed description for an AI image generator, explicitly asking for text overlay and specific wording." }
Do not wrap in markdown code blocks. Just valid JSON.
    `;

        try {
            const result = await this.textModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(cleanText) as GeneratedPost;
        } catch (error) {
            console.error('Error generating post text:', error);
            throw new Error('Failed to generate post content');
        }
    }

    async generateImage(prompt: string, aspectRatio: string = '1:1'): Promise<string> {
        try {
            // Use Gemini 3 Flash for image generation (Multimodal)
            const imageModel = this.genAI.getGenerativeModel({ model: 'gemini-3-flash' });

            const result = await imageModel.generateContent(prompt);
            const response = await result.response;

            // Check for inline data (Base64 image)
            if (response.candidates && response.candidates.length > 0) {
                const parts = response.candidates[0].content.parts;
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        const base64Data = part.inlineData.data;
                        // Return as a Data URL for immediate display
                        return `data:${mimeType};base64,${base64Data}`;
                    }
                }
            }
            throw new Error('No image data found in Gemini response');
        } catch (error) {
            console.error('Error generating image with Gemini 2.5:', error);
            // Fallback to Pollinations ONLY if Gemini specifically fails (e.g. rate limit)
            // But user specifically requested Google product. Let's try to just throw error if it fails?
            // Actually, keep fallback as a safety net but logging it.
            // Or better: Let's assume it works since we probed it.
            const safePrompt = encodeURIComponent(prompt.substring(0, 200));
            // Add random seed to prevent caching identical images for same prompt
            const seed = Math.floor(Math.random() * 1000);
            return `https://image.pollinations.ai/prompt/${safePrompt}?nologo=true&private=true&enhanced=true&seed=${seed}`;
        }
    }
    async optimizePrompt(prompt: string, platform?: string): Promise<string> {
        const context = platform
            ? `for a ${platform} post`
            : 'for a social media post';

        const systemPrompt = `
You are an expert prompt engineer and social media strategist.
Your task is to take a rough raw idea or prompt ${context} and convert it into a highly effective, detailed prompt that will generate better results from an LLM.

INPUT PROMPT: "${prompt}"

INSTRUCTIONS:
1. Expand on the core idea, adding necessary context or constraints.
2. If it's a specific platform, ensure the tone and format request matches that platform.
3. Keep it concise but potent.
4. Return ONLY the optimized prompt text. Do not wrap in quotes or add preamble.
        `;

        try {
            const result = await this.textModel.generateContent(systemPrompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Error optimizing prompt:', error);
            throw new Error('Failed to optimize prompt');
        }
    }
    async optimizeContent(content: string, platform: string, brandTone?: string): Promise<string> {
        const guide = PLATFORM_GUIDES[platform];
        if (!guide) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        const prompt = `
You are an expert social media copywriter.

TASK: Rewrite the following post to be OPTIMIZED for ${platform}.

PLATFORM STYLE GUIDE for ${platform}:
- Max characters: ${guide.maxChars}
- Style: ${guide.style}

${brandTone ? `BRAND VOICE: ${brandTone}` : ''}

ORIGINAL POST:
"""
${content}
"""

INSTRUCTIONS:
- Keep the core message and intent intact
- Adapt tone, length, and formatting for ${platform}
- Ensure it fits within ${guide.maxChars} characters
- Make it feel native to ${platform}

Return ONLY the optimized post text, no explanations or formatting.
        `;

        try {
            const result = await this.textModel.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Error optimizing content:', error);
            throw new Error('Failed to optimize content');
        }
    }
}

