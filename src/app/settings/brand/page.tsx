import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BrandSettings from '@/components/settings/BrandSettings';

export default async function BrandSettingsPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    return <BrandSettings />;
}
