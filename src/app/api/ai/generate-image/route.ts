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
        const { prompt } = await req.json();
        if (!prompt) {
            return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
        }

        // 3. Initialize AI Service
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'AI Service Misconfigured' }, { status: 500 });
        }

        const aiService = new GoogleGeminiService(apiKey);

        // 4. Generate Image
        const imageUrl = await aiService.generateImage(prompt);

        return NextResponse.json({ imageUrl });

    } catch (error: any) {
        console.error('Image Generation Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate image' },
            { status: 500 }
        );
    }
}
