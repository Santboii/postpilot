import { generateId } from '@/types';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com';

// API Version for the new Posts API
const LINKEDIN_API_VERSION = '202511';

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
    const response = await fetch(`${LINKEDIN_API_URL}/v2/userinfo`, {
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
 * Initialize image upload to LinkedIn using the new Images API
 * Returns the upload URL and image URN
 */
async function initializeImageUpload(accessToken: string, personUrn: string) {
    const response = await fetch(`${LINKEDIN_API_URL}/rest/images?action=initializeUpload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'LinkedIn-Version': LINKEDIN_API_VERSION,
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
            initializeUploadRequest: {
                owner: personUrn,
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('LinkedIn image upload init failed:', errorText);
        throw new Error(`Failed to initialize image upload: ${errorText}`);
    }

    const data = await response.json();
    return {
        uploadUrl: data.value.uploadUrl,
        imageUrn: data.value.image,
    };
}

/**
 * Upload image binary to LinkedIn
 */
async function uploadImageBinary(uploadUrl: string, accessToken: string, imageBuffer: Buffer) {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('LinkedIn image binary upload failed:', errorText);
        throw new Error(`Failed to upload image binary: ${errorText}`);
    }
}

/**
 * Generate a random state string for security
 */
export function generateState(): string {
    return generateId();
}

/**
 * Post a share to LinkedIn using the new Posts API (text or text + image)
 */
export async function postLinkedInShare(
    accessToken: string,
    personId: string,
    content: string,
    imageBuffer?: Buffer,
    imageAltText?: string
) {
    const personUrn = `urn:li:person:${personId}`;
    let imageUrn: string | null = null;

    // Handle Image Upload if present
    if (imageBuffer) {
        try {
            const { uploadUrl, imageUrn: urn } = await initializeImageUpload(accessToken, personUrn);
            await uploadImageBinary(uploadUrl, accessToken, imageBuffer);
            imageUrn = urn;
        } catch (err) {
            console.error('Image upload failed, proceeding with text-only post:', err);
            // Proceed without image rather than failing entirely
        }
    }

    // Build post body using the new Posts API schema
    const postBody: any = {
        author: personUrn,
        commentary: content,
        visibility: 'PUBLIC',
        distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
    };

    // Add image content if we have one
    if (imageUrn) {
        postBody.content = {
            media: {
                id: imageUrn,
                altText: imageAltText || 'Image',
            },
        };
    }

    const response = await fetch(`${LINKEDIN_API_URL}/rest/posts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'LinkedIn-Version': LINKEDIN_API_VERSION,
            'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('LinkedIn post failed:', errorText);
        throw new Error(`Failed to post to LinkedIn: ${errorText}`);
    }

    // The new Posts API returns the post URN in the x-restli-id header
    const postUrn = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id');

    return {
        id: postUrn,
        success: true
    };
}
