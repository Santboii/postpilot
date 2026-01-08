import { NextResponse } from 'next/server';
import { syncStripeData } from '@/lib/stripe/sync';

export async function POST() {
    try {
        const logs = await syncStripeData();
        return NextResponse.json({ message: 'Sync complete', logs });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
