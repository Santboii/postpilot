import { generateId } from '@/types';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

/**
 * Generates the LinkedIn OAuth authorization URL
 */
export function getLinkedInAuthUrl(redirectUri: string, state: string): string {
    if (!CLIENT_ID) {
        throw new Error('Missing LINKEDIN_CLIENT_ID');
    }

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        state: state,
        scope: 'openid profile w_member_social email',
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access token
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Missing LinkedIn credentials');
    }

    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to exchange token: ${error}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token, // LinkedIn might not return this for all flows
        refreshExpiresIn: data.refresh_token_expires_in,
    };
}

/**
 * Fetches user profile information using OpenID Connect
 */
export async function getLinkedInUserInfo(accessToken: string) {
    const response = await fetch(`${LINKEDIN_API_URL}/userinfo`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
        id: data.sub,
        name: data.name,
        email: data.email,
        picture: data.picture,
    };
}

/**
 * Refresh LinkedIn access token
 */
export async function refreshLinkedInToken(refreshToken: string) {
    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('Missing LinkedIn credentials');
    }

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        expiresIn: data.expires_in,
        refreshToken: data.refresh_token,
        refreshExpiresIn: data.refresh_token_expires_in,
    };
}

/**
 * Register an image upload to LinkedIn
 */
async function registerUpload(accessToken: string, urn: string) {
    const response = await fetch(`${LINKEDIN_API_URL}/assets?action=registerUpload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            registerUploadRequest: {
                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                owner: `urn:li:person:${urn}`,
                serviceRelationships: [
                    {
                        relationshipType: 'OWNER',
                        identifier: 'urn:li:userGeneratedContent',
                    },
                ],
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to register upload: ${await response.text()}`);
    }

    const data = await response.json();
    return {
        uploadUrl: data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl,
        asset: data.value.asset,
    };
}

/**
 * Upload image binary to LinkedIn
 */
async function uploadImage(uploadUrl: string, imageBuffer: Buffer) {
    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + uploadUrl.split('Bearer ')[1], // Sometimes uploadUrl has token
        },
        body: imageBuffer as any,
    });

    if (!response.ok) {
        throw new Error(`Failed to upload image binary: ${await response.text()}`);
    }
}

/**
 * Generate a random state string for security
 */
export function generateState(): string {
    return generateId();
}

/**
 * Post a share to LinkedIn (text or text + image)
 */
export async function postLinkedInShare(
    accessToken: string,
    urn: string,
    content: string,
    imageBuffer?: Buffer,
    imageAltText?: string
) {
    let mediaAsset = null;

    // Handle Image Upload if present
    if (imageBuffer) {
        const { uploadUrl, asset } = await registerUpload(accessToken, urn);
        await uploadImage(uploadUrl, imageBuffer);
        mediaAsset = asset;
    }

    const body: any = {
        author: `urn:li:person:${urn}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                    text: content,
                },
                shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE',
            },
        },
        visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
    };

    if (mediaAsset) {
        body.specificContent['com.linkedin.ugc.ShareContent'].media = [
            {
                status: 'READY',
                description: {
                    text: imageAltText || 'Image',
                },
                media: mediaAsset,
                title: {
                    text: 'Shared Image',
                },
            },
        ];
    }

    const response = await fetch(`${LINKEDIN_API_URL}/ugcPosts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to post to LinkedIn: ${error}`);
    }

    return await response.json();
}
