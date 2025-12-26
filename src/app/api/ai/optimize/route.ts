import { createClient } from '@/lib/supabase/server';
import { GoogleGeminiService } from '@/lib/ai/google';
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
        const { content, platform } = await req.json();
        if (!content || !platform) {
            return NextResponse.json({ error: 'Missing content or platform' }, { status: 400 });
        }

        // 3. Fetch Brand Profile (for tone)
        const { data: profile } = await supabase
            .from('brand_profiles')
            .select('brand_name, tone')
            .eq('user_id', user.id)
            .single();

        // 4. Initialize AI Service
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'AI Service Misconfigured' }, { status: 500 });
        }

        const aiService = new GoogleGeminiService(apiKey);

        // 5. Optimize Content
        const optimizedContent = await aiService.optimizeContent(
            content,
            platform,
            profile?.tone
        );

        return NextResponse.json({ content: optimizedContent });

    } catch (error: any) {
        console.error('Optimize Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to optimize content' },
            { status: 500 }
        );
    }
}
