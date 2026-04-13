export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      formula_ingredients: {
        Row: {
          formula_version_id: string
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
          sort_order: number
        }
        Insert: {
          formula_version_id: string
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity: number
          sort_order?: number
        }
        Update: {
          formula_version_id?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_ingredients_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_step_fields: {
        Row: {
          field_type: string
          formula_step_id: string
          id: string
          is_required: boolean
          label: string
          options: Json | null
          sort_order: number
          template_id: string | null
        }
        Insert: {
          field_type: string
          formula_step_id: string
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          sort_order?: number
          template_id?: string | null
        }
        Update: {
          field_type?: string
          formula_step_id?: string
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          sort_order?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formula_step_fields_formula_step_id_fkey"
            columns: ["formula_step_id"]
            isOneToOne: false
            referencedRelation: "formula_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_step_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "step_field_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_steps: {
        Row: {
          formula_version_id: string
          id: string
          instructions: string | null
          requires_confirmation: boolean
          requires_quantity_entry: boolean
          sort_order: number
          step_number: number
          title: string
        }
        Insert: {
          formula_version_id: string
          id?: string
          instructions?: string | null
          requires_confirmation?: boolean
          requires_quantity_entry?: boolean
          sort_order: number
          step_number: number
          title: string
        }
        Update: {
          formula_version_id?: string
          id?: string
          instructions?: string | null
          requires_confirmation?: boolean
          requires_quantity_entry?: boolean
          sort_order?: number
          step_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "formula_steps_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_versions: {
        Row: {
          base_batch_size: number
          base_batch_unit: string
          created_at: string
          created_by: string | null
          formula_id: string
          id: string
          notes: string | null
          version_number: number
        }
        Insert: {
          base_batch_size: number
          base_batch_unit: string
          created_at?: string
          created_by?: string | null
          formula_id: string
          id?: string
          notes?: string | null
          version_number: number
        }
        Update: {
          base_batch_size?: number
          base_batch_unit?: string
          created_at?: string
          created_by?: string | null
          formula_id?: string
          id?: string
          notes?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_versions_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas: {
        Row: {
          created_at: string
          current_version_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_formulas_current_version"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          cost_per_unit: number | null
          created_at: string
          density: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          sku: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string
          density?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          sku?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string
          density?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          sku?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_queue: {
        Row: {
          assigned_to: string | null
          batch_size: number
          batch_unit: string
          created_at: string
          due_date: string | null
          external_order_id: string | null
          formula_id: string
          formula_version_id: string
          id: string
          notes: string | null
          priority: number
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          batch_size: number
          batch_unit: string
          created_at?: string
          due_date?: string | null
          external_order_id?: string | null
          formula_id: string
          formula_version_id: string
          id?: string
          notes?: string | null
          priority?: number
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          batch_size?: number
          batch_unit?: string
          created_at?: string
          due_date?: string | null
          external_order_id?: string | null
          formula_id?: string
          formula_version_id?: string
          id?: string
          notes?: string | null
          priority?: number
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_queue_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_queue_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      production_runs: {
        Row: {
          base_batch_size: number
          base_batch_unit: string
          batch_size: number
          completed_at: string | null
          completed_by: string | null
          current_step_index: number
          formula_id: string | null
          formula_name: string
          formula_version_id: string | null
          id: string
          notes: string | null
          product_name: string
          queue_item_id: string | null
          scale_factor: number
          started_at: string
          started_by: string
          status: string
          version_number: number
        }
        Insert: {
          base_batch_size: number
          base_batch_unit: string
          batch_size: number
          completed_at?: string | null
          completed_by?: string | null
          current_step_index?: number
          formula_id?: string | null
          formula_name: string
          formula_version_id?: string | null
          id?: string
          notes?: string | null
          product_name: string
          queue_item_id?: string | null
          scale_factor: number
          started_at?: string
          started_by: string
          status?: string
          version_number: number
        }
        Update: {
          base_batch_size?: number
          base_batch_unit?: string
          batch_size?: number
          completed_at?: string | null
          completed_by?: string | null
          current_step_index?: number
          formula_id?: string | null
          formula_name?: string
          formula_version_id?: string | null
          id?: string
          notes?: string | null
          product_name?: string
          queue_item_id?: string | null
          scale_factor?: number
          started_at?: string
          started_by?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_formula_version_id_fkey"
            columns: ["formula_version_id"]
            isOneToOne: false
            referencedRelation: "formula_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "production_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      run_materials: {
        Row: {
          actual_quantity: number | null
          base_quantity: number
          id: string
          ingredient_id: string | null
          ingredient_name: string
          run_id: string
          scaled_quantity: number
          sku: string | null
          sort_order: number
          unit: string
        }
        Insert: {
          actual_quantity?: number | null
          base_quantity: number
          id?: string
          ingredient_id?: string | null
          ingredient_name: string
          run_id: string
          scaled_quantity: number
          sku?: string | null
          sort_order?: number
          unit: string
        }
        Update: {
          actual_quantity?: number | null
          base_quantity?: number
          id?: string
          ingredient_id?: string | null
          ingredient_name?: string
          run_id?: string
          scaled_quantity?: number
          sku?: string | null
          sort_order?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_materials_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_materials_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_step_inputs: {
        Row: {
          field_type: string
          id: string
          is_required: boolean
          label: string
          options: Json | null
          run_step_id: string
          sort_order: number
          value: string | null
        }
        Insert: {
          field_type: string
          id?: string
          is_required?: boolean
          label: string
          options?: Json | null
          run_step_id: string
          sort_order?: number
          value?: string | null
        }
        Update: {
          field_type?: string
          id?: string
          is_required?: boolean
          label?: string
          options?: Json | null
          run_step_id?: string
          sort_order?: number
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_step_inputs_run_step_id_fkey"
            columns: ["run_step_id"]
            isOneToOne: false
            referencedRelation: "run_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      run_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          id: string
          instructions: string | null
          requires_confirmation: boolean
          requires_quantity_entry: boolean
          run_id: string
          sort_order: number
          started_at: string | null
          status: string
          step_number: number
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          instructions?: string | null
          requires_confirmation: boolean
          requires_quantity_entry?: boolean
          run_id: string
          sort_order: number
          started_at?: string | null
          status?: string
          step_number: number
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          instructions?: string | null
          requires_confirmation?: boolean
          requires_quantity_entry?: boolean
          run_id?: string
          sort_order?: number
          started_at?: string | null
          status?: string
          step_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "production_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      step_field_templates: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          name: string
          options: Json | null
        }
        Insert: {
          created_at?: string
          field_type: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          name: string
          options?: Json | null
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          name?: string
          options?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_batch: {
        Args: { p_batch_size: number; p_formula_version_id: string }
        Returns: Json
      }
      complete_run_step: {
        Args: {
          p_inputs?: Json
          p_run_id: string
          p_step_id: string
          p_user_id: string
        }
        Returns: Json
      }
      get_user_role: { Args: never; Returns: string }
      start_production_run: {
        Args: { p_queue_item_id: string; p_user_id: string }
        Returns: string
      }
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
