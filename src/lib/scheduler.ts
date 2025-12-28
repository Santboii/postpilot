import { createAdminClient } from '@/lib/supabase/admin';

export async function processWeeklySlots() {
    const supabase = createAdminClient();
    const now = new Date(); // Current UTC time

    console.log(`[Scheduler] Checking slots at UTC: ${now.toISOString()}`);

    try {
        // 1. Fetch matching slots with library info
        // We fetch ALL slots for now and filter in memory because "Current Day/Hour" depends on User Timezone
        const { data: slots, error: slotsError } = await supabase
            .from('weekly_slots')
            .select(`
                *,
                content_libraries!inner (
                    id,
                    is_paused,
                    user_id
                )
            `);

        if (slotsError) throw slotsError;

        if (!slots || slots.length === 0) {
            console.log('[Scheduler] No active slots found.');
            return { processed: 0, created: 0 };
        }

        // 2. Fetch timezones for these users
        const userIds = Array.from(new Set(slots.map(s => s.user_id)));
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, timezone')
            .in('id', userIds);

        if (profilesError) throw profilesError;

        const userTimezones = new Map<string, string>();
        profiles?.forEach(p => {
            if (p.timezone) userTimezones.set(p.id, p.timezone);
        });

        // 3. Filter slots that match specific user's local time
        const matchingSlots = slots.filter(slot => {
            if (!slot.content_libraries || slot.content_libraries.is_paused) return false;

            const timezone = userTimezones.get(slot.user_id) || 'UTC';

            // Get user's local time parts
            // We use Intl.DateTimeFormat to robustly handle IANA timezones (e.g. "America/New_York")
            const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
            const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false });

            const dayStr = dayFormatter.format(now); // "Sun", "Mon", ...
            const hourStr = hourFormatter.format(now); // "0", "15", "23"

            // Map "Sun" -> 0 to match DB
            const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
            const localDay = dayMap[dayStr];
            let localHour = parseInt(hourStr, 10);

            // Handle midnight 24 edge case if implementation varies
            if (localHour === 24) localHour = 0;

            // Slot time check "HH:00:00"
            const [slotHour] = slot.time_of_day.split(':').map(Number);

            // Match Day AND Hour
            return slot.day_of_week === localDay && slotHour === localHour;
        });

        console.log(`[Scheduler] Found ${matchingSlots.length} matching slots out of ${slots.length} total.`);

        if (matchingSlots.length === 0) {
            return { processed: 0, created: 0 };
        }

        let createdCount = 0;

        // 4. Process matches
        for (const slot of matchingSlots) {
            // Find a draft post from this library
            // Strategy: Oldest draft first (FIFO)
            const { data: posts, error: postsError } = await supabase
                .from('posts')
                .select('id, content')
                .eq('library_id', slot.library_id)
                .eq('status', 'draft')
                .order('created_at', { ascending: true })
                .limit(1);

            if (postsError) {
                console.error(`Error fetching posts for library ${slot.library_id}:`, postsError);
                continue;
            }

            if (posts && posts.length > 0) {
                const post = posts[0];
                const scheduledTime = now.toISOString();

                // Update post
                const { error: updateError } = await supabase
                    .from('posts')
                    .update({
                        status: 'scheduled',
                        scheduled_at: scheduledTime,
                        updated_at: scheduledTime
                    })
                    .eq('id', post.id);

                if (updateError) {
                    console.error(`Error updating post ${post.id}:`, updateError);
                    continue;
                }

                // Add platform assignments from slot
                if (slot.platform_ids && slot.platform_ids.length > 0) {
                    const platformInserts = slot.platform_ids.map((pid: string) => ({
                        post_id: post.id,
                        platform: pid
                    }));

                    await supabase.from('post_platforms').delete().eq('post_id', post.id);
                    await supabase.from('post_platforms').insert(platformInserts);
                }

                createdCount++;
            } else {
                // No drafts found
                console.log(`No drafts found for library ${slot.content_libraries.id}`);
            }
        }

        return { processed: matchingSlots.length, created: createdCount };

    } catch (error) {
        console.error('Error processing weekly slots:', error);
        throw error;
    }
}
