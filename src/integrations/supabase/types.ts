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
      _ingest_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
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
      crmtg_customer_state: {
        Row: {
          customer_id: string
          entrada_funnel_em: string | null
          fase: string | null
          funnel_atual_id: string | null
          ultima_avaliacao_em: string | null
          ultimo_pedido_em: string | null
          updated_at: string
        }
        Insert: {
          customer_id: string
          entrada_funnel_em?: string | null
          fase?: string | null
          funnel_atual_id?: string | null
          ultima_avaliacao_em?: string | null
          ultimo_pedido_em?: string | null
          updated_at?: string
        }
        Update: {
          customer_id?: string
          entrada_funnel_em?: string | null
          fase?: string | null
          funnel_atual_id?: string | null
          ultima_avaliacao_em?: string | null
          ultimo_pedido_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crmtg_customer_state_funnel_atual_id_fkey"
            columns: ["funnel_atual_id"]
            isOneToOne: false
            referencedRelation: "crmtg_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      crmtg_daily_queue: {
        Row: {
          botconversa_response: Json | null
          created_at: string
          customer_id: string
          customer_name: string | null
          enviado_em: string | null
          flow_id: string | null
          funnel_categoria: string | null
          funnel_id: string | null
          funnel_nome: string | null
          horario_previsto: string
          id: string
          mensagem_versao: number
          motivo_cancelamento: string | null
          run_date: string
          status: string
          telefone_normalizado: string | null
          texto_render: string | null
          touch_id: string | null
          touch_ordem: number | null
        }
        Insert: {
          botconversa_response?: Json | null
          created_at?: string
          customer_id: string
          customer_name?: string | null
          enviado_em?: string | null
          flow_id?: string | null
          funnel_categoria?: string | null
          funnel_id?: string | null
          funnel_nome?: string | null
          horario_previsto: string
          id?: string
          mensagem_versao?: number
          motivo_cancelamento?: string | null
          run_date: string
          status?: string
          telefone_normalizado?: string | null
          texto_render?: string | null
          touch_id?: string | null
          touch_ordem?: number | null
        }
        Update: {
          botconversa_response?: Json | null
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          enviado_em?: string | null
          flow_id?: string | null
          funnel_categoria?: string | null
          funnel_id?: string | null
          funnel_nome?: string | null
          horario_previsto?: string
          id?: string
          mensagem_versao?: number
          motivo_cancelamento?: string | null
          run_date?: string
          status?: string
          telefone_normalizado?: string | null
          texto_render?: string | null
          touch_id?: string | null
          touch_ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crmtg_daily_queue_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "crmtg_funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crmtg_daily_queue_touch_id_fkey"
            columns: ["touch_id"]
            isOneToOne: false
            referencedRelation: "crmtg_funnel_touches"
            referencedColumns: ["id"]
          },
        ]
      }
      crmtg_daily_run_log: {
        Row: {
          alertas: Json
          elegiveis: number
          fila_criada: number
          finalizado_em: string | null
          iniciado_em: string
          run_date: string
          status: string
        }
        Insert: {
          alertas?: Json
          elegiveis?: number
          fila_criada?: number
          finalizado_em?: string | null
          iniciado_em?: string
          run_date: string
          status?: string
        }
        Update: {
          alertas?: Json
          elegiveis?: number
          fila_criada?: number
          finalizado_em?: string | null
          iniciado_em?: string
          run_date?: string
          status?: string
        }
        Relationships: []
      }
      crmtg_funnel_touches: {
        Row: {
          botconversa_flow_id: string | null
          created_at: string
          dia_offset: number
          flow_id_v1: string | null
          flow_id_v2: string | null
          flow_id_v3: string | null
          funnel_id: string
          id: string
          mensagem_v1: string
          mensagem_v2: string
          mensagem_v3: string
          ordem: number
          updated_at: string
        }
        Insert: {
          botconversa_flow_id?: string | null
          created_at?: string
          dia_offset: number
          flow_id_v1?: string | null
          flow_id_v2?: string | null
          flow_id_v3?: string | null
          funnel_id: string
          id?: string
          mensagem_v1?: string
          mensagem_v2?: string
          mensagem_v3?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          botconversa_flow_id?: string | null
          created_at?: string
          dia_offset?: number
          flow_id_v1?: string | null
          flow_id_v2?: string | null
          flow_id_v3?: string | null
          funnel_id?: string
          id?: string
          mensagem_v1?: string
          mensagem_v2?: string
          mensagem_v3?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crmtg_funnel_touches_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "crmtg_funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      crmtg_funnels: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          prioridade: number
          produtos_gatilho: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          prioridade?: number
          produtos_gatilho?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          prioridade?: number
          produtos_gatilho?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      crmtg_history: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string | null
          enviado_em: string | null
          flow_id: string | null
          funnel_categoria: string | null
          funnel_id: string | null
          funnel_nome: string | null
          id: string
          mensagem_versao: number | null
          motivo_cancelamento: string | null
          queue_id: string | null
          run_date: string
          status: string
          telefone_normalizado: string | null
          texto_enviado: string | null
          touch_ordem: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name?: string | null
          enviado_em?: string | null
          flow_id?: string | null
          funnel_categoria?: string | null
          funnel_id?: string | null
          funnel_nome?: string | null
          id?: string
          mensagem_versao?: number | null
          motivo_cancelamento?: string | null
          queue_id?: string | null
          run_date: string
          status: string
          telefone_normalizado?: string | null
          texto_enviado?: string | null
          touch_ordem?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          enviado_em?: string | null
          flow_id?: string | null
          funnel_categoria?: string | null
          funnel_id?: string | null
          funnel_nome?: string | null
          id?: string
          mensagem_versao?: number | null
          motivo_cancelamento?: string | null
          queue_id?: string | null
          run_date?: string
          status?: string
          telefone_normalizado?: string | null
          texto_enviado?: string | null
          touch_ordem?: number | null
        }
        Relationships: []
      }
      crmtg_settings: {
        Row: {
          horario_fim: string
          horario_inicio: string
          id: boolean
          intervalo_max_lote: number
          intervalo_max_msg: number
          intervalo_min_lote: number
          intervalo_min_msg: number
          lote_tamanho: number
          sistema_pausado: boolean
          ultima_execucao_diaria: string | null
          ultimo_alerta_tiny: string | null
          updated_at: string
        }
        Insert: {
          horario_fim?: string
          horario_inicio?: string
          id?: boolean
          intervalo_max_lote?: number
          intervalo_max_msg?: number
          intervalo_min_lote?: number
          intervalo_min_msg?: number
          lote_tamanho?: number
          sistema_pausado?: boolean
          ultima_execucao_diaria?: string | null
          ultimo_alerta_tiny?: string | null
          updated_at?: string
        }
        Update: {
          horario_fim?: string
          horario_inicio?: string
          id?: boolean
          intervalo_max_lote?: number
          intervalo_max_msg?: number
          intervalo_min_lote?: number
          intervalo_min_msg?: number
          lote_tamanho?: number
          sistema_pausado?: boolean
          ultima_execucao_diaria?: string | null
          ultimo_alerta_tiny?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tiny_customers_cache: {
        Row: {
          celular: string | null
          created_at: string
          customer_id: string
          fone: string | null
          match_score: number | null
          nome: string | null
          nome_normalizado: string | null
          nome_original: string | null
          sem_telefone: boolean
          source: string | null
          synced_at: string | null
          telefone_normalizado: string | null
          tiny_contact_id: string | null
          updated_at: string
        }
        Insert: {
          celular?: string | null
          created_at?: string
          customer_id: string
          fone?: string | null
          match_score?: number | null
          nome?: string | null
          nome_normalizado?: string | null
          nome_original?: string | null
          sem_telefone?: boolean
          source?: string | null
          synced_at?: string | null
          telefone_normalizado?: string | null
          tiny_contact_id?: string | null
          updated_at?: string
        }
        Update: {
          celular?: string | null
          created_at?: string
          customer_id?: string
          fone?: string | null
          match_score?: number | null
          nome?: string | null
          nome_normalizado?: string | null
          nome_original?: string | null
          sem_telefone?: boolean
          source?: string | null
          synced_at?: string | null
          telefone_normalizado?: string | null
          tiny_contact_id?: string | null
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
