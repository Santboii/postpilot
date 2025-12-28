import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { GoogleGeminiService } from '@/lib/ai/google';

// Initialize AI service
const aiService = new GoogleGeminiService(process.env.GOOGLE_ATTRIBUTION_API_KEY || '');

export async function GET(request: Request) {
    // 1. Authenticate Request
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow unauthorized for now for testing if secret is missing in dev, but log warning
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.warn('CRON running without secret verification (Dev Mode)');
    }

    // Use Admin Client to bypass RLS since CRON has no user session
    const supabase = createAdminClient();
    const now = new Date();

    // Get current time and day
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const currentHour = now.getHours();

    // We match slots scheduled for this Hour (HH:00:00)
    // Note: This relies on the system running this job at XX:00-XX:14 roughly.
    const timeString = `${currentHour.toString().padStart(2, '0')}:00:00`;

    try {
        // 2. Fetch Matching Slots
        const { data: slots, error: slotsError } = await supabase
            .from('weekly_slots')
            .select('*, content_libraries!inner(*)') // Inner join to ensure library exists
            .eq('day_of_week', dayOfWeek)
            .eq('time_of_day', timeString);

        if (slotsError) {
            console.error('Error fetching slots:', slotsError);
            throw slotsError;
        }

        if (!slots || slots.length === 0) {
            return NextResponse.json({ message: 'No slots scheduled for this hour.' });
        }

        const results = [];

        // 3. Process Each Slot
        for (const slot of slots) {
            // content_libraries is usually an object with inner join, but TypeScript might see array
            const library = Array.isArray(slot.content_libraries)
                ? slot.content_libraries[0]
                : slot.content_libraries;

            if (!library || library.is_paused) continue;

            // 3a. Find valid post in library (FIFO)
            // We find "Evergreen" posts belonging to this library
            const { data: posts, error: postsError } = await supabase
                .from('posts')
                .select('*')
                .eq('library_id', library.id)
                .eq('is_evergreen', true)
                .order('last_published_at', { ascending: true, nullsFirst: true }) // Oldest first
                .limit(1);

            if (postsError) {
                console.error(`Error fetching posts for lib ${library.id}:`, postsError);
                continue;
            }

            const sourcePost = posts?.[0];
            if (!sourcePost) {
                results.push({ slot: slot.id, result: 'Empty library' });
                continue;
            }

            // 3b. Determine Content (Remix vs Recycle)
            let finalContent = sourcePost.content;
            let wasRemixed = false;

            // Determine target platforms from slot
            const targetPlatformIds = (slot.platform_ids && slot.platform_ids.length > 0)
                ? slot.platform_ids
                : ['twitter']; // Fallback only if slot is broken/legacy

            if (library.auto_remix) {
                try {
                    // Use the first platform for optimization context
                    const primaryPlatform = targetPlatformIds[0];
                    const remixed = await aiService.optimizeContent(sourcePost.content, primaryPlatform, 'Maintain brand voice but ensure the content feels fresh and unique.');
                    finalContent = remixed;
                    wasRemixed = true;
                } catch (e) {
                    console.error('Remix failed, using original:', e);
                }
            }

            // 3c. Publish Post (Create Instance)
            // Since we are using Admin Client, we act as the system.
            // We assign the post to the 'slot.user_id' so they see it.

            const { data: newPost, error: createError } = await supabase
                .from('posts')
                .insert({
                    user_id: slot.user_id,
                    content: finalContent,
                    media: sourcePost.media,
                    status: 'published',
                    published_at: new Date().toISOString(),
                    // We do NOT link to library_id to prevent it from entering the recycling pool as a duplicate
                    // library_id: null, 
                    is_evergreen: false
                })
                .select()
                .single();

            if (createError) {
                console.error('Failed to create instance post:', createError);
                results.push({ slot: slot.id, error: createError.message });
                continue;
            }

            // 3c-2. Assign Platforms to new Post
            if (newPost) {
                const platformAssignments = targetPlatformIds.map((pid: string) => ({
                    post_id: newPost.id,
                    platform: pid
                }));

                const { error: platformError } = await supabase
                    .from('post_platforms')
                    .insert(platformAssignments);

                if (platformError) {
                    console.error('Failed to assign platforms to auto-post:', platformError);
                    // Non-fatal, but logged
                }
            }

            // 3d. Update Source Post metadata (Rotate to back of queue)
            await supabase
                .from('posts')
                .update({ last_published_at: new Date().toISOString() })
                .eq('id', sourcePost.id);

            // 3e. Log Activity
            await supabase.from('activities').insert({
                user_id: slot.user_id,
                type: 'published',
                message: `Auto-published from "${library.name}" library${wasRemixed ? ' (Remixed AI)' : ''}`,
                post_id: newPost.id,
            });

            results.push({
                slot: slot.id,
                action: 'published',
                source: sourcePost.id,
                newPost: newPost.id,
                remixed: wasRemixed
            });
        }

        return NextResponse.json({ success: true, processed: results.length, details: results });

    } catch (error: any) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
