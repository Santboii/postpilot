import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Platform-specific constraints and style guides
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

export async function POST(req: Request) {
    try {
        const supabase = await createClient();

        // 1. Auth Check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Request
        const { content, platform } = await req.json();
        if (!content || !platform) {
            return NextResponse.json({ error: 'Missing content or platform' }, { status: 400 });
        }

        const guide = PLATFORM_GUIDES[platform];
        if (!guide) {
            return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
        }

        // 3. Fetch Brand Profile (optional enhancement for voice consistency)
        const { data: profile } = await supabase
            .from('brand_profiles')
            .select('brand_name, tone')
            .eq('user_id', user.id)
            .single();

        // 4. Initialize AI
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'AI Service Misconfigured' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // 5. Build Optimization Prompt
        const prompt = `
You are an expert social media copywriter.

TASK: Rewrite the following post to be OPTIMIZED for ${platform}.

PLATFORM STYLE GUIDE for ${platform}:
- Max characters: ${guide.maxChars}
- Style: ${guide.style}

${profile ? `BRAND VOICE: ${profile.tone || 'Professional and friendly'}` : ''}

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const optimizedContent = response.text().trim();

        return NextResponse.json({ content: optimizedContent });

    } catch (error: any) {
        console.error('Optimize Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to optimize content' },
            { status: 500 }
        );
    }
}
