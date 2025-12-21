import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const supabase = await createClient();

        // 1. Auth Check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Request
        const { prompt, platform } = await req.json();
        if (!prompt) {
            return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
        }

        // 3. Fetch Brand Profile for context
        const { data: profile } = await supabase
            .from('brand_profiles')
            .select('brand_name, tone, target_audience, key_messages')
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
        const systemPrompt = `
You are an expert prompt engineer specializing in social media content creation.

TASK: Transform the user's brief idea into a detailed, optimized prompt that will generate better social media content.

USER'S ORIGINAL IDEA:
"""
${prompt}
"""

${platform ? `TARGET PLATFORM: ${platform}` : ''}

${profile ? `
BRAND CONTEXT:
- Brand: ${profile.brand_name || 'Not specified'}
- Tone: ${profile.tone || 'Professional and friendly'}
- Target Audience: ${profile.target_audience || 'General audience'}
- Key Messages: ${profile.key_messages?.join(', ') || 'None specified'}
` : ''}

INSTRUCTIONS:
- Expand the idea with specific details, angles, or hooks
- Add relevant context that would help generate better content
- Include any emotional appeal or call-to-action suggestions
- Keep it concise but comprehensive (2-4 sentences max)
- Maintain the user's original intent and core message
- Don't include platform-specific formatting, just the enhanced idea

Return ONLY the optimized prompt, no explanations or formatting.
`;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const optimizedPrompt = response.text().trim();

        return NextResponse.json({
            optimizedPrompt,
            originalPrompt: prompt
        });

    } catch (error: unknown) {
        console.error('Optimize Prompt Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to optimize prompt';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
