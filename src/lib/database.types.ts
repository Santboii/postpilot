export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            posts: {
                Row: {
                    id: string
                    user_id: string
                    content: string
                    status: 'draft' | 'scheduled' | 'published' | 'failed'
                    scheduled_at: string | null
                    published_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    content: string
                    status?: 'draft' | 'scheduled' | 'published' | 'failed'
                    scheduled_at?: string | null
                    published_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    content?: string
                    status?: 'draft' | 'scheduled' | 'published' | 'failed'
                    scheduled_at?: string | null
                    published_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            post_platforms: {
                Row: {
                    id: string
                    post_id: string
                    platform: string
                    custom_content: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    post_id: string
                    platform: string
                    custom_content?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    post_id?: string
                    platform?: string
                    custom_content?: string | null
                    created_at?: string
                }
            }
            profiles: {
                Row: {
                    id: string
                    display_name: string | null
                    avatar_url: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    display_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    display_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
            }
            activities: {
                Row: {
                    id: string
                    user_id: string
                    type: string
                    message: string
                    post_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: string
                    message: string
                    post_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: string
                    message?: string
                    post_id?: string | null
                    created_at?: string
                }
            }
            connected_accounts: {
                Row: {
                    id: string
                    user_id: string
                    platform: string
                    access_token: string | null
                    refresh_token: string | null
                    expires_at: string | null
                    platform_user_id: string | null
                    platform_username: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    platform: string
                    access_token?: string | null
                    refresh_token?: string | null
                    expires_at?: string | null
                    platform_user_id?: string | null
                    platform_username?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    platform?: string
                    access_token?: string | null
                    refresh_token?: string | null
                    expires_at?: string | null
                    platform_user_id?: string | null
                    platform_username?: string | null
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
