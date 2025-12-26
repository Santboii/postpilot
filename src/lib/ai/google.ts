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
    private imageModel: any;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);

        // Using flash models explicitly with latest alias to avoid 404s
        this.textModel = this.genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        // gemini-1.5-flash supports image input. For image GENERATION, we need Imagen (e.g. imagen-3.0-generate-001).
        // For now, we keep this placeholder to prevent runtime crashes on init, but generateImage will throw if called.
        this.imageModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
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
            // Switching to 'gemini-2.0-flash-exp-image-generation' which supports 'generateContent'
            // This is likely the free-tier compatible experimental model.
            const imageGenModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });

            // For Gemini image generation via generateContent, we pass the prompt.
            // The response format for images usually involves inlineData or specific output parts.
            // Note: If this is an Imagen-wrapper, it might still need the REST shape, but the list-models said [generateContent].

            // Let's try the standard generateContent call first.
            const result = await imageGenModel.generateContent(prompt);
            const response = await result.response;

            // Log full response to debug structure if it fails
            // console.log('Image Gen Response:', JSON.stringify(response, null, 2));

            // Check for inline data (base64)
            if (response.candidates && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }

            // If no inline data, check for failure reasons
            throw new Error('No image data found in Gemini response');

        } catch (error: any) {
            console.error('Error generating image with Google AI:', error);

            // FALLBACK SYSTEM:
            // If the primary model fails (billing, quota, or 404), we gracefully fallback to Pollinations.ai (free, no-key).
            // This ensures the user ALWAYS sees an image, even if their Google account isn't billed.
            console.log('Falling back to Pollinations.ai for image generation...');

            // Clean prompt for URL
            const safePrompt = encodeURIComponent(prompt.substring(0, 200));
            return `https://image.pollinations.ai/prompt/${safePrompt}?nologo=true&private=true&enhanced=true`;
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

