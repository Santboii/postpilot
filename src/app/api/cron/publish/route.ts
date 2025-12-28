import { NextRequest, NextResponse } from 'next/server';
import { publishScheduledPosts } from '@/lib/publishing';
import { processWeeklySlots } from '@/lib/scheduler';

export const dynamic = 'force-dynamic'; // Prevent caching

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 1. Process recurring weekly slots -> promotes drafts to scheduled
        const slotResults = await processWeeklySlots();

        // 2. Publish all scheduled posts (including the ones just promoted)
        const publishResults = await publishScheduledPosts();

        return NextResponse.json({
            success: true,
            slots: slotResults,
            publishing: publishResults
        });
    } catch (error) {
        console.error('Cron job execution failed:', error);
        return NextResponse.json(
            { success: false, error: (error as Error).message },
            { status: 500 }
        );
    }
}
