import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: Request) {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { libraryId, topicPrompt, count = 5 } = await request.json();

        if (!libraryId || !topicPrompt) {
            return NextResponse.json({ error: 'libraryId and topicPrompt are required' }, { status: 400 });
        }

        // Verify library belongs to user
        const { data: library, error: libError } = await supabase
            .from('content_libraries')
            .select('*')
            .eq('id', libraryId)
            .eq('user_id', user.id)
            .single();

        if (libError || !library) {
            return NextResponse.json({ error: 'Library not found' }, { status: 404 });
        }

        // Generate posts using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const settings = library.ai_settings || {};
        const tone = settings.tone === 'Custom' ? settings.custom_tone : (settings.tone || 'Professional');
        const audience = settings.audience ? `Target Audience: ${settings.audience}` : '';
        const language = settings.language || 'English';
        const lengthMap = {
            'short': 'very short (under 50 words)',
            'medium': 'medium length (50-150 words)',
            'long': 'longer, detailed posts (150+ words)'
        };
        // Determine intelligent defaults based on platforms
        const targetPlatforms = library.platforms || [];
        const isTwitterOnly = targetPlatforms.length === 1 && targetPlatforms[0] === 'twitter';
        const isLinkedInOnly = targetPlatforms.length === 1 && targetPlatforms[0] === 'linkedin';
        const hasLongFormSupport = targetPlatforms.some((p: string) => ['linkedin', 'facebook'].includes(p));

        const defaultLength = isTwitterOnly ? 'concise (under 280 chars)'
            : hasLongFormSupport ? 'engaging (150-500 words)'
                : 'concise but engaging (under 500 chars)';

        const lengthInstruction = lengthMap[settings.length as keyof typeof lengthMap] || defaultLength;
        const emojiInstruction = settings.use_emojis === false ? 'Do NOT use emojis.' : 'Include relevant emojis.';

        let hashtagInstruction = 'Do NOT include hashtags.';
        if (settings.hashtag_strategy === 'auto') {
            hashtagInstruction = 'Include 3-5 relevant, high-traffic hashtags at the end of each post.';
        } else if (settings.hashtag_strategy === 'custom' && settings.custom_hashtags) {
            hashtagInstruction = `Append exactly these hashtags to every post: ${settings.custom_hashtags}`;
        }

        const prompt = `You are a social media content expert. Generate ${count} unique, engaging social media posts about: "${topicPrompt}"
        
CONTEXT:
- Tone: ${tone}
- Language: ${language}
- Length: ${lengthInstruction}
- ${audience}

REQUIREMENTS:
- ${emojiInstruction}
- ${hashtagInstruction}
- Make them varied in style: some questions, some statements, some tips.
- Make them shareable and engaging.

Return ONLY a JSON array of strings, no other text:
["post 1 content", "post 2 content", ...]`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse the JSON response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Failed to parse AI response');
        }

        const posts: string[] = JSON.parse(jsonMatch[0]);

        // Insert posts into database (without platforms - those are in post_platforms table)
        const postsToInsert = posts.map(content => ({
            user_id: user.id,
            content,
            status: 'draft',
            library_id: libraryId,
            is_evergreen: true,
        }));

        const { data: insertedPosts, error: insertError } = await supabase
            .from('posts')
            .insert(postsToInsert)
            .select();

        if (insertError) {
            console.error('Insert error:', insertError);
            throw insertError;
        }

        // Insert platform assignments based on library settings
        if (insertedPosts && insertedPosts.length > 0) {
            const targetPlatforms = (library.platforms && library.platforms.length > 0)
                ? library.platforms
                : ['twitter']; // Fallback to twitter if no platforms set

            const platformAssignments = insertedPosts.flatMap(post =>
                targetPlatforms.map((platform: string) => ({
                    post_id: post.id,
                    platform: platform,
                }))
            );

            await supabase.from('post_platforms').insert(platformAssignments);
        }

        return NextResponse.json({
            success: true,
            posts: insertedPosts,
            count: insertedPosts?.length || 0,
        });

    } catch (error) {
        console.error('Failed to generate posts:', error);
        return NextResponse.json({ error: 'Failed to generate posts' }, { status: 500 });
    }
}
