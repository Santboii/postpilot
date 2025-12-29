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

        // Create platform-specific prompt instructions
        const platformInstructions: string[] = [];
        const requestedVariants: string[] = [];

        if (targetPlatforms.includes('twitter')) {
            platformInstructions.push("- For Twitter (X): STRICT LIMIT: Must be under 280 characters. Concise, punchy, no hashtags.");
            requestedVariants.push('twitter');
        }
        if (targetPlatforms.includes('threads')) {
            platformInstructions.push("- For Threads: Conversational, under 500 characters. Can be slightly longer than Twitter.");
            requestedVariants.push('threads');
        }
        if (targetPlatforms.includes('linkedin')) {
            platformInstructions.push("- For LinkedIn: The Master Content will be used. Ensure Master Content is professional and valuable.");
            // Do NOT add to requestedVariants. Use Shared.
        }
        if (targetPlatforms.includes('instagram')) {
            platformInstructions.push("- For Instagram: Visual-first caption. Use line breaks for readability.");
            requestedVariants.push('instagram');
        }
        if (targetPlatforms.includes('facebook')) {
            platformInstructions.push("- For Facebook: The Master Content will be used. Ensure Master Content is engaging.");
            // Do NOT add to requestedVariants. Use Shared.
        }

        const validVariants = requestedVariants.length > 0 ? requestedVariants : ["twitter"];

        const prompt = `You are a social media content expert. Generate ${count} unique, engaging social media posts about: "${topicPrompt}"
        
CONTEXT:
- Tone: ${tone}
- Language: ${language}
- ${audience}

REQUIREMENTS:
- ${emojiInstruction}
- ${hashtagInstruction}
- Create a "Master Idea" content that is platform-neutral (${lengthInstruction}).
- Create specific variants for: ${validVariants.join(', ')}.

PLATFORM RULES:
${platformInstructions.join('\n')}

CRITICAL OUTPUT FORMATTING:
- Return ONLY a valid JSON array.
- Do NOT wrap in markdown code blocks (no \`\`\`json).
- Do NOT include any conversational text.
- Ensure "platform_content" keys match exactly: ${validVariants.join(', ')}.

EXAMPLE JSON STRUCTURE:
[
  {
    "content": "Master content here...",
    "platform_content": {
        "twitter": "Short tweet...",
        "linkedin": "Longer post...",
        "instagram": "Caption with line breaks..."
    }
  }
]`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Robustly extract JSON array
        console.log('Raw AI Response:', responseText); // Log for debugging

        let jsonString = responseText;
        // 1. Try to find content within ```json ... ``` blocks
        const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
        } else {
            // 2. Fallback: find the first '[' and the last ']'
            const firstBracket = responseText.indexOf('[');
            const lastBracket = responseText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                jsonString = responseText.substring(firstBracket, lastBracket + 1);
            }
        }

        let generatedItems: { content: string, platform_content?: Record<string, string> }[] = [];
        try {
            generatedItems = JSON.parse(jsonString);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            console.error('Failed JSON string:', jsonString);
            throw new Error(`Failed to parse AI response. Raw: ${responseText.substring(0, 100)}...`);
        }

        // Insert posts into database
        const postsToInsert = generatedItems.map(item => ({
            user_id: user.id,
            content: item.content,
            platform_content: item.platform_content || {},
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
        // Insert platform assignments based on library settings
        if (insertedPosts && insertedPosts.length > 0) {
            const targetPlatforms = (library.platforms && library.platforms.length > 0)
                ? library.platforms
                : ['twitter']; // Fallback to twitter if no platforms set

            const platformAssignments = insertedPosts.flatMap((post, index) => {
                const originalItem = generatedItems[index];
                const variants = originalItem.platform_content || {};

                // Normalize variant keys to lowercase for safe lookup
                const normalizedVariants = Object.keys(variants).reduce((acc, key) => {
                    acc[key.toLowerCase()] = variants[key];
                    return acc;
                }, {} as Record<string, string>);

                return targetPlatforms.map((platform: string) => ({
                    post_id: post.id,
                    platform: platform,
                    // Use normalized lookup to handle "Twitter" vs "twitter" AI idiosyncrasies
                    custom_content: normalizedVariants[platform.toLowerCase()] || null
                }));
            });

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
