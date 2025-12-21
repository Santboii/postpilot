import { createClient } from '@/lib/supabase/server';
import { GoogleGeminiService } from '@/lib/ai/google';
import { BrandProfile } from '@/types';
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
        const { topic, platform, includeImage } = await req.json();
        if (!topic || !platform) {
            return NextResponse.json({ error: 'Missing topic or platform' }, { status: 400 });
        }

        // 3. Fetch Brand Profile
        const { data: profile, error: profileError } = await supabase
            .from('brand_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            console.error('Brand Profile Error:', profileError);
            return NextResponse.json(
                { error: 'Brand profile not found. Please set up your Brand DNA in Settings first.' },
                { status: 404 }
            );
        }

        // 4. Instantiate AI Service
        // In a real app, this key would come from process.env.GOOGLE_API_KEY
        // For now, users must have it in .env.local
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'AI Service Misconfigured (Missing Keys)' }, { status: 500 });
        }

        const aiService = new GoogleGeminiService(apiKey);

        // 5. Generate Text
        const generatedPost = await aiService.generatePost({
            topic,
            platform,
            brandProfile: {
                name: profile.brand_name,
                audience: profile.audience,
                tone: profile.tone,
                examples: profile.examples,
            },
        });

        let imageUrl = null;

        // 6. Generate Image (if requested)
        if (includeImage && generatedPost.imagePrompt) {
            try {
                // Passing the AI-generated prompt to the image model
                imageUrl = await aiService.generateImage(generatedPost.imagePrompt);
            } catch (imgError) {
                console.error('Image generation failed:', imgError);
                // We don't fail the whole request if image fails, just return null
            }
        }

        return NextResponse.json({
            post: generatedPost,
            imageUrl
        });

    } catch (error: any) {
        console.error('AI Generation Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return NextResponse.json(
            { error: error.message || 'Failed to generate content' },
            { status: 500 }
        );
    }
}
