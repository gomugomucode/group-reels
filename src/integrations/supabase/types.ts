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
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          email: string
          role: Database["public"]["Enums"]["member_role"]
          invitation_status: Database["public"]["Enums"]["invite_status"]
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          email: string
          role?: Database["public"]["Enums"]["member_role"]
          invitation_status?: Database["public"]["Enums"]["invite_status"]
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          email?: string
          role?: Database["public"]["Enums"]["member_role"]
          invitation_status?: Database["public"]["Enums"]["invite_status"]
          invited_at?: string
          accepted_at?: string | null
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
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          member_names: string[]
          team_name: string | null
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          member_names?: string[]
          team_name?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          member_names?: string[]
          team_name?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
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
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          platform: Database["public"]["Enums"]["platform_type"]
          status: Database["public"]["Enums"]["link_status"]
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          status?: Database["public"]["Enums"]["link_status"]
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          status?: Database["public"]["Enums"]["link_status"]
          title?: string | null
          updated_at?: string
          url?: string
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
    }
    Views: {
      [_ in never]: never
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
