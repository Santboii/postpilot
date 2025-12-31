import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { accountId, accountName } = await request.json();

        if (!accountId) {
            return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
        }

        // Update the connection
        const { error } = await supabase
            .from('connected_accounts')
            .update({
                platform_user_id: accountId,
                platform_username: accountName // Update display name too
            })
            .eq('user_id', user.id)
            .eq('platform', 'linkedin');

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Failed to select LinkedIn page:', error);
        return NextResponse.json({ error: 'Failed to update selection' }, { status: 500 });
    }
}
