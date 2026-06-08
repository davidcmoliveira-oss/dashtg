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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_dispatches: {
        Row: {
          attempts: number
          customer_name: string | null
          customer_phone: string | null
          dispatched_at: string
          error_message: string | null
          id: string
          is_test: boolean
          matched_category: string | null
          matched_product: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          rule_id: string
          success: boolean
          tiny_order_id: number | null
        }
        Insert: {
          attempts?: number
          customer_name?: string | null
          customer_phone?: string | null
          dispatched_at?: string
          error_message?: string | null
          id?: string
          is_test?: boolean
          matched_category?: string | null
          matched_product?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          rule_id: string
          success?: boolean
          tiny_order_id?: number | null
        }
        Update: {
          attempts?: number
          customer_name?: string | null
          customer_phone?: string | null
          dispatched_at?: string
          error_message?: string | null
          id?: string
          is_test?: boolean
          matched_category?: string | null
          matched_product?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          rule_id?: string
          success?: boolean
          tiny_order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_dispatches_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          allow_resend_after_days: number | null
          categories: string[]
          created_at: string
          description: string | null
          exclude_consumidor_final: boolean
          flow_id: string | null
          headers: Json
          http_method: string
          id: string
          is_active: boolean
          match_mode: string
          name: string
          priority: number
          product_priority: boolean
          product_skus: string[]
          require_full_customer: boolean
          require_phone: boolean
          updated_at: string
          webhook_url: string
        }
        Insert: {
          allow_resend_after_days?: number | null
          categories?: string[]
          created_at?: string
          description?: string | null
          exclude_consumidor_final?: boolean
          flow_id?: string | null
          headers?: Json
          http_method?: string
          id?: string
          is_active?: boolean
          match_mode?: string
          name: string
          priority?: number
          product_priority?: boolean
          product_skus?: string[]
          require_full_customer?: boolean
          require_phone?: boolean
          updated_at?: string
          webhook_url: string
        }
        Update: {
          allow_resend_after_days?: number | null
          categories?: string[]
          created_at?: string
          description?: string | null
          exclude_consumidor_final?: boolean
          flow_id?: string | null
          headers?: Json
          http_method?: string
          id?: string
          is_active?: boolean
          match_mode?: string
          name?: string
          priority?: number
          product_priority?: boolean
          product_skus?: string[]
          require_full_customer?: boolean
          require_phone?: boolean
          updated_at?: string
          webhook_url?: string
        }
        Relationships: []
      }
      tiny_customers_cache: {
        Row: {
          celular: string | null
          created_at: string
          customer_id: string
          fone: string | null
          nome: string | null
          sem_telefone: boolean
          source: string | null
          telefone_normalizado: string | null
          updated_at: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          customer_id: string
          fone?: string | null
          nome?: string | null
          sem_telefone?: boolean
          source?: string | null
          telefone_normalizado?: string | null
          updated_at?: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          customer_id?: string
          fone?: string | null
          nome?: string | null
          sem_telefone?: boolean
          source?: string | null
          telefone_normalizado?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tiny_order_details_cache: {
        Row: {
          desconto: number | null
          endereco_entrega: Json | null
          fetched_at: string
          forma_pagamento: string | null
          frete: number | null
          hora: string | null
          id: string
          items: Json | null
          numero_ecommerce: string | null
          obs: string | null
          raw_json: Json | null
          tiny_order_id: number
          total_produtos: number | null
        }
        Insert: {
          desconto?: number | null
          endereco_entrega?: Json | null
          fetched_at?: string
          forma_pagamento?: string | null
          frete?: number | null
          hora?: string | null
          id?: string
          items?: Json | null
          numero_ecommerce?: string | null
          obs?: string | null
          raw_json?: Json | null
          tiny_order_id: number
          total_produtos?: number | null
        }
        Update: {
          desconto?: number | null
          endereco_entrega?: Json | null
          fetched_at?: string
          forma_pagamento?: string | null
          frete?: number | null
          hora?: string | null
          id?: string
          items?: Json | null
          numero_ecommerce?: string | null
          obs?: string | null
          raw_json?: Json | null
          tiny_order_id?: number
          total_produtos?: number | null
        }
        Relationships: []
      }
      tiny_orders_cache: {
        Row: {
          codigo_rastreamento: string | null
          data_pedido: string | null
          fetched_at: string
          id: string
          nome: string | null
          numero: number | null
          numero_ecommerce: string | null
          raw_json: Json | null
          situacao: string | null
          tiny_order_id: number
          valor: number | null
        }
        Insert: {
          codigo_rastreamento?: string | null
          data_pedido?: string | null
          fetched_at?: string
          id?: string
          nome?: string | null
          numero?: number | null
          numero_ecommerce?: string | null
          raw_json?: Json | null
          situacao?: string | null
          tiny_order_id: number
          valor?: number | null
        }
        Update: {
          codigo_rastreamento?: string | null
          data_pedido?: string | null
          fetched_at?: string
          id?: string
          nome?: string | null
          numero?: number | null
          numero_ecommerce?: string | null
          raw_json?: Json | null
          situacao?: string | null
          tiny_order_id?: number
          valor?: number | null
        }
        Relationships: []
      }
      tiny_products_cache: {
        Row: {
          categoria: string | null
          fetched_at: string
          id: string
          marca: string | null
          nome: string | null
          preco: number | null
          raw_json: Json | null
          sku: string
          tiny_product_id: number | null
          unidade: string | null
        }
        Insert: {
          categoria?: string | null
          fetched_at?: string
          id?: string
          marca?: string | null
          nome?: string | null
          preco?: number | null
          raw_json?: Json | null
          sku: string
          tiny_product_id?: number | null
          unidade?: string | null
        }
        Update: {
          categoria?: string | null
          fetched_at?: string
          id?: string
          marca?: string | null
          nome?: string | null
          preco?: number | null
          raw_json?: Json | null
          sku?: string
          tiny_product_id?: number | null
          unidade?: string | null
        }
        Relationships: []
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
    Enums: {},
  },
} as const
