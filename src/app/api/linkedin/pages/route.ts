import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getLinkedInUserInfo } from '@/lib/social/linkedin';

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get LinkedIn token
        const { data: connection } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'linkedin')
            .single();

        if (!connection) {
            return NextResponse.json({ error: 'No LinkedIn connection found' });
        }

        // 1. Fetch User Profile (Default Option)
        const profile = await getLinkedInUserInfo(connection.access_token);

        const accounts = [
            {
                id: `urn:li:person:${profile.id}`,
                name: `${profile.name} (Personal Profile)`,
                image: profile.picture,
                type: 'person',
                selected: connection.platform_user_id === `urn:li:person:${profile.id}` || connection.platform_user_id === profile.id
            }
        ];

        // 2. Fetch Organizations
        // Note: Using 'q=roleAssignee' without specific role/state filters to catch all visibility levels
        const response = await fetch('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee', {
            headers: {
                'Authorization': `Bearer ${connection.access_token}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202511',
            },
        });

        console.log('LinkedIn Org ACLs Status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('LinkedIn Org ACLs Error:', errorText);
        }

        if (response.ok) {
            const data = await response.json();
            console.log('LinkedIn Org ACLs Data:', JSON.stringify(data, null, 2));

            // Enrich with names
            for (const element of data.elements) {
                const orgUrn = element.organizationalTarget;
                const orgId = orgUrn.split(':').pop();

                // Fetch org details
                const detailsRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                    headers: {
                        'Authorization': `Bearer ${connection.access_token}`,
                        'X-Restli-Protocol-Version': '2.0.0',
                    },
                });

                if (detailsRes.ok) {
                    const details = await detailsRes.json();

                    // Try to finding logo (very nested in LinkedIn API)
                    // Simplified: just use name for now

                    accounts.push({
                        id: orgUrn,
                        name: `${details.localizedName} (Company Page)`,
                        image: null, // TODO: Extract logo if needed
                        type: 'organization',
                        selected: connection.platform_user_id === orgUrn
                    });
                }
            }
        }

        return NextResponse.json({ accounts });

    } catch (error) {
        console.error('Failed to fetch LinkedIn pages:', error);
        return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 });
    }
}
