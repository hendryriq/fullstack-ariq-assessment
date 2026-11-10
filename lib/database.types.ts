
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"entity_id": string,"entity_type": string,"event_type": string,"id": number,"metadata": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"entity_id": string,"entity_type": string,"event_type": string,"id"?: never,"metadata"?: Json | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"event_type"?: string,"id"?: never,"metadata"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "capacity": number,"created_at": string,"description": string | null,"id": string,"title": string,"tutor_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity": number,"created_at"?: string,"description"?: string | null,"id"?: string,"title": string,"tutor_id": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number,"created_at"?: string,"description"?: string | null,"id"?: string,"title"?: string,"tutor_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "classes_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "activated_at": string | null,"class_id": string,"created_at": string,"id": string,"status": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"class_id": string,"created_at"?: string,"id"?: string,"status"?: string,"student_id": string
                  }
                  Update: {
                    "activated_at"?: string | null,"class_id"?: string,"created_at"?: string,"id"?: string,"status"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "enrollments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "amount": number,"created_at": string,"enrollment_id": string,"hours": number,"id": string,"paid_at": string | null,"paid_by": string | null,"rate_snapshot": number,"reference_note": string | null,"status": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"enrollment_id": string,"hours": number,"id"?: string,"paid_at"?: string | null,"paid_by"?: string | null,"rate_snapshot": number,"reference_note"?: string | null,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"enrollment_id"?: string,"hours"?: number,"id"?: string,"paid_at"?: string | null,"paid_by"?: string | null,"rate_snapshot"?: number,"reference_note"?: string | null,"status"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "student_hours_balance"
      referencedColumns: ["enrollment_id"]
    },{
      foreignKeyName: "invoices_paid_by_fkey"
      columns: ["paid_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"lessons": {
                  Row: {
                    "cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"class_id": string,"created_at": string,"duration_minutes": number | null,"ends_at": string,"id": string,"starts_at": string,"status": string,"tutor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"class_id": string,"created_at"?: string,"duration_minutes"?: never,"ends_at": string,"id"?: string,"starts_at": string,"status"?: string,"tutor_id": string
                  }
                  Update: {
                    "cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"class_id"?: string,"created_at"?: string,"duration_minutes"?: never,"ends_at"?: string,"id"?: string,"starts_at"?: string,"status"?: string,"tutor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lessons_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "lessons_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lessons_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"logbook_entries": {
                  Row: {
                    "activities": string,"created_at": string,"future_recommendation": string,"id": string,"lesson_id": string,"logbook_id": string,"topic": string,"tutor_observation": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activities": string,"created_at"?: string,"future_recommendation": string,"id"?: string,"lesson_id": string,"logbook_id": string,"topic": string,"tutor_observation": string,"updated_at"?: string
                  }
                  Update: {
                    "activities"?: string,"created_at"?: string,"future_recommendation"?: string,"id"?: string,"lesson_id"?: string,"logbook_id"?: string,"topic"?: string,"tutor_observation"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "logbook_entries_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: true
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "logbook_entries_logbook_id_fkey"
      columns: ["logbook_id"]
isOneToOne: false
      referencedRelation: "logbooks"
      referencedColumns: ["id"]
    }
                  ]
                },"logbooks": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"class_id": string,"created_at": string,"id": string,"month": string,"return_note": string | null,"returned_at": string | null,"returned_by": string | null,"status": string,"submitted_at": string | null,"submitted_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"class_id": string,"created_at"?: string,"id"?: string,"month": string,"return_note"?: string | null,"returned_at"?: string | null,"returned_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"class_id"?: string,"created_at"?: string,"id"?: string,"month"?: string,"return_note"?: string | null,"returned_at"?: string | null,"returned_by"?: string | null,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "logbooks_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "logbooks_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "logbooks_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "logbooks_returned_by_fkey"
      columns: ["returned_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "logbooks_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"student_rates": {
                  Row: {
                    "class_id": string,"created_at": string,"rate_per_hour": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"rate_per_hour": number
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"rate_per_hour"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_rates_class_id_fkey"
      columns: ["class_id"]
isOneToOne: true
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "student_rates_class_id_fkey"
      columns: ["class_id"]
isOneToOne: true
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"tutor_earnings": {
                  Row: {
                    "amount": number,"class_id": string,"created_at": string,"duration_minutes": number,"id": string,"lesson_id": string,"logbook_id": string,"rate_per_hour": number,"tutor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"class_id": string,"created_at"?: string,"duration_minutes": number,"id"?: string,"lesson_id": string,"logbook_id": string,"rate_per_hour": number,"tutor_id": string
                  }
                  Update: {
                    "amount"?: number,"class_id"?: string,"created_at"?: string,"duration_minutes"?: number,"id"?: string,"lesson_id"?: string,"logbook_id"?: string,"rate_per_hour"?: number,"tutor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tutor_earnings_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "tutor_earnings_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutor_earnings_lesson_id_fkey"
      columns: ["lesson_id"]
isOneToOne: true
      referencedRelation: "lessons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutor_earnings_logbook_id_fkey"
      columns: ["logbook_id"]
isOneToOne: false
      referencedRelation: "logbooks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tutor_earnings_tutor_id_fkey"
      columns: ["tutor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"tutor_rates": {
                  Row: {
                    "class_id": string,"created_at": string,"rate_per_hour": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"rate_per_hour": number
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"rate_per_hour"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tutor_rates_class_id_fkey"
      columns: ["class_id"]
isOneToOne: true
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "tutor_rates_class_id_fkey"
      columns: ["class_id"]
isOneToOne: true
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string,"id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name": string,"id": string,"role": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "class_margin": {
                  Row: {
                    "class_id": string,"earned_by_tutors": number | null,"margin": number | null,"paid_by_students": number | null,"title": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"student_hours_balance": {
                  Row: {
                    "class_id": string,"consumed_minutes": number | null,"enrollment_id": string,"needs_top_up": boolean | null,"purchased_minutes": number | null,"raw_balance_minutes": number | null,"remaining_minutes": number | null,"student_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "enrollments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "class_margin"
      referencedColumns: ["class_id"]
    },{
      foreignKeyName: "enrollments_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "approve_logbook":
{ Args: { "p_expected_total": number,"p_logbook_id": string }; Returns: number
                           },
"assert_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"assert_logbook_month_open":
{ Args: { "p_class_id": string,"p_starts_at": string }; Returns: undefined
                           },
"assert_tutor_account":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"cancel_invoice":
{ Args: { "p_invoice_id": string,"p_reason"?: string }; Returns: undefined
                           },
"cancel_lesson":
{ Args: { "p_lesson_id": string,"p_reason": string }; Returns: undefined
                           },
"compute_logbook_earnings":
{ Args: { "p_logbook_id": string }; Returns: {
              "amount": number,"duration_minutes": number,"ends_at": string,"lesson_id": string,"rate_per_hour": number,"starts_at": string,"tutor_id": string
            }[]
                           },
"create_class":
{ Args: { "p_capacity": number,"p_description": string,"p_student_rate": number,"p_title": string,"p_tutor_id": string,"p_tutor_rate": number }; Returns: string
                           },
"current_user_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"end_enrollment":
{ Args: { "p_enrollment_id": string,"p_reason": string }; Returns: undefined
                           },
"enroll_student":
{ Args: { "p_class_id": string,"p_hours": number }; Returns: string
                           },
"get_class_catalog":
{ Args: Record<PropertyKey, never>; Returns: {
              "capacity": number,"class_id": string,"description": string,"my_enrollment_id": string,"my_enrollment_status": string,"seats_left": number,"student_rate": number,"title": string,"tutor_name": string
            }[]
                           },
"get_class_roster":
{ Args: { "p_class_id": string }; Returns: {
              "full_name": string,"student_id": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_paid_student_of_class":
{ Args: { "p_class_id": string }; Returns: boolean
                           },
"is_tutor_of_class":
{ Args: { "p_class_id": string }; Returns: boolean
                           },
"mark_invoice_paid":
{ Args: { "p_invoice_id": string,"p_reference_note"?: string }; Returns: undefined
                           },
"preview_logbook_earnings":
{ Args: { "p_logbook_id": string }; Returns: {
              "amount": number,"duration_minutes": number,"ends_at": string,"lesson_id": string,"rate_per_hour": number,"starts_at": string
            }[]
                           },
"remove_logbook_entry":
{ Args: { "p_lesson_id": string }; Returns: undefined
                           },
"request_top_up":
{ Args: { "p_enrollment_id": string,"p_hours": number }; Returns: string
                           },
"return_logbook":
{ Args: { "p_logbook_id": string,"p_note": string }; Returns: undefined
                           },
"save_logbook_entry":
{ Args: { "p_activities": string,"p_future_recommendation": string,"p_lesson_id": string,"p_topic": string,"p_tutor_observation": string }; Returns: string
                           },
"schedule_lesson":
{ Args: { "p_class_id": string,"p_ends_at": string,"p_starts_at": string }; Returns: string
                           },
"submit_logbook":
{ Args: { "p_logbook_id": string }; Returns: undefined
                           },
"update_class":
{ Args: { "p_capacity": number,"p_class_id": string,"p_description": string,"p_student_rate": number,"p_title": string,"p_tutor_id": string,"p_tutor_rate": number }; Returns: undefined
                           },
"void_invoice":
{ Args: { "p_invoice_id": string,"p_reason": string }; Returns: undefined
                           },
"write_audit_log":
{ Args: { "p_entity_id": string,"p_entity_type": string,"p_event_type": string,"p_metadata"?: Json }; Returns: undefined
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
