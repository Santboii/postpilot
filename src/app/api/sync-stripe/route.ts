import { NextResponse } from 'next/server';
import { syncStripeData } from '@/lib/stripe/sync';

export async function POST() {
    try {
        const logs = await syncStripeData();
        return NextResponse.json({ message: 'Sync complete', logs });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
