
export interface PostGenerationParams {
    platform: string;
    topic: string;
    brandProfile: {
        name: string;
        audience: string;
        tone: string;
        examples: string[];
    };
}

export interface GeneratedPost {
    content: string;
    imagePrompt?: string; // Optional: prompt used to generate the image
}

export interface AIProvider {
    /**
     * Generates a social media post text based on the brand profile.
     */
    generatePost(params: PostGenerationParams): Promise<GeneratedPost>;

    /**
     * Generates an image URL from a prompt.
     */
    generateImage(prompt: string, aspectRatio?: string): Promise<string>;
}
