export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics: {
        Row: {
          group_id: string
          last_updated: string
          platform_breakdown: Json
          total_views: number
        }
        Insert: {
          group_id: string
          last_updated?: string
          platform_breakdown?: Json
          total_views?: number
        }
        Update: {
          group_id?: string
          last_updated?: string
          platform_breakdown?: Json
          total_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "analytics_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          content_type: string
          created_at: string
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          external_id: string | null
          group_id: string | null
          id: string
          platform_id: string
          published_at: string | null
          social_account_id: string | null
          status: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          user_id: string
          notes: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          platform_id: string
          published_at?: string | null
          social_account_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
          notes?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_id?: string | null
          group_id?: string | null
          id?: string
          platform_id?: string
          published_at?: string | null
          social_account_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_metrics: {
        Row: {
          api_error: string | null
          comments: number
          content_id: string
          engagement_rate: number
          followers_gained: number
          impressions: number
          last_fetched_at: string | null
          last_synced: string
          likes: number
          reach: number
          saves: number
          shares: number
          sync_status: string
          views: number
          watch_time_seconds: number
          updated_by: string | null
          updated_at: string
          manual_override: boolean
        }
        Insert: {
          api_error?: string | null
          comments?: number
          content_id: string
          engagement_rate?: number
          followers_gained?: number
          impressions?: number
          last_fetched_at?: string | null
          last_synced?: string
          likes?: number
          reach?: number
          saves?: number
          shares?: number
          sync_status?: string
          views?: number
          watch_time_seconds?: number
          updated_by?: string | null
          updated_at?: string
          manual_override?: boolean
        }
        Update: {
          api_error?: string | null
          comments?: number
          content_id?: string
          engagement_rate?: number
          followers_gained?: number
          impressions?: number
          last_fetched_at?: string | null
          last_synced?: string
          likes?: number
          reach?: number
          saves?: number
          shares?: number
          sync_status?: string
          views?: number
          watch_time_seconds?: number
          updated_by?: string | null
          updated_at?: string
          manual_override?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "content_metrics_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: true
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      content_metrics_history: {
        Row: {
          comments: number
          content_id: string
          engagement_rate: number
          followers_gained: number
          id: string
          impressions: number
          likes: number
          reach: number
          recorded_at: string
          saves: number
          shares: number
          views: number
          watch_time_seconds: number
        }
        Insert: {
          comments?: number
          content_id: string
          engagement_rate?: number
          followers_gained?: number
          id?: string
          impressions?: number
          likes?: number
          reach?: number
          recorded_at?: string
          saves?: number
          shares?: number
          views?: number
          watch_time_seconds?: number
        }
        Update: {
          comments?: number
          content_id?: string
          engagement_rate?: number
          followers_gained?: number
          id?: string
          impressions?: number
          likes?: number
          reach?: number
          recorded_at?: string
          saves?: number
          shares?: number
          views?: number
          watch_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_metrics_history_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          email: string
          role: Database["public"]["Enums"]["member_role"]
          invitation_status: Database["public"]["Enums"]["invite_status"]
          joined_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          email: string
          role?: Database["public"]["Enums"]["member_role"]
          invitation_status?: Database["public"]["Enums"]["invite_status"]
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          email?: string
          role?: Database["public"]["Enums"]["member_role"]
          invitation_status?: Database["public"]["Enums"]["invite_status"]
          joined_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          disabled: boolean
          facebook: string | null
          id: string
          instagram: string | null
          linkedin: string | null
          member_names: string[]
          team_leader: string | null
          team_name: string
          tiktok: string | null
          updated_at: string
          website: string | null
          youtube: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          disabled?: boolean
          facebook?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          member_names?: string[]
          team_leader?: string | null
          team_name: string
          tiktok?: string | null
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          disabled?: boolean
          facebook?: string | null
          id?: string
          instagram?: string | null
          linkedin?: string | null
          member_names?: string[]
          team_leader?: string | null
          team_name?: string
          tiktok?: string | null
          updated_at?: string
          website?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      platforms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          oauth_client_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          oauth_client_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          oauth_client_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          is_active: boolean
          platform_account_id: string
          platform_id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          platform_account_id: string
          platform_id: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean
          platform_account_id?: string
          platform_id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_links: {
        Row: {
          api_error: string | null
          channel_name: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          group_id: string
          id: string
          last_comment_count: number | null
          last_fetched_at: string | null
          last_like_count: number | null
          last_synced: string | null
          last_view_count: number | null
          platform: Database["public"]["Enums"]["platform_type"]
          published_at: string | null
          status: Database["public"]["Enums"]["link_status"]
          sync_status: Database["public"]["Enums"]["sync_status"]
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          youtube_video_id: string | null
          notes: string | null
          updated_by: string | null
          metrics_updated_at: string | null
          manual_override: boolean | null
          watch_time_seconds: number | null
          engagement_rate: number | null
        }
        Insert: {
          api_error?: string | null
          channel_name?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          group_id: string
          id?: string
          last_comment_count?: number | null
          last_fetched_at?: string | null
          last_like_count?: number | null
          last_synced?: string | null
          last_view_count?: number | null
          platform?: Database["public"]["Enums"]["platform_type"]
          published_at?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          sync_status?: Database["public"]["Enums"]["sync_status"]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          youtube_video_id?: string | null
          notes?: string | null
          updated_by?: string | null
          metrics_updated_at?: string | null
          manual_override?: boolean | null
          watch_time_seconds?: number | null
          engagement_rate?: number | null
        }
        Update: {
          api_error?: string | null
          channel_name?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          group_id?: string
          id?: string
          last_comment_count?: number | null
          last_fetched_at?: string | null
          last_like_count?: number | null
          last_synced?: string | null
          last_view_count?: number | null
          platform?: Database["public"]["Enums"]["platform_type"]
          published_at?: string | null
          status?: Database["public"]["Enums"]["link_status"]
          sync_status?: Database["public"]["Enums"]["sync_status"]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          youtube_video_id?: string | null
          notes?: string | null
          updated_by?: string | null
          metrics_updated_at?: string | null
          manual_override?: boolean | null
          watch_time_seconds?: number | null
          engagement_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      video_metrics_history: {
        Row: {
          id: string
          video_link_id: string
          views: number
          likes: number
          comments: number
          recorded_at: string
        }
        Insert: {
          id?: string
          video_link_id: string
          views?: number
          likes?: number
          comments?: number
          recorded_at?: string
        }
        Update: {
          id?: string
          video_link_id?: string
          views?: number
          likes?: number
          comments?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_metrics_history_video_link_id_fkey"
            columns: ["video_link_id"]
            isOneToOne: false
            referencedRelation: "video_links"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string
          email: string
          team_name: string | null
          member_names: string[]
          created_at: string
          updated_at: string
          suspended_at: string | null
          suspension_reason: string | null
        }
        Insert: {
          id: string
          username: string
          email: string
          team_name?: string | null
          member_names?: string[]
          created_at?: string
          updated_at?: string
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Update: {
          id?: string
          username?: string
          email?: string
          team_name?: string | null
          member_names?: string[]
          created_at?: string
          updated_at?: string
          suspended_at?: string | null
          suspension_reason?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      group_analytics_summary: {
        Row: {
          group_id: string
          team_name: string
          video_count: number
          total_views: number
          total_likes: number
          total_comments: number
          last_synced: string | null
          valid_count: number
          invalid_count: number
          youtube_count: number
        }
        Relationships: []
      }
      top_videos: {
        Row: {
          id: string
          group_id: string
          team_name: string
          title: string | null
          url: string
          platform: Database["public"]["Enums"]["platform_type"]
          youtube_video_id: string | null
          thumbnail_url: string | null
          channel_name: string | null
          last_view_count: number | null
          last_like_count: number | null
          last_comment_count: number | null
          last_synced: string | null
          sync_status: Database["public"]["Enums"]["sync_status"]
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_group: { Args: { _group_id: string }; Returns: boolean }
      is_group_member: { Args: { _group_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      invite_status: "pending" | "accepted" | "rejected"
      link_status: "valid" | "invalid" | "pending"
      member_role: "owner" | "member"
      platform_type:
        | "youtube"
        | "facebook"
        | "instagram"
        | "tiktok"
        | "vimeo"
        | "other"
      sync_status:
        | "idle"
        | "pending"
        | "syncing"
        | "success"
        | "error"
        | "private"
        | "deleted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      invite_status: ["pending", "accepted", "rejected"],
      link_status: ["valid", "invalid", "pending"],
      member_role: ["owner", "member"],
      platform_type: [
        "youtube",
        "facebook",
        "instagram",
        "tiktok",
        "vimeo",
        "other",
      ],
    },
  },
} as const
