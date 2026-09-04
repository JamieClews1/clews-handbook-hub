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
      accounting_sync_log: {
        Row: {
          created_at: string
          direction: string
          entity_id: string | null
          entity_type: string
          id: string
          invoice_id: string | null
          last_attempt_at: string
          message: string | null
          payload: Json | null
          provider: string
          retry_count: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          direction?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          invoice_id?: string | null
          last_attempt_at?: string
          message?: string | null
          payload?: Json | null
          provider?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          direction?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          invoice_id?: string | null
          last_attempt_at?: string
          message?: string | null
          payload?: Json | null
          provider?: string
          retry_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sync_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_question_log: {
        Row: {
          created_at: string
          id: string
          question: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: []
      }
      biffa_fuel_surcharge_settings: {
        Row: {
          created_at: string
          haulier_filter: string
          id: string
          included_customers: string[]
          percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          haulier_filter?: string
          id?: string
          included_customers?: string[]
          percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          haulier_filter?: string
          id?: string
          included_customers?: string[]
          percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          assigned_driver: string | null
          booking_date: string
          booking_reference: string
          collection_date: string | null
          collection_time_slot: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          container_type: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          internal_notes: string | null
          quantity: number | null
          site_id: string | null
          source: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          vehicle_reg: string | null
          waste_type: string | null
        }
        Insert: {
          assigned_driver?: string | null
          booking_date?: string
          booking_reference: string
          collection_date?: string | null
          collection_time_slot?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          container_type?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          internal_notes?: string | null
          quantity?: number | null
          site_id?: string | null
          source?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vehicle_reg?: string | null
          waste_type?: string | null
        }
        Update: {
          assigned_driver?: string | null
          booking_date?: string
          booking_reference?: string
          collection_date?: string | null
          collection_time_slot?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          container_type?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          internal_notes?: string | null
          quantity?: number | null
          site_id?: string | null
          source?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          vehicle_reg?: string | null
          waste_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          contact_type: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_type: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_type?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type_id: string | null
          document_type_name: string
          expiry_date: string
          file_name: string
          file_path: string
          id: string
          issue_date: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type_id?: string | null
          document_type_name: string
          expiry_date: string
          file_name: string
          file_path: string
          id?: string
          issue_date: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type_id?: string | null
          document_type_name?: string
          expiry_date?: string
          file_name?: string
          file_path?: string
          id?: string
          issue_date?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profile: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_sort_code: string | null
          bank_swift_bic: string | null
          company_name: string
          company_registration_number: string | null
          created_at: string
          credit_terms: string | null
          date_of_incorporation: string | null
          dwt_api_base_url: string | null
          dwt_api_code: string | null
          dwt_client_id: string | null
          dwt_client_secret_updated_at: string | null
          dwt_environment: string | null
          email: string | null
          employers_liability_insurance_expiry: string | null
          employers_liability_insurance_provider: string | null
          environment_agency_reference: string | null
          environmental_policy: boolean | null
          health_safety_policy: boolean | null
          id: string
          iso_14001_certified: boolean | null
          iso_9001_certified: boolean | null
          operational_address: string | null
          public_liability_insurance_expiry: string | null
          public_liability_insurance_provider: string | null
          registered_address: string | null
          sic_code: string | null
          telephone: string | null
          trading_name: string | null
          updated_at: string
          vat_number: string | null
          waste_carriers_licence_expiry: string | null
          waste_carriers_licence_number: string | null
          website: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          bank_swift_bic?: string | null
          company_name?: string
          company_registration_number?: string | null
          created_at?: string
          credit_terms?: string | null
          date_of_incorporation?: string | null
          dwt_api_base_url?: string | null
          dwt_api_code?: string | null
          dwt_client_id?: string | null
          dwt_client_secret_updated_at?: string | null
          dwt_environment?: string | null
          email?: string | null
          employers_liability_insurance_expiry?: string | null
          employers_liability_insurance_provider?: string | null
          environment_agency_reference?: string | null
          environmental_policy?: boolean | null
          health_safety_policy?: boolean | null
          id?: string
          iso_14001_certified?: boolean | null
          iso_9001_certified?: boolean | null
          operational_address?: string | null
          public_liability_insurance_expiry?: string | null
          public_liability_insurance_provider?: string | null
          registered_address?: string | null
          sic_code?: string | null
          telephone?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          waste_carriers_licence_expiry?: string | null
          waste_carriers_licence_number?: string | null
          website?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_sort_code?: string | null
          bank_swift_bic?: string | null
          company_name?: string
          company_registration_number?: string | null
          created_at?: string
          credit_terms?: string | null
          date_of_incorporation?: string | null
          dwt_api_base_url?: string | null
          dwt_api_code?: string | null
          dwt_client_id?: string | null
          dwt_client_secret_updated_at?: string | null
          dwt_environment?: string | null
          email?: string | null
          employers_liability_insurance_expiry?: string | null
          employers_liability_insurance_provider?: string | null
          environment_agency_reference?: string | null
          environmental_policy?: boolean | null
          health_safety_policy?: boolean | null
          id?: string
          iso_14001_certified?: boolean | null
          iso_9001_certified?: boolean | null
          operational_address?: string | null
          public_liability_insurance_expiry?: string | null
          public_liability_insurance_provider?: string | null
          registered_address?: string | null
          sic_code?: string | null
          telephone?: string | null
          trading_name?: string | null
          updated_at?: string
          vat_number?: string | null
          waste_carriers_licence_expiry?: string | null
          waste_carriers_licence_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      container_load_contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          is_default: boolean
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          is_default?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          is_default?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      container_load_email_settings: {
        Row: {
          cc_email: string
          default_body: string
          default_subject: string
          id: string
          reply_to_email: string
          signature: string
          updated_at: string
        }
        Insert: {
          cc_email?: string
          default_body?: string
          default_subject?: string
          id?: string
          reply_to_email?: string
          signature?: string
          updated_at?: string
        }
        Update: {
          cc_email?: string
          default_body?: string
          default_subject?: string
          id?: string
          reply_to_email?: string
          signature?: string
          updated_at?: string
        }
        Relationships: []
      }
      container_loads: {
        Row: {
          annex7: Json
          annex7_upload: Json | null
          bale_count: number
          basel_code: string | null
          booking_reference: string | null
          container_number: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          destination_country: string | null
          destination_facility: string | null
          ewc_code: string | null
          export_date: string | null
          id: string
          load_name: string | null
          material: string | null
          notes: string | null
          operator_name: string | null
          packing: Json
          packing_upload: Json | null
          paperwork_mode: string
          photos: Json
          reference: string | null
          seal_number: string | null
          sent_at: string | null
          status: string
          supplier_email: string | null
          total_weight_t: number | null
          updated_at: string
          vessel: string | null
          wb_job_date: string | null
          wb_location: string | null
          wb_ticket_number: string | null
        }
        Insert: {
          annex7?: Json
          annex7_upload?: Json | null
          bale_count?: number
          basel_code?: string | null
          booking_reference?: string | null
          container_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          destination_country?: string | null
          destination_facility?: string | null
          ewc_code?: string | null
          export_date?: string | null
          id?: string
          load_name?: string | null
          material?: string | null
          notes?: string | null
          operator_name?: string | null
          packing?: Json
          packing_upload?: Json | null
          paperwork_mode?: string
          photos?: Json
          reference?: string | null
          seal_number?: string | null
          sent_at?: string | null
          status?: string
          supplier_email?: string | null
          total_weight_t?: number | null
          updated_at?: string
          vessel?: string | null
          wb_job_date?: string | null
          wb_location?: string | null
          wb_ticket_number?: string | null
        }
        Update: {
          annex7?: Json
          annex7_upload?: Json | null
          bale_count?: number
          basel_code?: string | null
          booking_reference?: string | null
          container_number?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          destination_country?: string | null
          destination_facility?: string | null
          ewc_code?: string | null
          export_date?: string | null
          id?: string
          load_name?: string | null
          material?: string | null
          notes?: string | null
          operator_name?: string | null
          packing?: Json
          packing_upload?: Json | null
          paperwork_mode?: string
          photos?: Json
          reference?: string | null
          seal_number?: string | null
          sent_at?: string | null
          status?: string
          supplier_email?: string | null
          total_weight_t?: number | null
          updated_at?: string
          vessel?: string | null
          wb_job_date?: string | null
          wb_location?: string | null
          wb_ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "container_loads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contamination_activity_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          query_id: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          query_id: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          query_id?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contamination_activity_log_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "contamination_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      contamination_charge_items: {
        Row: {
          created_at: string
          display_order: number
          ewc_code: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          unit_charge: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          unit_charge?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          unit_charge?: number
          updated_at?: string
        }
        Relationships: []
      }
      contamination_charge_matrix: {
        Row: {
          charge_value: number
          contamination_type: string
          created_at: string
          description_template: string | null
          display_order: number
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          charge_value?: number
          contamination_type: string
          created_at?: string
          description_template?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          charge_value?: number
          contamination_type?: string
          created_at?: string
          description_template?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      contamination_points: {
        Row: {
          awarded_at: string
          created_at: string
          driver_id: string | null
          id: string
          points: number
          query_id: string | null
          reason: string | null
          reporter_name: string
        }
        Insert: {
          awarded_at?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          points?: number
          query_id?: string | null
          reason?: string | null
          reporter_name: string
        }
        Update: {
          awarded_at?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          points?: number
          query_id?: string | null
          reason?: string | null
          reporter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "contamination_points_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "contamination_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      contamination_pricing_tiers: {
        Row: {
          created_at: string
          display_order: number
          flat_fee: number
          id: string
          min_charge_tonnes: number | null
          mins_max: number | null
          mins_min: number | null
          notes: string | null
          pct_max: number | null
          pct_min: number | null
          per_tonne_fee: number | null
          tier_name: string
          updated_at: string
          waste_type_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          flat_fee?: number
          id?: string
          min_charge_tonnes?: number | null
          mins_max?: number | null
          mins_min?: number | null
          notes?: string | null
          pct_max?: number | null
          pct_min?: number | null
          per_tonne_fee?: number | null
          tier_name: string
          updated_at?: string
          waste_type_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          flat_fee?: number
          id?: string
          min_charge_tonnes?: number | null
          mins_max?: number | null
          mins_min?: number | null
          notes?: string | null
          pct_max?: number | null
          pct_min?: number | null
          per_tonne_fee?: number | null
          tier_name?: string
          updated_at?: string
          waste_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contamination_pricing_tiers_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "contamination_waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      contamination_queries: {
        Row: {
          actioned_at: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          approver_name: string | null
          calculated_charge: number | null
          charge_amount: number | null
          charge_overridden: boolean
          completed_at: string | null
          container_type: string | null
          contamination_pct: number | null
          contamination_type: string | null
          created_at: string
          customer: string | null
          customer_signature: string | null
          customer_signoff_at: string | null
          customer_signoff_name: string | null
          customer_signoff_role: string | null
          data_hub_job_id: string | null
          email_sent_at: string | null
          id: string
          initial_cost: number | null
          job_date: string | null
          job_number: string
          order_number: string | null
          override_reason: string | null
          owner_id: string | null
          owner_name: string | null
          photos: string[] | null
          po_number: string | null
          points_awarded: number
          postcode: string | null
          pricing_tier_id: string | null
          query_reason: string | null
          recipient_email: string | null
          rejection_reason: string | null
          reported_items: Json | null
          reporter_driver_id: string | null
          reporter_name: string | null
          reporter_type: string | null
          resolved_at: string | null
          site: string | null
          sorting_minutes: number | null
          source_app: string
          status: string
          updated_at: string
          vehicle_reg: string | null
          waste_description: string | null
          waste_type_id: string | null
          weight_t: number | null
        }
        Insert: {
          actioned_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approver_name?: string | null
          calculated_charge?: number | null
          charge_amount?: number | null
          charge_overridden?: boolean
          completed_at?: string | null
          container_type?: string | null
          contamination_pct?: number | null
          contamination_type?: string | null
          created_at?: string
          customer?: string | null
          customer_signature?: string | null
          customer_signoff_at?: string | null
          customer_signoff_name?: string | null
          customer_signoff_role?: string | null
          data_hub_job_id?: string | null
          email_sent_at?: string | null
          id?: string
          initial_cost?: number | null
          job_date?: string | null
          job_number: string
          order_number?: string | null
          override_reason?: string | null
          owner_id?: string | null
          owner_name?: string | null
          photos?: string[] | null
          po_number?: string | null
          points_awarded?: number
          postcode?: string | null
          pricing_tier_id?: string | null
          query_reason?: string | null
          recipient_email?: string | null
          rejection_reason?: string | null
          reported_items?: Json | null
          reporter_driver_id?: string | null
          reporter_name?: string | null
          reporter_type?: string | null
          resolved_at?: string | null
          site?: string | null
          sorting_minutes?: number | null
          source_app?: string
          status?: string
          updated_at?: string
          vehicle_reg?: string | null
          waste_description?: string | null
          waste_type_id?: string | null
          weight_t?: number | null
        }
        Update: {
          actioned_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approver_name?: string | null
          calculated_charge?: number | null
          charge_amount?: number | null
          charge_overridden?: boolean
          completed_at?: string | null
          container_type?: string | null
          contamination_pct?: number | null
          contamination_type?: string | null
          created_at?: string
          customer?: string | null
          customer_signature?: string | null
          customer_signoff_at?: string | null
          customer_signoff_name?: string | null
          customer_signoff_role?: string | null
          data_hub_job_id?: string | null
          email_sent_at?: string | null
          id?: string
          initial_cost?: number | null
          job_date?: string | null
          job_number?: string
          order_number?: string | null
          override_reason?: string | null
          owner_id?: string | null
          owner_name?: string | null
          photos?: string[] | null
          po_number?: string | null
          points_awarded?: number
          postcode?: string | null
          pricing_tier_id?: string | null
          query_reason?: string | null
          recipient_email?: string | null
          rejection_reason?: string | null
          reported_items?: Json | null
          reporter_driver_id?: string | null
          reporter_name?: string | null
          reporter_type?: string | null
          resolved_at?: string | null
          site?: string | null
          sorting_minutes?: number | null
          source_app?: string
          status?: string
          updated_at?: string
          vehicle_reg?: string | null
          waste_description?: string | null
          waste_type_id?: string | null
          weight_t?: number | null
        }
        Relationships: []
      }
      contamination_settings: {
        Row: {
          created_at: string
          id: string
          points_per_report: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_per_report?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          points_per_report?: number
          updated_at?: string
        }
        Relationships: []
      }
      contamination_waste_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          typical_contamination: string | null
          updated_at: string
          zero_tolerance: boolean
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          typical_contamination?: string | null
          updated_at?: string
          zero_tolerance?: boolean
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          typical_contamination?: string | null
          updated_at?: string
          zero_tolerance?: boolean
        }
        Relationships: []
      }
      credit_account_applications: {
        Row: {
          account_number: string | null
          applicant_print_name: string | null
          applicant_signature: string | null
          applicant_signed_date: string | null
          approved: boolean | null
          approved_at: string | null
          approved_by_name: string | null
          approved_by_signature: string | null
          business_name: string | null
          company_telephone: string | null
          contact_name: string | null
          contact_position: string | null
          created_at: string
          created_by: string | null
          credit_limit_set: number | null
          credit_requested: number | null
          customer_id: string | null
          date_of_incorporation: string | null
          eori_number: string | null
          holding_company: string | null
          id: string
          invited_email: string | null
          invoice_address: string | null
          invoice_address_postcode: string | null
          invoice_email: string | null
          mobile_number: string | null
          nature_of_business: string | null
          registered_office: string | null
          registered_office_postcode: string | null
          share_token: string
          status: string
          submitted_at: string | null
          trade_references: Json | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          account_number?: string | null
          applicant_print_name?: string | null
          applicant_signature?: string | null
          applicant_signed_date?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_signature?: string | null
          business_name?: string | null
          company_telephone?: string | null
          contact_name?: string | null
          contact_position?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit_set?: number | null
          credit_requested?: number | null
          customer_id?: string | null
          date_of_incorporation?: string | null
          eori_number?: string | null
          holding_company?: string | null
          id?: string
          invited_email?: string | null
          invoice_address?: string | null
          invoice_address_postcode?: string | null
          invoice_email?: string | null
          mobile_number?: string | null
          nature_of_business?: string | null
          registered_office?: string | null
          registered_office_postcode?: string | null
          share_token?: string
          status?: string
          submitted_at?: string | null
          trade_references?: Json | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          account_number?: string | null
          applicant_print_name?: string | null
          applicant_signature?: string | null
          applicant_signed_date?: string | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by_name?: string | null
          approved_by_signature?: string | null
          business_name?: string | null
          company_telephone?: string | null
          contact_name?: string | null
          contact_position?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit_set?: number | null
          credit_requested?: number | null
          customer_id?: string | null
          date_of_incorporation?: string | null
          eori_number?: string | null
          holding_company?: string | null
          id?: string
          invited_email?: string | null
          invoice_address?: string | null
          invoice_address_postcode?: string | null
          invoice_email?: string | null
          mobile_number?: string | null
          nature_of_business?: string | null
          registered_office?: string | null
          registered_office_postcode?: string | null
          share_token?: string
          status?: string
          submitted_at?: string | null
          trade_references?: Json | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_account_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_assignment_log: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assigned_to: string | null
          id: string
          ticket_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string | null
          id?: string
          ticket_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assigned_to?: string | null
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_assignment_log_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "crm_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_assignment_log_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "crm_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_auto_reply_rules: {
        Row: {
          created_at: string
          exclude_patterns: string[]
          exclude_website_enquiries: boolean
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exclude_patterns?: string[]
          exclude_website_enquiries?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exclude_patterns?: string[]
          exclude_website_enquiries?: boolean
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_email_templates: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_mailbox_connections: {
        Row: {
          access_token: string
          created_at: string
          last_synced_at: string | null
          ms_display_name: string | null
          ms_email: string
          refresh_token: string
          scope: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          last_synced_at?: string | null
          ms_display_name?: string | null
          ms_email: string
          refresh_token: string
          scope?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          last_synced_at?: string | null
          ms_display_name?: string | null
          ms_email?: string
          refresh_token?: string
          scope?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_mailbox_oauth_states: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_pricing: {
        Row: {
          created_at: string
          current_price: number
          grade: string | null
          id: string
          is_active: boolean
          last_updated: string
          material_type: string
          notes: string | null
          unit: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          current_price?: number
          grade?: string | null
          id?: string
          is_active?: boolean
          last_updated?: string
          material_type: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          current_price?: number
          grade?: string | null
          id?: string
          is_active?: boolean
          last_updated?: string
          material_type?: string
          notes?: string | null
          unit?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      crm_pricing_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number | null
          old_price: number | null
          pricing_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          pricing_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number | null
          old_price?: number | null
          pricing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_pricing_history_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "crm_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_team_members: {
        Row: {
          created_at: string
          id: string
          initials: string | null
          is_active: boolean
          name: string
          personal_email: string
          role: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          initials?: string | null
          is_active?: boolean
          name: string
          personal_email: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          initials?: string | null
          is_active?: boolean
          name?: string
          personal_email?: string
          role?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      crm_ticket_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          graph_attachment_id: string | null
          id: string
          message_id: string | null
          size_bytes: number | null
          storage_path: string | null
          ticket_id: string
          updated_at: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          graph_attachment_id?: string | null
          id?: string
          message_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          ticket_id: string
          updated_at?: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          graph_attachment_id?: string | null
          id?: string
          message_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          ticket_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "crm_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "crm_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ticket_messages: {
        Row: {
          body: string | null
          body_preview: string | null
          created_at: string
          direction: string
          from_email: string | null
          from_name: string | null
          graph_message_id: string | null
          id: string
          is_internal_note: boolean
          mailbox_user_id: string | null
          sent_at: string
          sent_by: string | null
          ticket_id: string
        }
        Insert: {
          body?: string | null
          body_preview?: string | null
          created_at?: string
          direction: string
          from_email?: string | null
          from_name?: string | null
          graph_message_id?: string | null
          id?: string
          is_internal_note?: boolean
          mailbox_user_id?: string | null
          sent_at?: string
          sent_by?: string | null
          ticket_id: string
        }
        Update: {
          body?: string | null
          body_preview?: string | null
          created_at?: string
          direction?: string
          from_email?: string | null
          from_name?: string | null
          graph_message_id?: string | null
          id?: string
          is_internal_note?: boolean
          mailbox_user_id?: string | null
          sent_at?: string
          sent_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ticket_messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "crm_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "crm_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          customer_id: string | null
          due_at: string | null
          graph_conversation_id: string | null
          graph_message_id: string | null
          id: string
          is_read: boolean
          last_message_at: string
          mailbox_user_id: string | null
          priority: string
          sender_email: string | null
          sender_name: string | null
          site_id: string | null
          snippet: string | null
          snoozed_until: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          customer_id?: string | null
          due_at?: string | null
          graph_conversation_id?: string | null
          graph_message_id?: string | null
          id?: string
          is_read?: boolean
          last_message_at?: string
          mailbox_user_id?: string | null
          priority?: string
          sender_email?: string | null
          sender_name?: string | null
          site_id?: string | null
          snippet?: string | null
          snoozed_until?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          customer_id?: string | null
          due_at?: string | null
          graph_conversation_id?: string | null
          graph_message_id?: string | null
          id?: string
          is_read?: boolean
          last_message_at?: string
          mailbox_user_id?: string | null
          priority?: string
          sender_email?: string | null
          sender_name?: string | null
          site_id?: string | null
          snippet?: string | null
          snoozed_until?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "crm_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tickets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_finance_details: {
        Row: {
          accounting_customer_ref: string | null
          accounting_provider: string
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_county: string | null
          billing_postcode: string | null
          created_at: string
          customer_id: string
          finance_contact_email: string | null
          finance_contact_name: string | null
          finance_contact_phone: string | null
          id: string
          notes: string | null
          payment_terms_days: number | null
          po_required: boolean
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          accounting_customer_ref?: string | null
          accounting_provider?: string
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_county?: string | null
          billing_postcode?: string | null
          created_at?: string
          customer_id: string
          finance_contact_email?: string | null
          finance_contact_name?: string | null
          finance_contact_phone?: string | null
          id?: string
          notes?: string | null
          payment_terms_days?: number | null
          po_required?: boolean
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          accounting_customer_ref?: string | null
          accounting_provider?: string
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_county?: string | null
          billing_postcode?: string | null
          created_at?: string
          customer_id?: string
          finance_contact_email?: string | null
          finance_contact_name?: string | null
          finance_contact_phone?: string | null
          id?: string
          notes?: string | null
          payment_terms_days?: number | null
          po_required?: boolean
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_finance_details_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_memberships: {
        Row: {
          contact_id: string | null
          created_at: string
          customer_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_memberships_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_memberships_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_site_access: {
        Row: {
          created_at: string
          id: string
          membership_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          membership_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_site_access_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_site_access_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_reporting_periods: {
        Row: {
          created_at: string
          customer_id: string
          display_order: number
          id: string
          month_name: string
          period_end_date: string
          period_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          display_order?: number
          id?: string
          month_name: string
          period_end_date: string
          period_label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          display_order?: number
          id?: string
          month_name?: string
          period_end_date?: string
          period_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_reporting_periods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_site_price_sets: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          price_set_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_set_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          price_set_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_site_price_sets_price_set_id_fkey"
            columns: ["price_set_id"]
            isOneToOne: false
            referencedRelation: "rebate_price_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_site_price_sets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_site_rebate_overrides: {
        Row: {
          created_at: string
          end_date: string
          id: string
          notes: string | null
          rebate_item_id: string
          set_value: number
          site_id: string
          start_date: string
          updated_at: string
          waste_type: string | null
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          rebate_item_id: string
          set_value: number
          site_id: string
          start_date: string
          updated_at?: string
          waste_type?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          rebate_item_id?: string
          set_value?: number
          site_id?: string
          start_date?: string
          updated_at?: string
          waste_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_site_rebate_overrides_rebate_item_id_fkey"
            columns: ["rebate_item_id"]
            isOneToOne: false
            referencedRelation: "rebate_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_site_rebate_overrides_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_site_skip_rebates: {
        Row: {
          adjustment: number | null
          container_type_filter: string[] | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          material_type: string
          rebate_enabled: boolean | null
          set_value: number | null
          site_id: string
          threshold_tonnes: number | null
          updated_at: string
          value_type: string
          value_type_item_id: string | null
          waste_description_filter: string[] | null
        }
        Insert: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          material_type: string
          rebate_enabled?: boolean | null
          set_value?: number | null
          site_id: string
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
          waste_description_filter?: string[] | null
        }
        Update: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          material_type?: string
          rebate_enabled?: boolean | null
          set_value?: number | null
          site_id?: string
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
          waste_description_filter?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_site_skip_rebates_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_site_skip_rebates_value_type_item_id_fkey"
            columns: ["value_type_item_id"]
            isOneToOne: false
            referencedRelation: "rebate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sites: {
        Row: {
          address_1: string | null
          address_2: string | null
          address_3: string | null
          address_4: string | null
          address_5: string | null
          archived_at: string | null
          area: string | null
          broker_subclient: string | null
          created_at: string
          customer_id: string
          data_hub_customer: string | null
          data_hub_site: string | null
          data_hub_site_2: string | null
          data_hub_site_3: string | null
          data_hub_site_4: string | null
          data_hub_site_5: string | null
          id: string
          is_archived: boolean
          load_report_type: string | null
          owner_contact_id: string | null
          pod_email: string | null
          postcode: string | null
          sic_code: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          address_1?: string | null
          address_2?: string | null
          address_3?: string | null
          address_4?: string | null
          address_5?: string | null
          archived_at?: string | null
          area?: string | null
          broker_subclient?: string | null
          created_at?: string
          customer_id: string
          data_hub_customer?: string | null
          data_hub_site?: string | null
          data_hub_site_2?: string | null
          data_hub_site_3?: string | null
          data_hub_site_4?: string | null
          data_hub_site_5?: string | null
          id?: string
          is_archived?: boolean
          load_report_type?: string | null
          owner_contact_id?: string | null
          pod_email?: string | null
          postcode?: string | null
          sic_code?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_name: string
          updated_at?: string
        }
        Update: {
          address_1?: string | null
          address_2?: string | null
          address_3?: string | null
          address_4?: string | null
          address_5?: string | null
          archived_at?: string | null
          area?: string | null
          broker_subclient?: string | null
          created_at?: string
          customer_id?: string
          data_hub_customer?: string | null
          data_hub_site?: string | null
          data_hub_site_2?: string | null
          data_hub_site_3?: string | null
          data_hub_site_4?: string | null
          data_hub_site_5?: string | null
          id?: string
          is_archived?: boolean
          load_report_type?: string | null
          owner_contact_id?: string | null
          pod_email?: string | null
          postcode?: string | null
          sic_code?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sites_owner_contact_id_fkey"
            columns: ["owner_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_skip_rebates: {
        Row: {
          adjustment: number | null
          container_type_filter: string[] | null
          created_at: string
          customer_id: string
          effective_from: string | null
          effective_to: string | null
          id: string
          material_type: string
          rebate_enabled: boolean | null
          set_value: number | null
          threshold_tonnes: number | null
          updated_at: string
          value_type: string
          value_type_item_id: string | null
          waste_description_filter: string[] | null
        }
        Insert: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          customer_id: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          material_type: string
          rebate_enabled?: boolean | null
          set_value?: number | null
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
          waste_description_filter?: string[] | null
        }
        Update: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          customer_id?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          material_type?: string
          rebate_enabled?: boolean | null
          set_value?: number | null
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
          waste_description_filter?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_skip_rebates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_skip_rebates_value_type_item_id_fkey"
            columns: ["value_type_item_id"]
            isOneToOne: false
            referencedRelation: "rebate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auto_pod_emails_enabled: boolean
          created_at: string
          custom_reporting_periods_enabled: boolean
          customer_code: string
          customer_name: string
          data_hub_customer: string | null
          id: string
          is_active: boolean
          is_broker: boolean
          is_container_load_customer: boolean
          midweigh_rebates_enabled: boolean
          po_notification_email: string | null
          po_spans_periods: boolean
          pod_email: string | null
          updated_at: string
        }
        Insert: {
          auto_pod_emails_enabled?: boolean
          created_at?: string
          custom_reporting_periods_enabled?: boolean
          customer_code: string
          customer_name: string
          data_hub_customer?: string | null
          id?: string
          is_active?: boolean
          is_broker?: boolean
          is_container_load_customer?: boolean
          midweigh_rebates_enabled?: boolean
          po_notification_email?: string | null
          po_spans_periods?: boolean
          pod_email?: string | null
          updated_at?: string
        }
        Update: {
          auto_pod_emails_enabled?: boolean
          created_at?: string
          custom_reporting_periods_enabled?: boolean
          customer_code?: string
          customer_name?: string
          data_hub_customer?: string | null
          id?: string
          is_active?: boolean
          is_broker?: boolean
          is_container_load_customer?: boolean
          midweigh_rebates_enabled?: boolean
          po_notification_email?: string | null
          po_spans_periods?: boolean
          pod_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_hub_jobs: {
        Row: {
          account_code: string | null
          carrier_number: string | null
          category: string | null
          container_type: string | null
          created_at: string
          customer: string | null
          driver: string | null
          ewc: string | null
          gross_weight: number | null
          haulier: string | null
          id: string
          job_date: string | null
          job_number: string
          job_type: string | null
          linked_skip_job: string | null
          manual_edit_note: string | null
          movement_type: string | null
          order_number_override: string | null
          postcode: string | null
          raw: Json
          rebate_rate_per_tonne: number | null
          site: string | null
          source: string
          tare_weight: number | null
          tipping_location: string | null
          updated_at: string
          vehicle_registration: string | null
          waste_description: string | null
          weight_t: number | null
        }
        Insert: {
          account_code?: string | null
          carrier_number?: string | null
          category?: string | null
          container_type?: string | null
          created_at?: string
          customer?: string | null
          driver?: string | null
          ewc?: string | null
          gross_weight?: number | null
          haulier?: string | null
          id?: string
          job_date?: string | null
          job_number: string
          job_type?: string | null
          linked_skip_job?: string | null
          manual_edit_note?: string | null
          movement_type?: string | null
          order_number_override?: string | null
          postcode?: string | null
          raw?: Json
          rebate_rate_per_tonne?: number | null
          site?: string | null
          source: string
          tare_weight?: number | null
          tipping_location?: string | null
          updated_at?: string
          vehicle_registration?: string | null
          waste_description?: string | null
          weight_t?: number | null
        }
        Update: {
          account_code?: string | null
          carrier_number?: string | null
          category?: string | null
          container_type?: string | null
          created_at?: string
          customer?: string | null
          driver?: string | null
          ewc?: string | null
          gross_weight?: number | null
          haulier?: string | null
          id?: string
          job_date?: string | null
          job_number?: string
          job_type?: string | null
          linked_skip_job?: string | null
          manual_edit_note?: string | null
          movement_type?: string | null
          order_number_override?: string | null
          postcode?: string | null
          raw?: Json
          rebate_rate_per_tonne?: number | null
          site?: string | null
          source?: string
          tare_weight?: number | null
          tipping_location?: string | null
          updated_at?: string
          vehicle_registration?: string | null
          waste_description?: string | null
          weight_t?: number | null
        }
        Relationships: []
      }
      data_hub_jobs_archive: {
        Row: {
          archive_reason: string | null
          archived_at: string
          archived_by: string | null
          category: string | null
          container_type: string | null
          customer: string | null
          driver: string | null
          ewc: string | null
          id: string
          job_date: string | null
          job_number: string
          job_type: string | null
          manual_edit_note: string | null
          movement_type: string | null
          order_number_override: string | null
          original_created_at: string | null
          original_id: string | null
          original_updated_at: string | null
          raw: Json
          rebate_rate_per_tonne: number | null
          site: string | null
          source: string
          tipping_location: string | null
          vehicle_registration: string | null
          waste_description: string | null
          weight_t: number | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string
          archived_by?: string | null
          category?: string | null
          container_type?: string | null
          customer?: string | null
          driver?: string | null
          ewc?: string | null
          id?: string
          job_date?: string | null
          job_number: string
          job_type?: string | null
          manual_edit_note?: string | null
          movement_type?: string | null
          order_number_override?: string | null
          original_created_at?: string | null
          original_id?: string | null
          original_updated_at?: string | null
          raw?: Json
          rebate_rate_per_tonne?: number | null
          site?: string | null
          source: string
          tipping_location?: string | null
          vehicle_registration?: string | null
          waste_description?: string | null
          weight_t?: number | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string
          archived_by?: string | null
          category?: string | null
          container_type?: string | null
          customer?: string | null
          driver?: string | null
          ewc?: string | null
          id?: string
          job_date?: string | null
          job_number?: string
          job_type?: string | null
          manual_edit_note?: string | null
          movement_type?: string | null
          order_number_override?: string | null
          original_created_at?: string | null
          original_id?: string | null
          original_updated_at?: string | null
          raw?: Json
          rebate_rate_per_tonne?: number | null
          site?: string | null
          source?: string
          tipping_location?: string | null
          vehicle_registration?: string | null
          waste_description?: string | null
          weight_t?: number | null
        }
        Relationships: []
      }
      data_hub_rebate_mappings: {
        Row: {
          created_at: string
          id: string
          material_type_id: string | null
          rebate_item_id: string | null
          updated_at: string
          waste_description: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_type_id?: string | null
          rebate_item_id?: string | null
          updated_at?: string
          waste_description: string
        }
        Update: {
          created_at?: string
          id?: string
          material_type_id?: string | null
          rebate_item_id?: string | null
          updated_at?: string
          waste_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_hub_rebate_mappings_material_type_id_fkey"
            columns: ["material_type_id"]
            isOneToOne: false
            referencedRelation: "load_waste_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_hub_rebate_mappings_rebate_item_id_fkey"
            columns: ["rebate_item_id"]
            isOneToOne: false
            referencedRelation: "rebate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      data_upload_log: {
        Row: {
          file_name: string | null
          id: string
          row_count: number
          source: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          file_name?: string | null
          id?: string
          row_count?: number
          source: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string | null
          id?: string
          row_count?: number
          source?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      default_waste_types: {
        Row: {
          display_order: number
          ewc_code: string | null
          id: string
          waste_type: string
        }
        Insert: {
          display_order?: number
          ewc_code?: string | null
          id?: string
          waste_type: string
        }
        Update: {
          display_order?: number
          ewc_code?: string | null
          id?: string
          waste_type?: string
        }
        Relationships: []
      }
      diary_cards: {
        Row: {
          category: string | null
          color: string | null
          content: string
          created_at: string
          day_of_week: number
          display_order: number
          id: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          category?: string | null
          color?: string | null
          content?: string
          created_at?: string
          day_of_week: number
          display_order?: number
          id?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          category?: string | null
          color?: string | null
          content?: string
          created_at?: string
          day_of_week?: number
          display_order?: number
          id?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      diary_week_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      document_types: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          battery_level: number | null
          created_at: string
          driver_id: string
          driver_name: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          battery_level?: number | null
          created_at?: string
          driver_id: string
          driver_name?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          battery_level?: number | null
          created_at?: string
          driver_id?: string
          driver_name?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "route_one_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      dwt_job_overrides: {
        Row: {
          created_at: string
          id: string
          job_id: string
          overrides: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          overrides?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dwt_job_overrides_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "data_hub_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      dwt_settings: {
        Row: {
          autofill_enabled: boolean
          created_at: string
          default_carrier_name: string
          default_carrier_registration: string
          default_container_type: string
          default_means_of_transport: string
          default_physical_form: string
          id: string
          updated_at: string
        }
        Insert: {
          autofill_enabled?: boolean
          created_at?: string
          default_carrier_name?: string
          default_carrier_registration?: string
          default_container_type?: string
          default_means_of_transport?: string
          default_physical_form?: string
          id?: string
          updated_at?: string
        }
        Update: {
          autofill_enabled?: boolean
          created_at?: string
          default_carrier_name?: string
          default_carrier_registration?: string
          default_container_type?: string
          default_means_of_transport?: string
          default_physical_form?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dwt_submissions: {
        Row: {
          created_at: string
          environment: string | null
          error_message: string | null
          http_status: number | null
          id: string
          job_id: string
          request_payload: Json | null
          response_body: Json | null
          status: string
          submitted_at: string
          submitted_by: string | null
          ticket_number: string | null
          wt_id: string | null
        }
        Insert: {
          created_at?: string
          environment?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          job_id: string
          request_payload?: Json | null
          response_body?: Json | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          ticket_number?: string | null
          wt_id?: string | null
        }
        Update: {
          created_at?: string
          environment?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          job_id?: string
          request_payload?: Json | null
          response_body?: Json | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          ticket_number?: string | null
          wt_id?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          available_variables: string[] | null
          body_html: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          sender_email: string
          sender_name: string
          subject_template: string
          template_key: string
          template_name: string
          updated_at: string
        }
        Insert: {
          available_variables?: string[] | null
          body_html: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sender_email?: string
          sender_name?: string
          subject_template: string
          template_key: string
          template_name: string
          updated_at?: string
        }
        Update: {
          available_variables?: string[] | null
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          sender_email?: string
          sender_name?: string
          subject_template?: string
          template_key?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enquiries: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          internal_notes: string | null
          message: string
          status: string
          subject: string
          updated_at: string
          urgency: string
          user_email: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          internal_notes?: string | null
          message: string
          status?: string
          subject: string
          updated_at?: string
          urgency?: string
          user_email: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          internal_notes?: string | null
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          urgency?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_recycling_forms: {
        Row: {
          additional_comments: string | null
          average_recovery_rate: number | null
          average_recycling_rate: number | null
          can_skips_be_weighed: string | null
          can_waste_breakdown_per_skip: string | null
          company_name: string
          completed_by: string
          created_at: string
          created_by: string | null
          desktop_audit: boolean | null
          desktop_audit_checked_by: string | null
          desktop_audit_completed_by: string | null
          facility_name: string
          form_date: string
          id: string
          share_token: string
          skips_weighed_notes: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          visual_audit: boolean | null
          waste_breakdown_notes: string | null
          wml_license_number: string | null
        }
        Insert: {
          additional_comments?: string | null
          average_recovery_rate?: number | null
          average_recycling_rate?: number | null
          can_skips_be_weighed?: string | null
          can_waste_breakdown_per_skip?: string | null
          company_name: string
          completed_by: string
          created_at?: string
          created_by?: string | null
          desktop_audit?: boolean | null
          desktop_audit_checked_by?: string | null
          desktop_audit_completed_by?: string | null
          facility_name: string
          form_date?: string
          id?: string
          share_token?: string
          skips_weighed_notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          visual_audit?: boolean | null
          waste_breakdown_notes?: string | null
          wml_license_number?: string | null
        }
        Update: {
          additional_comments?: string | null
          average_recovery_rate?: number | null
          average_recycling_rate?: number | null
          can_skips_be_weighed?: string | null
          can_waste_breakdown_per_skip?: string | null
          company_name?: string
          completed_by?: string
          created_at?: string
          created_by?: string | null
          desktop_audit?: boolean | null
          desktop_audit_checked_by?: string | null
          desktop_audit_completed_by?: string | null
          facility_name?: string
          form_date?: string
          id?: string
          share_token?: string
          skips_weighed_notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          visual_audit?: boolean | null
          waste_breakdown_notes?: string | null
          wml_license_number?: string | null
        }
        Relationships: []
      }
      facility_recycling_waste_entries: {
        Row: {
          created_at: string
          display_order: number
          ewc_code: string | null
          final_destination_info: string | null
          form_id: string
          id: string
          percent_landfill: number | null
          percent_recovered: number | null
          percent_recycled: number | null
          updated_at: string
          waste_type: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          final_destination_info?: string | null
          form_id: string
          id?: string
          percent_landfill?: number | null
          percent_recovered?: number | null
          percent_recycled?: number | null
          updated_at?: string
          waste_type: string
        }
        Update: {
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          final_destination_info?: string | null
          form_id?: string
          id?: string
          percent_landfill?: number | null
          percent_recovered?: number | null
          percent_recycled?: number | null
          updated_at?: string
          waste_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_recycling_waste_entries_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "facility_recycling_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_settings: {
        Row: {
          accounting_provider: string
          accounting_sync_enabled: boolean
          created_at: string
          default_payment_terms_days: number
          default_vat_rate: number
          id: string
          invoice_accent_color: string
          invoice_document_title: string
          invoice_email_body: string
          invoice_email_subject: string
          invoice_font: string
          invoice_footer_text: string | null
          invoice_header_style: string
          invoice_logo_url: string | null
          invoice_logo_width_mm: number
          invoice_number_padding: number
          invoice_prefix: string
          invoice_show_bank_details: boolean
          invoice_show_company_address: boolean
          invoice_show_logo: boolean
          invoice_show_vat_breakdown: boolean
          invoice_table_style: string
          invoice_terms_text: string | null
          next_invoice_number: number
          reminder_days: number[]
          reminder_email_body: string
          reminder_email_subject: string
          reminders_enabled: boolean
          updated_at: string
        }
        Insert: {
          accounting_provider?: string
          accounting_sync_enabled?: boolean
          created_at?: string
          default_payment_terms_days?: number
          default_vat_rate?: number
          id?: string
          invoice_accent_color?: string
          invoice_document_title?: string
          invoice_email_body?: string
          invoice_email_subject?: string
          invoice_font?: string
          invoice_footer_text?: string | null
          invoice_header_style?: string
          invoice_logo_url?: string | null
          invoice_logo_width_mm?: number
          invoice_number_padding?: number
          invoice_prefix?: string
          invoice_show_bank_details?: boolean
          invoice_show_company_address?: boolean
          invoice_show_logo?: boolean
          invoice_show_vat_breakdown?: boolean
          invoice_table_style?: string
          invoice_terms_text?: string | null
          next_invoice_number?: number
          reminder_days?: number[]
          reminder_email_body?: string
          reminder_email_subject?: string
          reminders_enabled?: boolean
          updated_at?: string
        }
        Update: {
          accounting_provider?: string
          accounting_sync_enabled?: boolean
          created_at?: string
          default_payment_terms_days?: number
          default_vat_rate?: number
          id?: string
          invoice_accent_color?: string
          invoice_document_title?: string
          invoice_email_body?: string
          invoice_email_subject?: string
          invoice_font?: string
          invoice_footer_text?: string | null
          invoice_header_style?: string
          invoice_logo_url?: string | null
          invoice_logo_width_mm?: number
          invoice_number_padding?: number
          invoice_prefix?: string
          invoice_show_bank_details?: boolean
          invoice_show_company_address?: boolean
          invoice_show_logo?: boolean
          invoice_show_vat_breakdown?: boolean
          invoice_table_style?: string
          invoice_terms_text?: string | null
          next_invoice_number?: number
          reminder_days?: number[]
          reminder_email_body?: string
          reminder_email_subject?: string
          reminders_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      fire_drills: {
        Row: {
          actions: string | null
          actual_headcount: number | null
          conducted_by: string | null
          created_at: string
          drill_date: string
          drill_time: string | null
          evacuation_seconds: number | null
          expected_headcount: number | null
          id: string
          issues: string | null
          scenario: string | null
          updated_at: string
        }
        Insert: {
          actions?: string | null
          actual_headcount?: number | null
          conducted_by?: string | null
          created_at?: string
          drill_date?: string
          drill_time?: string | null
          evacuation_seconds?: number | null
          expected_headcount?: number | null
          id?: string
          issues?: string | null
          scenario?: string | null
          updated_at?: string
        }
        Update: {
          actions?: string | null
          actual_headcount?: number | null
          conducted_by?: string | null
          created_at?: string
          drill_date?: string
          drill_time?: string | null
          evacuation_seconds?: number | null
          expected_headcount?: number | null
          id?: string
          issues?: string | null
          scenario?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fire_equipment_checks: {
        Row: {
          checked_by: string | null
          created_at: string
          defects: string | null
          frequency_days: number
          id: string
          is_active: boolean
          item_ref: string | null
          item_type: string
          last_checked_on: string | null
          location: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checked_by?: string | null
          created_at?: string
          defects?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          item_ref?: string | null
          item_type: string
          last_checked_on?: string | null
          location?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checked_by?: string | null
          created_at?: string
          defects?: string | null
          frequency_days?: number
          id?: string
          is_active?: boolean
          item_ref?: string | null
          item_type?: string
          last_checked_on?: string | null
          location?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fire_risk_actions: {
        Row: {
          action: string | null
          assessment_id: string | null
          completed_on: string | null
          created_at: string
          due_date: string | null
          finding: string
          id: string
          owner: string | null
          priority: string
          status: string
          updated_at: string
        }
        Insert: {
          action?: string | null
          assessment_id?: string | null
          completed_on?: string | null
          created_at?: string
          due_date?: string | null
          finding: string
          id?: string
          owner?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string | null
          assessment_id?: string | null
          completed_on?: string | null
          created_at?: string
          due_date?: string | null
          finding?: string
          id?: string
          owner?: string | null
          priority?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fire_risk_actions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "fire_risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      fire_risk_assessments: {
        Row: {
          assessment_date: string
          assessor: string | null
          created_at: string
          id: string
          is_current: boolean
          review_due: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assessment_date?: string
          assessor?: string | null
          created_at?: string
          id?: string
          is_current?: boolean
          review_due?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          assessment_date?: string
          assessor?: string | null
          created_at?: string
          id?: string
          is_current?: boolean
          review_due?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fire_safety_people: {
        Row: {
          appointed_on: string | null
          area: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          role: string
          sort_order: number
          training_expiry: string | null
          updated_at: string
        }
        Insert: {
          appointed_on?: string | null
          area?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          role: string
          sort_order?: number
          training_expiry?: string | null
          updated_at?: string
        }
        Update: {
          appointed_on?: string | null
          area?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          role?: string
          sort_order?: number
          training_expiry?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fire_weekly_tests: {
        Row: {
          audible_everywhere: boolean
          call_point: string | null
          created_at: string
          created_by: string | null
          defects: string | null
          id: string
          notes: string | null
          result: string
          test_date: string
          tested_by: string | null
          updated_at: string
        }
        Insert: {
          audible_everywhere?: boolean
          call_point?: string | null
          created_at?: string
          created_by?: string | null
          defects?: string | null
          id?: string
          notes?: string | null
          result?: string
          test_date?: string
          tested_by?: string | null
          updated_at?: string
        }
        Update: {
          audible_everywhere?: boolean
          call_point?: string | null
          created_at?: string
          created_by?: string | null
          defects?: string | null
          id?: string
          notes?: string | null
          result?: string
          test_date?: string
          tested_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fuel_surcharge_rates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          customer_match: string | null
          effective_from_date: string
          id: string
          notes: string | null
          surcharge_amount: number
          updated_at: string
          vehicle_category: string
          zone: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          customer_match?: string | null
          effective_from_date: string
          id?: string
          notes?: string | null
          surcharge_amount?: number
          updated_at?: string
          vehicle_category: string
          zone: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          customer_match?: string | null
          effective_from_date?: string
          id?: string
          notes?: string | null
          surcharge_amount?: number
          updated_at?: string
          vehicle_category?: string
          zone?: string
        }
        Relationships: []
      }
      gdpr_cleanup_log: {
        Row: {
          action: string
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          last_activity_date: string | null
          notes: string | null
          performed_by: string | null
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          last_activity_date?: string | null
          notes?: string | null
          performed_by?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          last_activity_date?: string | null
          notes?: string | null
          performed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gdpr_retention_settings: {
        Row: {
          apply_to_contacts: boolean
          apply_to_customers: boolean
          auto_archive: boolean
          created_at: string
          id: string
          notes: string | null
          retention_months: number
          updated_at: string
        }
        Insert: {
          apply_to_contacts?: boolean
          apply_to_customers?: boolean
          auto_archive?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          retention_months?: number
          updated_at?: string
        }
        Update: {
          apply_to_contacts?: boolean
          apply_to_customers?: boolean
          auto_archive?: boolean
          created_at?: string
          id?: string
          notes?: string | null
          retention_months?: number
          updated_at?: string
        }
        Relationships: []
      }
      handbook_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          section_key: string
          title_en: string
          title_pl: string | null
          title_ro: string | null
          title_uk: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          section_key: string
          title_en: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          section_key?: string
          title_en?: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      handbook_signatures: {
        Row: {
          created_at: string
          employee_name: string
          id: string
          signature_image: string | null
          signed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_name: string
          id?: string
          signature_image?: string | null
          signed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_name?: string
          id?: string
          signature_image?: string | null
          signed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      handbook_subsections: {
        Row: {
          content_en: string
          content_pl: string | null
          content_ro: string | null
          content_uk: string | null
          created_at: string
          display_order: number
          id: string
          section_id: string
          subsection_key: string
          title_en: string
          title_pl: string | null
          title_ro: string | null
          title_uk: string | null
          updated_at: string
        }
        Insert: {
          content_en: string
          content_pl?: string | null
          content_ro?: string | null
          content_uk?: string | null
          created_at?: string
          display_order?: number
          id?: string
          section_id: string
          subsection_key: string
          title_en: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
        }
        Update: {
          content_en?: string
          content_pl?: string | null
          content_ro?: string | null
          content_uk?: string | null
          created_at?: string
          display_order?: number
          id?: string
          section_id?: string
          subsection_key?: string
          title_en?: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "handbook_subsections_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "handbook_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_contact_settings: {
        Row: {
          contact_email: string
          contact_name: string
          contact_phone: string | null
          created_at: string
          id: string
          office_address: string | null
          office_hours: string | null
          updated_at: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          office_address?: string | null
          office_hours?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          office_address?: string | null
          office_hours?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hs_document_signatures: {
        Row: {
          acknowledgements: Json
          date_of_birth: string | null
          document_id: string
          employee_name: string | null
          id: string
          inducted_by: string | null
          job_title: string | null
          language: string
          signature_image: string
          signed_at: string
          site: string | null
          user_id: string
        }
        Insert: {
          acknowledgements?: Json
          date_of_birth?: string | null
          document_id: string
          employee_name?: string | null
          id?: string
          inducted_by?: string | null
          job_title?: string | null
          language?: string
          signature_image: string
          signed_at?: string
          site?: string | null
          user_id: string
        }
        Update: {
          acknowledgements?: Json
          date_of_birth?: string | null
          document_id?: string
          employee_name?: string | null
          id?: string
          inducted_by?: string | null
          job_title?: string | null
          language?: string
          signature_image?: string
          signed_at?: string
          site?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hs_document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "hs_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      hs_documents: {
        Row: {
          acknowledgements: Json
          acknowledgements_pl: Json | null
          acknowledgements_ro: Json | null
          acknowledgements_uk: Json | null
          category: string
          content: string
          content_pl: string | null
          content_ro: string | null
          content_uk: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          reference_code: string | null
          requires_signature: boolean
          site: string | null
          title: string
          title_pl: string | null
          title_ro: string | null
          title_uk: string | null
          updated_at: string
          user_types: string[]
          version: string | null
        }
        Insert: {
          acknowledgements?: Json
          acknowledgements_pl?: Json | null
          acknowledgements_ro?: Json | null
          acknowledgements_uk?: Json | null
          category: string
          content?: string
          content_pl?: string | null
          content_ro?: string | null
          content_uk?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          reference_code?: string | null
          requires_signature?: boolean
          site?: string | null
          title: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
          user_types?: string[]
          version?: string | null
        }
        Update: {
          acknowledgements?: Json
          acknowledgements_pl?: Json | null
          acknowledgements_ro?: Json | null
          acknowledgements_uk?: Json | null
          category?: string
          content?: string
          content_pl?: string | null
          content_ro?: string | null
          content_uk?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          reference_code?: string | null
          requires_signature?: boolean
          site?: string | null
          title?: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
          user_types?: string[]
          version?: string | null
        }
        Relationships: []
      }
      inventory_share_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string | null
          last_viewed_at: string | null
          show_photos: boolean
          show_values: boolean
          token: string
          updated_at: string
          verified_only: boolean
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_viewed_at?: string | null
          show_photos?: boolean
          show_values?: boolean
          token?: string
          updated_at?: string
          verified_only?: boolean
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_viewed_at?: string | null
          show_photos?: boolean
          show_values?: boolean
          token?: string
          updated_at?: string
          verified_only?: boolean
          view_count?: number
        }
        Relationships: []
      }
      invoice_line_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          net_amount: number
          nominal_code: string | null
          quantity: number
          sort_order: number
          unit: string | null
          unit_price: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          net_amount?: number
          nominal_code?: string | null
          quantity?: number
          sort_order?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          net_amount?: number
          nominal_code?: string | null
          quantity?: number
          sort_order?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          accounting_ref: string | null
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          payment_date: string
          recorded_by: string | null
          reference: string | null
          source: string
          updated_at: string
        }
        Insert: {
          accounting_ref?: string | null
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          accounting_ref?: string | null
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          payment_date?: string
          recorded_by?: string | null
          reference?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          accounting_provider: string
          accounting_ref: string | null
          accounting_sync_status: string
          accounting_synced_at: string | null
          amount_paid: number
          bill_to: Json
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          due_date: string
          gross_total: number
          id: string
          invoice_number: string
          issue_date: string
          job_number: string | null
          job_source: string | null
          last_reminder_at: string | null
          last_reminder_day: number | null
          load_report_id: string | null
          net_total: number
          notes: string | null
          pdf_path: string | null
          purchase_order: string | null
          send_count: number
          sent_at: string | null
          sent_to: string | null
          site_id: string | null
          status: string
          status_override: boolean
          updated_at: string
          vat_total: number
        }
        Insert: {
          accounting_provider?: string
          accounting_ref?: string | null
          accounting_sync_status?: string
          accounting_synced_at?: string | null
          amount_paid?: number
          bill_to?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          due_date?: string
          gross_total?: number
          id?: string
          invoice_number: string
          issue_date?: string
          job_number?: string | null
          job_source?: string | null
          last_reminder_at?: string | null
          last_reminder_day?: number | null
          load_report_id?: string | null
          net_total?: number
          notes?: string | null
          pdf_path?: string | null
          purchase_order?: string | null
          send_count?: number
          sent_at?: string | null
          sent_to?: string | null
          site_id?: string | null
          status?: string
          status_override?: boolean
          updated_at?: string
          vat_total?: number
        }
        Update: {
          accounting_provider?: string
          accounting_ref?: string | null
          accounting_sync_status?: string
          accounting_synced_at?: string | null
          amount_paid?: number
          bill_to?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          due_date?: string
          gross_total?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          job_number?: string | null
          job_source?: string | null
          last_reminder_at?: string | null
          last_reminder_day?: number | null
          load_report_id?: string | null
          net_total?: number
          notes?: string | null
          pdf_path?: string | null
          purchase_order?: string | null
          send_count?: number
          sent_at?: string | null
          sent_to?: string | null
          site_id?: string | null
          status?: string
          status_override?: boolean
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      live_jobs_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      load_line_items: {
        Row: {
          avg_weight_kg: number
          created_at: string
          display_order: number
          id: string
          load_report_id: string
          pallet_count: number
          rebate_rate_per_tonne: number | null
          rebate_threshold_applied: boolean
          total_weight_kg: number
          updated_at: string
          waste_type: string
          wet_charge_applied: boolean | null
        }
        Insert: {
          avg_weight_kg?: number
          created_at?: string
          display_order?: number
          id?: string
          load_report_id: string
          pallet_count?: number
          rebate_rate_per_tonne?: number | null
          rebate_threshold_applied?: boolean
          total_weight_kg?: number
          updated_at?: string
          waste_type: string
          wet_charge_applied?: boolean | null
        }
        Update: {
          avg_weight_kg?: number
          created_at?: string
          display_order?: number
          id?: string
          load_report_id?: string
          pallet_count?: number
          rebate_rate_per_tonne?: number | null
          rebate_threshold_applied?: boolean
          total_weight_kg?: number
          updated_at?: string
          waste_type?: string
          wet_charge_applied?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "load_line_items_load_report_id_fkey"
            columns: ["load_report_id"]
            isOneToOne: false
            referencedRelation: "load_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      load_report_exclusions: {
        Row: {
          created_at: string
          excluded_by: string | null
          id: string
          job_number: string
          reason: string | null
          source: string
        }
        Insert: {
          created_at?: string
          excluded_by?: string | null
          id?: string
          job_number: string
          reason?: string | null
          source: string
        }
        Update: {
          created_at?: string
          excluded_by?: string | null
          id?: string
          job_number?: string
          reason?: string | null
          source?: string
        }
        Relationships: []
      }
      load_report_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      load_reports: {
        Row: {
          card_bales_count: number | null
          card_bales_on_pallets: boolean
          card_bales_weight_kg: number | null
          created_at: string
          exclude_from_rebate: boolean
          films_bale_count: number | null
          films_bale_on_pallets: boolean
          films_bale_weight_kg: number | null
          glass_dolav_count: number | null
          glass_dolav_on_pallets: boolean
          glass_dolav_weight_kg: number | null
          id: string
          no_pallets_on_load: boolean
          notes: string | null
          operator_id: string | null
          operator_name: string
          pallets_out: number | null
          pallets_scrap_count: number | null
          papers_dolav_count: number | null
          papers_dolav_on_pallets: boolean
          papers_dolav_weight_kg: number | null
          rebate_threshold_tonnes: number
          report_date: string
          scrap_metal_loose_count: number | null
          scrap_metal_loose_on_pallets: boolean
          scrap_metal_loose_weight_kg: number | null
          site_id: string | null
          staci_green_rate_per_tonne: number | null
          status: string
          submitted_at: string | null
          total_pallets: number
          total_weight_kg: number
          updated_at: string
          vehicle_reg: string | null
          wet_charge_percent: number | null
        }
        Insert: {
          card_bales_count?: number | null
          card_bales_on_pallets?: boolean
          card_bales_weight_kg?: number | null
          created_at?: string
          exclude_from_rebate?: boolean
          films_bale_count?: number | null
          films_bale_on_pallets?: boolean
          films_bale_weight_kg?: number | null
          glass_dolav_count?: number | null
          glass_dolav_on_pallets?: boolean
          glass_dolav_weight_kg?: number | null
          id?: string
          no_pallets_on_load?: boolean
          notes?: string | null
          operator_id?: string | null
          operator_name: string
          pallets_out?: number | null
          pallets_scrap_count?: number | null
          papers_dolav_count?: number | null
          papers_dolav_on_pallets?: boolean
          papers_dolav_weight_kg?: number | null
          rebate_threshold_tonnes?: number
          report_date?: string
          scrap_metal_loose_count?: number | null
          scrap_metal_loose_on_pallets?: boolean
          scrap_metal_loose_weight_kg?: number | null
          site_id?: string | null
          staci_green_rate_per_tonne?: number | null
          status?: string
          submitted_at?: string | null
          total_pallets?: number
          total_weight_kg?: number
          updated_at?: string
          vehicle_reg?: string | null
          wet_charge_percent?: number | null
        }
        Update: {
          card_bales_count?: number | null
          card_bales_on_pallets?: boolean
          card_bales_weight_kg?: number | null
          created_at?: string
          exclude_from_rebate?: boolean
          films_bale_count?: number | null
          films_bale_on_pallets?: boolean
          films_bale_weight_kg?: number | null
          glass_dolav_count?: number | null
          glass_dolav_on_pallets?: boolean
          glass_dolav_weight_kg?: number | null
          id?: string
          no_pallets_on_load?: boolean
          notes?: string | null
          operator_id?: string | null
          operator_name?: string
          pallets_out?: number | null
          pallets_scrap_count?: number | null
          papers_dolav_count?: number | null
          papers_dolav_on_pallets?: boolean
          papers_dolav_weight_kg?: number | null
          rebate_threshold_tonnes?: number
          report_date?: string
          scrap_metal_loose_count?: number | null
          scrap_metal_loose_on_pallets?: boolean
          scrap_metal_loose_weight_kg?: number | null
          site_id?: string | null
          staci_green_rate_per_tonne?: number | null
          status?: string
          submitted_at?: string | null
          total_pallets?: number
          total_weight_kg?: number
          updated_at?: string
          vehicle_reg?: string | null
          wet_charge_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "load_reports_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      load_waste_types: {
        Row: {
          created_at: string
          customer_type_filter: string[] | null
          default_avg_weight_kg: number
          display_order: number
          id: string
          is_active: boolean
          pallet_weight_kg: number
          rebate_category: string
          waste_type: string
        }
        Insert: {
          created_at?: string
          customer_type_filter?: string[] | null
          default_avg_weight_kg?: number
          display_order?: number
          id?: string
          is_active?: boolean
          pallet_weight_kg?: number
          rebate_category?: string
          waste_type: string
        }
        Update: {
          created_at?: string
          customer_type_filter?: string[] | null
          default_avg_weight_kg?: number
          display_order?: number
          id?: string
          is_active?: boolean
          pallet_weight_kg?: number
          rebate_category?: string
          waste_type?: string
        }
        Relationships: []
      }
      locked_rebate_reports: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          locked_at: string
          locked_by: string | null
          notes: string | null
          period_end: string
          period_start: string
          rebate_values_snapshot: Json
          report_snapshot: Json
          report_type: string
          site_id: string | null
          total_rebate: number | null
          total_weight: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          locked_at?: string
          locked_by?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          rebate_values_snapshot?: Json
          report_snapshot?: Json
          report_type?: string
          site_id?: string | null
          total_rebate?: number | null
          total_weight?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          locked_at?: string
          locked_by?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          rebate_values_snapshot?: Json
          report_snapshot?: Json
          report_type?: string
          site_id?: string | null
          total_rebate?: number | null
          total_weight?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locked_rebate_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locked_rebate_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      midweigh_product_mappings: {
        Row: {
          created_at: string
          id: string
          midweigh_product_code: string
          skiptrak_waste_description: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          midweigh_product_code: string
          skiptrak_waste_description: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          midweigh_product_code?: string
          skiptrak_waste_description?: string
          updated_at?: string
        }
        Relationships: []
      }
      near_miss_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          location: string
          potential_consequences: string | null
          report_date: string
          reporter_department: string | null
          reporter_name: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_actions: string | null
          updated_at: string
          what_happened: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          location: string
          potential_consequences?: string | null
          report_date?: string
          reporter_department?: string | null
          reporter_name?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_actions?: string | null
          updated_at?: string
          what_happened: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          location?: string
          potential_consequences?: string | null
          report_date?: string
          reporter_department?: string | null
          reporter_name?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_actions?: string | null
          updated_at?: string
          what_happened?: string
        }
        Relationships: []
      }
      partner_document_requirements: {
        Row: {
          created_at: string
          document_type: string
          id: string
          is_mandatory: boolean
          partner_type: string
          requires_expiry: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          is_mandatory?: boolean
          partner_type: string
          requires_expiry?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          is_mandatory?: boolean
          partner_type?: string
          requires_expiry?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      partner_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          expiry_date: string | null
          file_name: string
          file_path: string
          id: string
          partner_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          expiry_date?: string | null
          file_name: string
          file_path: string
          id?: string
          partner_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          id?: string
          partner_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_questionnaires: {
        Row: {
          additional_notes: string | null
          address_line1: string | null
          address_line2: string | null
          can_provide_prices_by_postcode: boolean | null
          city: string | null
          community_programme_details: string | null
          community_responsible_email: string | null
          community_responsible_name: string | null
          community_responsible_phone: string | null
          company_name: string
          company_registration_number: string | null
          complies_loler: boolean | null
          complies_puwer: boolean | null
          complies_skip_container_safety: boolean | null
          complies_skip_loader_guidance: boolean | null
          created_at: string
          created_by: string | null
          email_orders: string | null
          email_remittances: string | null
          h_and_s_proceedings_details: string | null
          has_anti_bribery_policy: boolean | null
          has_bs_8555: boolean | null
          has_community_programmes: boolean | null
          has_emas_certification: boolean | null
          has_employee_handbook: boolean | null
          has_employers_liability_insurance: boolean | null
          has_environmental_policy: boolean | null
          has_epr_car_report: boolean | null
          has_equality_diversity_policy: boolean | null
          has_fors_clocs: boolean | null
          has_gdpr_policy: boolean | null
          has_h_and_s_proceedings: boolean | null
          has_health_safety_policy: boolean | null
          has_iso_14001: boolean | null
          has_iso_9001: boolean | null
          has_minimum_wage_policy: boolean | null
          has_modern_slavery_policy: boolean | null
          has_pda_system: boolean | null
          has_public_liability_insurance: boolean | null
          has_quality_policy: boolean | null
          has_quarterly_return: boolean | null
          has_riddor_incidents: boolean | null
          has_sample_wtn: boolean | null
          has_slavery_investigation: boolean | null
          has_social_media_policy: boolean | null
          has_social_value_policy: boolean | null
          has_sustainability_policy: boolean | null
          has_waste_carriers_licence: boolean | null
          has_waste_management_licence: boolean | null
          has_weighbridge_certificate: boolean | null
          has_whistle_blowing_policy: boolean | null
          id: string
          investigates_accidents: boolean | null
          invoice_day: string | null
          invoicing_software: string | null
          issues_zero_hour_contracts: boolean | null
          operating_systems_used: string | null
          partner_id: string | null
          partner_ranking: string | null
          postcode: string | null
          price_validity_dates: string | null
          provides_ppe: boolean | null
          provides_risk_assessments: boolean | null
          provides_weekly_invoices_wtns: boolean | null
          provides_weights_breakdowns: boolean | null
          responses: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_position: string | null
          reviewed_signature: string | null
          riddor_details: string | null
          services_asbestos: boolean | null
          services_chain_lifts: boolean | null
          services_enclosed_skips: boolean | null
          services_grab_hire: boolean | null
          services_man_in_van: boolean | null
          services_road_sweeper: boolean | null
          services_roll_on_roll_offs: boolean | null
          services_wheelie_bin: boolean | null
          share_token: string
          sheq_responsible_email: string | null
          sheq_responsible_name: string | null
          sheq_responsible_qualification: string | null
          sic_code: string | null
          signatory_name: string | null
          signatory_position: string | null
          signatory_signature: string | null
          signed_at: string | null
          slavery_investigation_details: string | null
          status: string
          submitted_at: string | null
          telephone: string | null
          template_id: string | null
          transfers_waste_to_other_sites: boolean | null
          updated_at: string
          vat_number: string | null
          waste_carriers_licence_number: string | null
          waste_reporting_email: string | null
          waste_reporting_name: string | null
          waste_reporting_phone: string | null
          waste_transfer_details: string | null
          weekly_reporting_notes: string | null
          weights_breakdowns_format: string | null
          wtn_delivery_method: string | null
          wtn_delivery_timing: string | null
          zero_hour_explanation: string | null
        }
        Insert: {
          additional_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          can_provide_prices_by_postcode?: boolean | null
          city?: string | null
          community_programme_details?: string | null
          community_responsible_email?: string | null
          community_responsible_name?: string | null
          community_responsible_phone?: string | null
          company_name: string
          company_registration_number?: string | null
          complies_loler?: boolean | null
          complies_puwer?: boolean | null
          complies_skip_container_safety?: boolean | null
          complies_skip_loader_guidance?: boolean | null
          created_at?: string
          created_by?: string | null
          email_orders?: string | null
          email_remittances?: string | null
          h_and_s_proceedings_details?: string | null
          has_anti_bribery_policy?: boolean | null
          has_bs_8555?: boolean | null
          has_community_programmes?: boolean | null
          has_emas_certification?: boolean | null
          has_employee_handbook?: boolean | null
          has_employers_liability_insurance?: boolean | null
          has_environmental_policy?: boolean | null
          has_epr_car_report?: boolean | null
          has_equality_diversity_policy?: boolean | null
          has_fors_clocs?: boolean | null
          has_gdpr_policy?: boolean | null
          has_h_and_s_proceedings?: boolean | null
          has_health_safety_policy?: boolean | null
          has_iso_14001?: boolean | null
          has_iso_9001?: boolean | null
          has_minimum_wage_policy?: boolean | null
          has_modern_slavery_policy?: boolean | null
          has_pda_system?: boolean | null
          has_public_liability_insurance?: boolean | null
          has_quality_policy?: boolean | null
          has_quarterly_return?: boolean | null
          has_riddor_incidents?: boolean | null
          has_sample_wtn?: boolean | null
          has_slavery_investigation?: boolean | null
          has_social_media_policy?: boolean | null
          has_social_value_policy?: boolean | null
          has_sustainability_policy?: boolean | null
          has_waste_carriers_licence?: boolean | null
          has_waste_management_licence?: boolean | null
          has_weighbridge_certificate?: boolean | null
          has_whistle_blowing_policy?: boolean | null
          id?: string
          investigates_accidents?: boolean | null
          invoice_day?: string | null
          invoicing_software?: string | null
          issues_zero_hour_contracts?: boolean | null
          operating_systems_used?: string | null
          partner_id?: string | null
          partner_ranking?: string | null
          postcode?: string | null
          price_validity_dates?: string | null
          provides_ppe?: boolean | null
          provides_risk_assessments?: boolean | null
          provides_weekly_invoices_wtns?: boolean | null
          provides_weights_breakdowns?: boolean | null
          responses?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_position?: string | null
          reviewed_signature?: string | null
          riddor_details?: string | null
          services_asbestos?: boolean | null
          services_chain_lifts?: boolean | null
          services_enclosed_skips?: boolean | null
          services_grab_hire?: boolean | null
          services_man_in_van?: boolean | null
          services_road_sweeper?: boolean | null
          services_roll_on_roll_offs?: boolean | null
          services_wheelie_bin?: boolean | null
          share_token?: string
          sheq_responsible_email?: string | null
          sheq_responsible_name?: string | null
          sheq_responsible_qualification?: string | null
          sic_code?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          signatory_signature?: string | null
          signed_at?: string | null
          slavery_investigation_details?: string | null
          status?: string
          submitted_at?: string | null
          telephone?: string | null
          template_id?: string | null
          transfers_waste_to_other_sites?: boolean | null
          updated_at?: string
          vat_number?: string | null
          waste_carriers_licence_number?: string | null
          waste_reporting_email?: string | null
          waste_reporting_name?: string | null
          waste_reporting_phone?: string | null
          waste_transfer_details?: string | null
          weekly_reporting_notes?: string | null
          weights_breakdowns_format?: string | null
          wtn_delivery_method?: string | null
          wtn_delivery_timing?: string | null
          zero_hour_explanation?: string | null
        }
        Update: {
          additional_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          can_provide_prices_by_postcode?: boolean | null
          city?: string | null
          community_programme_details?: string | null
          community_responsible_email?: string | null
          community_responsible_name?: string | null
          community_responsible_phone?: string | null
          company_name?: string
          company_registration_number?: string | null
          complies_loler?: boolean | null
          complies_puwer?: boolean | null
          complies_skip_container_safety?: boolean | null
          complies_skip_loader_guidance?: boolean | null
          created_at?: string
          created_by?: string | null
          email_orders?: string | null
          email_remittances?: string | null
          h_and_s_proceedings_details?: string | null
          has_anti_bribery_policy?: boolean | null
          has_bs_8555?: boolean | null
          has_community_programmes?: boolean | null
          has_emas_certification?: boolean | null
          has_employee_handbook?: boolean | null
          has_employers_liability_insurance?: boolean | null
          has_environmental_policy?: boolean | null
          has_epr_car_report?: boolean | null
          has_equality_diversity_policy?: boolean | null
          has_fors_clocs?: boolean | null
          has_gdpr_policy?: boolean | null
          has_h_and_s_proceedings?: boolean | null
          has_health_safety_policy?: boolean | null
          has_iso_14001?: boolean | null
          has_iso_9001?: boolean | null
          has_minimum_wage_policy?: boolean | null
          has_modern_slavery_policy?: boolean | null
          has_pda_system?: boolean | null
          has_public_liability_insurance?: boolean | null
          has_quality_policy?: boolean | null
          has_quarterly_return?: boolean | null
          has_riddor_incidents?: boolean | null
          has_sample_wtn?: boolean | null
          has_slavery_investigation?: boolean | null
          has_social_media_policy?: boolean | null
          has_social_value_policy?: boolean | null
          has_sustainability_policy?: boolean | null
          has_waste_carriers_licence?: boolean | null
          has_waste_management_licence?: boolean | null
          has_weighbridge_certificate?: boolean | null
          has_whistle_blowing_policy?: boolean | null
          id?: string
          investigates_accidents?: boolean | null
          invoice_day?: string | null
          invoicing_software?: string | null
          issues_zero_hour_contracts?: boolean | null
          operating_systems_used?: string | null
          partner_id?: string | null
          partner_ranking?: string | null
          postcode?: string | null
          price_validity_dates?: string | null
          provides_ppe?: boolean | null
          provides_risk_assessments?: boolean | null
          provides_weekly_invoices_wtns?: boolean | null
          provides_weights_breakdowns?: boolean | null
          responses?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_position?: string | null
          reviewed_signature?: string | null
          riddor_details?: string | null
          services_asbestos?: boolean | null
          services_chain_lifts?: boolean | null
          services_enclosed_skips?: boolean | null
          services_grab_hire?: boolean | null
          services_man_in_van?: boolean | null
          services_road_sweeper?: boolean | null
          services_roll_on_roll_offs?: boolean | null
          services_wheelie_bin?: boolean | null
          share_token?: string
          sheq_responsible_email?: string | null
          sheq_responsible_name?: string | null
          sheq_responsible_qualification?: string | null
          sic_code?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          signatory_signature?: string | null
          signed_at?: string | null
          slavery_investigation_details?: string | null
          status?: string
          submitted_at?: string | null
          telephone?: string | null
          template_id?: string | null
          transfers_waste_to_other_sites?: boolean | null
          updated_at?: string
          vat_number?: string | null
          waste_carriers_licence_number?: string | null
          waste_reporting_email?: string | null
          waste_reporting_name?: string | null
          waste_reporting_phone?: string | null
          waste_transfer_details?: string | null
          weekly_reporting_notes?: string | null
          weights_breakdowns_format?: string | null
          wtn_delivery_method?: string | null
          wtn_delivery_timing?: string | null
          zero_hour_explanation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_questionnaires_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_questionnaires_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          company_name: string
          contact_name: string
          contact_role: string
          created_at: string
          email: string
          id: string
          partner_types: string[]
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name: string
          contact_role: string
          created_at?: string
          email: string
          id?: string
          partner_types?: string[]
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          contact_role?: string
          created_at?: string
          email?: string
          id?: string
          partner_types?: string[]
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pda_upload_settings: {
        Row: {
          created_at: string
          id: string
          replace_existing: boolean
          require_job_prefix: boolean
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          replace_existing?: boolean
          require_job_prefix?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          replace_existing?: boolean
          require_job_prefix?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      po_notification_config: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      po_notification_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          recipient_name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          recipient_name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          recipient_name?: string | null
        }
        Relationships: []
      }
      po_pending_changes: {
        Row: {
          changed_by: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          job_date: string | null
          job_id: string
          job_number: string
          new_po_number: string
          notification_email: string | null
          old_po_number: string | null
          sent: boolean
          sent_at: string | null
          site_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name: string
          id?: string
          job_date?: string | null
          job_id: string
          job_number: string
          new_po_number: string
          notification_email?: string | null
          old_po_number?: string | null
          sent?: boolean
          sent_at?: string | null
          site_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          job_date?: string | null
          job_id?: string
          job_number?: string
          new_po_number?: string
          notification_email?: string | null
          old_po_number?: string | null
          sent?: boolean
          sent_at?: string | null
          site_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pod_documents: {
        Row: {
          created_at: string
          customer: string | null
          delivery_date: string | null
          file_name: string
          file_size: number | null
          id: string
          job_number: string | null
          notes: string | null
          site: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer?: string | null
          delivery_date?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          job_number?: string | null
          notes?: string | null
          site?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer?: string | null
          delivery_date?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          job_number?: string | null
          notes?: string | null
          site?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      pod_email_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          digest_date: string
          error_message: string | null
          id: string
          pod_count: number
          pod_ids: string[]
          recipient_email: string
          site: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          digest_date: string
          error_message?: string | null
          id?: string
          pod_count?: number
          pod_ids?: string[]
          recipient_email: string
          site?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          digest_date?: string
          error_message?: string | null
          id?: string
          pod_count?: number
          pod_ids?: string[]
          recipient_email?: string
          site?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_source_folders: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          path?: string
          updated_at?: string
        }
        Relationships: []
      }
      portal_section_visibility: {
        Row: {
          hidden: boolean
          section_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hidden?: boolean
          section_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hidden?: boolean
          section_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      postcode_zones: {
        Row: {
          created_at: string
          display_order: number
          id: string
          postcodes: string[]
          updated_at: string
          zone_name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          postcodes?: string[]
          updated_at?: string
          zone_name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          postcodes?: string[]
          updated_at?: string
          zone_name?: string
        }
        Relationships: []
      }
      pricing_entries: {
        Row: {
          created_at: string
          id: string
          price_ex_vat: number | null
          skip_size_id: string
          status: Database["public"]["Enums"]["pricing_status"]
          tier: string
          updated_at: string
          waste_type_id: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_ex_vat?: number | null
          skip_size_id: string
          status?: Database["public"]["Enums"]["pricing_status"]
          tier?: string
          updated_at?: string
          waste_type_id: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price_ex_vat?: number | null
          skip_size_id?: string
          status?: Database["public"]["Enums"]["pricing_status"]
          tier?: string
          updated_at?: string
          waste_type_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_entries_skip_size_id_fkey"
            columns: ["skip_size_id"]
            isOneToOne: false
            referencedRelation: "pricing_skip_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_entries_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "pricing_waste_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_entries_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "postcode_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rate_card_rows: {
        Row: {
          card_id: string
          created_at: string
          display_order: number
          id: string
          label: string
          note: string | null
          section: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          created_at?: string
          display_order?: number
          id?: string
          label: string
          note?: string | null
          section?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          created_at?: string
          display_order?: number
          id?: string
          label?: string
          note?: string | null
          section?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rate_card_rows_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pricing_rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rate_card_values: {
        Row: {
          created_at: string
          id: string
          price: number | null
          row_id: string
          status: string
          text_value: string | null
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price?: number | null
          row_id: string
          status?: string
          text_value?: string | null
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number | null
          row_id?: string
          status?: string
          text_value?: string | null
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rate_card_values_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "pricing_rate_card_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_rate_card_values_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "pricing_rate_card_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rate_card_zones: {
        Row: {
          card_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          updated_at: string
          zone_code: string
          zone_name: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          updated_at?: string
          zone_code: string
          zone_name?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          updated_at?: string
          zone_code?: string
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rate_card_zones_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pricing_rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rate_cards: {
        Row: {
          agreed_by: string | null
          created_at: string
          customer_id: string | null
          customer_type: string
          effective_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
          vat_inclusive: boolean
        }
        Insert: {
          agreed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_type: string
          effective_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
          vat_inclusive?: boolean
        }
        Update: {
          agreed_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_type?: string
          effective_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
          vat_inclusive?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rate_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      pricing_skip_sizes: {
        Row: {
          created_at: string
          display_name: string
          display_order: number
          id: string
          is_active: boolean
          size_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          display_order?: number
          id?: string
          is_active?: boolean
          size_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          display_order?: number
          id?: string
          is_active?: boolean
          size_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_waste_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          updated_at: string
          waste_type_name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          waste_type_name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          waste_type_name?: string
        }
        Relationships: []
      }
      pricing_zone_postcodes: {
        Row: {
          area: string | null
          created_at: string
          id: string
          notes: string | null
          postcode_prefix: string
          services: string | null
          updated_at: string
          zone_code: string
        }
        Insert: {
          area?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          postcode_prefix: string
          services?: string | null
          updated_at?: string
          zone_code: string
        }
        Update: {
          area?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          postcode_prefix?: string
          services?: string | null
          updated_at?: string
          zone_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          archived_at: string | null
          created_at: string
          driver_number: number | null
          driver_pin: string | null
          email: string
          full_name: string | null
          id: string
          is_archived: boolean
          signature_image: string | null
          updated_at: string
          user_types: Database["public"]["Enums"]["user_type"][] | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          driver_number?: number | null
          driver_pin?: string | null
          email: string
          full_name?: string | null
          id: string
          is_archived?: boolean
          signature_image?: string | null
          updated_at?: string
          user_types?: Database["public"]["Enums"]["user_type"][] | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          driver_number?: number | null
          driver_pin?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_archived?: boolean
          signature_image?: string | null
          updated_at?: string
          user_types?: Database["public"]["Enums"]["user_type"][] | null
        }
        Relationships: []
      }
      questionnaire_fields: {
        Row: {
          created_at: string
          display_order: number
          field_key: string
          field_type: string
          helper_text: string | null
          id: string
          is_required: boolean
          label: string
          options: string[] | null
          placeholder: string | null
          section_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_key: string
          field_type: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          label: string
          options?: string[] | null
          placeholder?: string | null
          section_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          field_key?: string
          field_type?: string
          helper_text?: string | null
          id?: string
          is_required?: boolean
          label?: string
          options?: string[] | null
          placeholder?: string | null
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_fields_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_sections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "questionnaire_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rams: {
        Row: {
          applicable_to: string[] | null
          assigned_users: string[] | null
          created_at: string
          created_date: string
          creator_name: string | null
          creator_signature: string | null
          id: string
          is_mandatory: boolean
          notice_to_drivers: string | null
          notice_to_drivers_pl: string | null
          notice_to_drivers_ro: string | null
          notice_to_drivers_uk: string | null
          reference_code: string
          review_date: string
          signed_at: string | null
          title: string
          title_pl: string | null
          title_ro: string | null
          title_uk: string | null
          updated_at: string
          user_types: string[]
        }
        Insert: {
          applicable_to?: string[] | null
          assigned_users?: string[] | null
          created_at?: string
          created_date?: string
          creator_name?: string | null
          creator_signature?: string | null
          id?: string
          is_mandatory?: boolean
          notice_to_drivers?: string | null
          notice_to_drivers_pl?: string | null
          notice_to_drivers_ro?: string | null
          notice_to_drivers_uk?: string | null
          reference_code: string
          review_date?: string
          signed_at?: string | null
          title: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
          user_types?: string[]
        }
        Update: {
          applicable_to?: string[] | null
          assigned_users?: string[] | null
          created_at?: string
          created_date?: string
          creator_name?: string | null
          creator_signature?: string | null
          id?: string
          is_mandatory?: boolean
          notice_to_drivers?: string | null
          notice_to_drivers_pl?: string | null
          notice_to_drivers_ro?: string | null
          notice_to_drivers_uk?: string | null
          reference_code?: string
          review_date?: string
          signed_at?: string | null
          title?: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
          user_types?: string[]
        }
        Relationships: []
      }
      rams_hazards: {
        Row: {
          activity: string
          activity_pl: string | null
          activity_ro: string | null
          activity_uk: string | null
          control_measures: string
          control_measures_pl: string | null
          control_measures_ro: string | null
          control_measures_uk: string | null
          created_at: string
          display_order: number
          id: string
          initial_likelihood: number
          initial_severity: number
          notes: string | null
          notes_pl: string | null
          notes_ro: string | null
          notes_uk: string | null
          potential_hazard: string
          potential_hazard_pl: string | null
          potential_hazard_ro: string | null
          potential_hazard_uk: string | null
          rams_id: string
          residual_likelihood: number
          residual_severity: number
          updated_at: string
          who_at_risk: string
          who_at_risk_pl: string | null
          who_at_risk_ro: string | null
          who_at_risk_uk: string | null
        }
        Insert: {
          activity: string
          activity_pl?: string | null
          activity_ro?: string | null
          activity_uk?: string | null
          control_measures: string
          control_measures_pl?: string | null
          control_measures_ro?: string | null
          control_measures_uk?: string | null
          created_at?: string
          display_order?: number
          id?: string
          initial_likelihood?: number
          initial_severity?: number
          notes?: string | null
          notes_pl?: string | null
          notes_ro?: string | null
          notes_uk?: string | null
          potential_hazard: string
          potential_hazard_pl?: string | null
          potential_hazard_ro?: string | null
          potential_hazard_uk?: string | null
          rams_id: string
          residual_likelihood?: number
          residual_severity?: number
          updated_at?: string
          who_at_risk: string
          who_at_risk_pl?: string | null
          who_at_risk_ro?: string | null
          who_at_risk_uk?: string | null
        }
        Update: {
          activity?: string
          activity_pl?: string | null
          activity_ro?: string | null
          activity_uk?: string | null
          control_measures?: string
          control_measures_pl?: string | null
          control_measures_ro?: string | null
          control_measures_uk?: string | null
          created_at?: string
          display_order?: number
          id?: string
          initial_likelihood?: number
          initial_severity?: number
          notes?: string | null
          notes_pl?: string | null
          notes_ro?: string | null
          notes_uk?: string | null
          potential_hazard?: string
          potential_hazard_pl?: string | null
          potential_hazard_ro?: string | null
          potential_hazard_uk?: string | null
          rams_id?: string
          residual_likelihood?: number
          residual_severity?: number
          updated_at?: string
          who_at_risk?: string
          who_at_risk_pl?: string | null
          who_at_risk_ro?: string | null
          who_at_risk_uk?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rams_hazards_rams_id_fkey"
            columns: ["rams_id"]
            isOneToOne: false
            referencedRelation: "rams"
            referencedColumns: ["id"]
          },
        ]
      }
      rams_user_signatures: {
        Row: {
          created_at: string
          id: string
          rams_id: string
          signature_image: string | null
          signed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rams_id: string
          signature_image?: string | null
          signed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rams_id?: string
          signature_image?: string | null
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rams_user_signatures_rams_id_fkey"
            columns: ["rams_id"]
            isOneToOne: false
            referencedRelation: "rams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rams_user_signatures_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rebate_email_logs: {
        Row: {
          created_at: string
          customer_id: string
          file_name: string | null
          file_path: string | null
          id: string
          period_end: string
          period_start: string
          rebate_amount: number
          recipient_email: string
          sent_at: string
          sent_by: string | null
          site_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          period_end: string
          period_start: string
          rebate_amount: number
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          site_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          period_end?: string
          period_start?: string
          rebate_amount?: number
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rebate_email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebate_email_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      rebate_items: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      rebate_monthly_values: {
        Row: {
          created_at: string
          higher_range: number | null
          id: string
          item_id: string
          lower_range: number | null
          month_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          higher_range?: number | null
          id?: string
          item_id: string
          lower_range?: number | null
          month_start: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          higher_range?: number | null
          id?: string
          item_id?: string
          lower_range?: number | null
          month_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rebate_monthly_values_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "rebate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      rebate_price_set_items: {
        Row: {
          adjustment: number | null
          created_at: string
          display_order: number
          effective_from: string | null
          effective_to: string | null
          id: string
          price_set_id: string
          rebate_item_id: string
          set_value: number | null
          updated_at: string
          value_type: string
          value_type_item_id: string | null
        }
        Insert: {
          adjustment?: number | null
          created_at?: string
          display_order?: number
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          price_set_id: string
          rebate_item_id: string
          set_value?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
        }
        Update: {
          adjustment?: number | null
          created_at?: string
          display_order?: number
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          price_set_id?: string
          rebate_item_id?: string
          set_value?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rebate_price_set_items_price_set_id_fkey"
            columns: ["price_set_id"]
            isOneToOne: false
            referencedRelation: "rebate_price_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      rebate_price_sets: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      rebate_report_tracking: {
        Row: {
          created_at: string
          customer_id: string
          generated_at: string | null
          generated_by: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          rebate_amount: number | null
          recipient_email: string | null
          sent_at: string | null
          sent_by: string | null
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          rebate_amount?: number | null
          recipient_email?: string | null
          sent_at?: string | null
          sent_by?: string | null
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          generated_at?: string | null
          generated_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          rebate_amount?: number | null
          recipient_email?: string | null
          sent_at?: string | null
          sent_by?: string | null
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rebate_report_tracking_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebate_report_tracking_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      rebate_rules: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          is_enabled: boolean
          rule_key: string
          rule_name: string
          rule_value: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number
          id?: string
          is_enabled?: boolean
          rule_key: string
          rule_name: string
          rule_value?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_enabled?: boolean
          rule_key?: string
          rule_name?: string
          rule_value?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      rental_agreements: {
        Row: {
          agreed_rate: number | null
          chase_id: string | null
          container_type: string | null
          created_at: string
          created_by: string | null
          customer: string | null
          end_date: string | null
          id: string
          notes: string | null
          rate_period: string
          site: string | null
          source: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreed_rate?: number | null
          chase_id?: string | null
          container_type?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          rate_period?: string
          site?: string | null
          source?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreed_rate?: number | null
          chase_id?: string | null
          container_type?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          rate_period?: string
          site?: string | null
          source?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_agreements_chase_id_fkey"
            columns: ["chase_id"]
            isOneToOne: false
            referencedRelation: "rental_chases"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_chase_emails: {
        Row: {
          body: string | null
          chase_id: string
          created_at: string
          id: string
          sent_by: string | null
          subject: string | null
          to_email: string
        }
        Insert: {
          body?: string | null
          chase_id: string
          created_at?: string
          id?: string
          sent_by?: string | null
          subject?: string | null
          to_email: string
        }
        Update: {
          body?: string | null
          chase_id?: string
          created_at?: string
          id?: string
          sent_by?: string | null
          subject?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_chase_emails_chase_id_fkey"
            columns: ["chase_id"]
            isOneToOne: false
            referencedRelation: "rental_chases"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_chases: {
        Row: {
          agreed_amount: number | null
          agreed_date: string | null
          agreed_to_pay: boolean
          assigned_to: string | null
          bin_key: string
          category: string | null
          chase_status: string
          collected: boolean
          collected_date: string | null
          collection_ticket: string | null
          container_type: string | null
          created_at: string
          created_by: string | null
          customer: string | null
          id: string
          notes: string | null
          own_skip: boolean
          site: string | null
          updated_at: string
        }
        Insert: {
          agreed_amount?: number | null
          agreed_date?: string | null
          agreed_to_pay?: boolean
          assigned_to?: string | null
          bin_key: string
          category?: string | null
          chase_status?: string
          collected?: boolean
          collected_date?: string | null
          collection_ticket?: string | null
          container_type?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          notes?: string | null
          own_skip?: boolean
          site?: string | null
          updated_at?: string
        }
        Update: {
          agreed_amount?: number | null
          agreed_date?: string | null
          agreed_to_pay?: boolean
          assigned_to?: string | null
          bin_key?: string
          category?: string | null
          chase_status?: string
          collected?: boolean
          collected_date?: string | null
          collection_ticket?: string | null
          container_type?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          id?: string
          notes?: string | null
          own_skip?: boolean
          site?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_chases_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      riddor_incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          incident_date: string
          notes: string | null
          reported_by: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          incident_date: string
          notes?: string | null
          reported_by?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          incident_date?: string
          notes?: string | null
          reported_by?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_one_booking_windows: {
        Row: {
          created_at: string
          id: string
          note: string | null
          roro_day: string | null
          skip_day: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
          zone_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          roro_day?: string | null
          skip_day?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          zone_label: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          roro_day?: string | null
          skip_day?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          zone_label?: string
        }
        Relationships: []
      }
      route_one_container_types: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_one_cost_items: {
        Row: {
          created_at: string
          default_charge: number
          display_order: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_charge?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_charge?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      route_one_drivers: {
        Row: {
          category: string | null
          created_at: string
          department: number | null
          display_order: number
          driver_name: string
          driver_number: number | null
          id: string
          is_active: boolean
          mobile: string | null
          pin: string | null
          updated_at: string
          user_id: string | null
          username: string | null
          vehicle_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          department?: number | null
          display_order?: number
          driver_name: string
          driver_number?: number | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          pin?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          vehicle_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          department?: number | null
          display_order?: number
          driver_name?: string
          driver_number?: number | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          pin?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_one_drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "route_one_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_one_job_photos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          job_id: string
          photo_type: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          job_id: string
          photo_type?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          job_id?: string
          photo_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_one_job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "route_one_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      route_one_job_types: {
        Row: {
          color: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_one_jobs: {
        Row: {
          account_code: string | null
          assigned_driver_id: string | null
          carrier_name: string | null
          charge_per_tonne: number | null
          completed_at: string | null
          container_size: string | null
          container_type: string | null
          contamination_charge: number | null
          contamination_notes: string | null
          contamination_query_id: string | null
          contamination_type: string | null
          cost_items: Json
          created_at: string
          created_by: string | null
          customer_name: string
          customer_signature: string | null
          customer_signoff_at: string | null
          customer_signoff_name: string | null
          destination_address: string | null
          destination_name: string | null
          directions: string | null
          display_order: number
          disposal_site: string | null
          driver_notes: string | null
          driver_signature: string | null
          driver_signoff_name: string | null
          estimated_duration_mins: number | null
          ewc_code: string | null
          haulage_cost: number | null
          id: string
          invoice_address: string | null
          is_live: boolean
          job_number: string
          job_type: Database["public"]["Enums"]["route_one_job_type"]
          min_weight_charge: number | null
          notes: string | null
          outbound_weight_t: number | null
          po_number: string | null
          query_reason: string | null
          scheduled_date: string
          scheduled_time: string | null
          sic_code: string | null
          site_address: string | null
          site_address_2: string | null
          site_area: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          site_name: string | null
          site_postcode: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["route_one_job_status"]
          total_inc_vat: number | null
          total_net: number | null
          updated_at: string
          vat_rate: number
          vehicle_reg: string | null
          waste_type: string | null
          weighbridge_ticket_number: string | null
          weighbridge_transaction_id: string | null
          weight_included_t: number | null
        }
        Insert: {
          account_code?: string | null
          assigned_driver_id?: string | null
          carrier_name?: string | null
          charge_per_tonne?: number | null
          completed_at?: string | null
          container_size?: string | null
          container_type?: string | null
          contamination_charge?: number | null
          contamination_notes?: string | null
          contamination_query_id?: string | null
          contamination_type?: string | null
          cost_items?: Json
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_signature?: string | null
          customer_signoff_at?: string | null
          customer_signoff_name?: string | null
          destination_address?: string | null
          destination_name?: string | null
          directions?: string | null
          display_order?: number
          disposal_site?: string | null
          driver_notes?: string | null
          driver_signature?: string | null
          driver_signoff_name?: string | null
          estimated_duration_mins?: number | null
          ewc_code?: string | null
          haulage_cost?: number | null
          id?: string
          invoice_address?: string | null
          is_live?: boolean
          job_number?: string
          job_type?: Database["public"]["Enums"]["route_one_job_type"]
          min_weight_charge?: number | null
          notes?: string | null
          outbound_weight_t?: number | null
          po_number?: string | null
          query_reason?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          sic_code?: string | null
          site_address?: string | null
          site_address_2?: string | null
          site_area?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_name?: string | null
          site_postcode?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["route_one_job_status"]
          total_inc_vat?: number | null
          total_net?: number | null
          updated_at?: string
          vat_rate?: number
          vehicle_reg?: string | null
          waste_type?: string | null
          weighbridge_ticket_number?: string | null
          weighbridge_transaction_id?: string | null
          weight_included_t?: number | null
        }
        Update: {
          account_code?: string | null
          assigned_driver_id?: string | null
          carrier_name?: string | null
          charge_per_tonne?: number | null
          completed_at?: string | null
          container_size?: string | null
          container_type?: string | null
          contamination_charge?: number | null
          contamination_notes?: string | null
          contamination_query_id?: string | null
          contamination_type?: string | null
          cost_items?: Json
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_signature?: string | null
          customer_signoff_at?: string | null
          customer_signoff_name?: string | null
          destination_address?: string | null
          destination_name?: string | null
          directions?: string | null
          display_order?: number
          disposal_site?: string | null
          driver_notes?: string | null
          driver_signature?: string | null
          driver_signoff_name?: string | null
          estimated_duration_mins?: number | null
          ewc_code?: string | null
          haulage_cost?: number | null
          id?: string
          invoice_address?: string | null
          is_live?: boolean
          job_number?: string
          job_type?: Database["public"]["Enums"]["route_one_job_type"]
          min_weight_charge?: number | null
          notes?: string | null
          outbound_weight_t?: number | null
          po_number?: string | null
          query_reason?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          sic_code?: string | null
          site_address?: string | null
          site_address_2?: string | null
          site_area?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          site_name?: string | null
          site_postcode?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["route_one_job_status"]
          total_inc_vat?: number | null
          total_net?: number | null
          updated_at?: string
          vat_rate?: number
          vehicle_reg?: string | null
          waste_type?: string | null
          weighbridge_ticket_number?: string | null
          weighbridge_transaction_id?: string | null
          weight_included_t?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_one_jobs_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "route_one_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_one_jobs_weighbridge_transaction_id_fkey"
            columns: ["weighbridge_transaction_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      route_one_vehicles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          make_model: string | null
          registration: string
          tare_weight_kg: number | null
          updated_at: string
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          make_model?: string | null
          registration: string
          tare_weight_kg?: number | null
          updated_at?: string
          vehicle_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          make_model?: string | null
          registration?: string
          tare_weight_kg?: number | null
          updated_at?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      site_inspection_reports: {
        Row: {
          actions_required: string | null
          created_at: string
          electrical_cables_secure: string | null
          electrical_comments: string | null
          electrical_equipment_condition: string | null
          electrical_pat_testing: string | null
          environmental_comments: string | null
          environmental_drainage: string | null
          environmental_spill_kits: string | null
          environmental_waste_segregation: string | null
          equipment_comments: string | null
          equipment_condition: string | null
          equipment_guarding: string | null
          equipment_maintenance_records: string | null
          fire_assembly_point_clear: string | null
          fire_exits_clear: string | null
          fire_extinguishers_accessible: string | null
          fire_safety_comments: string | null
          fire_signage_visible: string | null
          first_aid_comments: string | null
          first_aid_kit_stocked: string | null
          first_aid_signage: string | null
          first_aid_trained_personnel: string | null
          housekeeping_comments: string | null
          housekeeping_general_cleanliness: string | null
          housekeeping_storage_areas: string | null
          housekeeping_walkways_clear: string | null
          housekeeping_waste_disposal: string | null
          id: string
          inspector_name: string
          overall_comments: string | null
          ppe_available: string | null
          ppe_being_worn: string | null
          ppe_comments: string | null
          ppe_condition: string | null
          report_date: string
          signature_image: string | null
          site_location: string
          status: string
          submitted_at: string | null
          todo_items: Json | null
          updated_at: string
          user_id: string | null
          welfare_comments: string | null
          welfare_drinking_water: string | null
          welfare_rest_areas: string | null
          welfare_toilets_clean: string | null
        }
        Insert: {
          actions_required?: string | null
          created_at?: string
          electrical_cables_secure?: string | null
          electrical_comments?: string | null
          electrical_equipment_condition?: string | null
          electrical_pat_testing?: string | null
          environmental_comments?: string | null
          environmental_drainage?: string | null
          environmental_spill_kits?: string | null
          environmental_waste_segregation?: string | null
          equipment_comments?: string | null
          equipment_condition?: string | null
          equipment_guarding?: string | null
          equipment_maintenance_records?: string | null
          fire_assembly_point_clear?: string | null
          fire_exits_clear?: string | null
          fire_extinguishers_accessible?: string | null
          fire_safety_comments?: string | null
          fire_signage_visible?: string | null
          first_aid_comments?: string | null
          first_aid_kit_stocked?: string | null
          first_aid_signage?: string | null
          first_aid_trained_personnel?: string | null
          housekeeping_comments?: string | null
          housekeeping_general_cleanliness?: string | null
          housekeeping_storage_areas?: string | null
          housekeeping_walkways_clear?: string | null
          housekeeping_waste_disposal?: string | null
          id?: string
          inspector_name: string
          overall_comments?: string | null
          ppe_available?: string | null
          ppe_being_worn?: string | null
          ppe_comments?: string | null
          ppe_condition?: string | null
          report_date?: string
          signature_image?: string | null
          site_location: string
          status?: string
          submitted_at?: string | null
          todo_items?: Json | null
          updated_at?: string
          user_id?: string | null
          welfare_comments?: string | null
          welfare_drinking_water?: string | null
          welfare_rest_areas?: string | null
          welfare_toilets_clean?: string | null
        }
        Update: {
          actions_required?: string | null
          created_at?: string
          electrical_cables_secure?: string | null
          electrical_comments?: string | null
          electrical_equipment_condition?: string | null
          electrical_pat_testing?: string | null
          environmental_comments?: string | null
          environmental_drainage?: string | null
          environmental_spill_kits?: string | null
          environmental_waste_segregation?: string | null
          equipment_comments?: string | null
          equipment_condition?: string | null
          equipment_guarding?: string | null
          equipment_maintenance_records?: string | null
          fire_assembly_point_clear?: string | null
          fire_exits_clear?: string | null
          fire_extinguishers_accessible?: string | null
          fire_safety_comments?: string | null
          fire_signage_visible?: string | null
          first_aid_comments?: string | null
          first_aid_kit_stocked?: string | null
          first_aid_signage?: string | null
          first_aid_trained_personnel?: string | null
          housekeeping_comments?: string | null
          housekeeping_general_cleanliness?: string | null
          housekeeping_storage_areas?: string | null
          housekeeping_walkways_clear?: string | null
          housekeeping_waste_disposal?: string | null
          id?: string
          inspector_name?: string
          overall_comments?: string | null
          ppe_available?: string | null
          ppe_being_worn?: string | null
          ppe_comments?: string | null
          ppe_condition?: string | null
          report_date?: string
          signature_image?: string | null
          site_location?: string
          status?: string
          submitted_at?: string | null
          todo_items?: Json | null
          updated_at?: string
          user_id?: string | null
          welfare_comments?: string | null
          welfare_drinking_water?: string | null
          welfare_rest_areas?: string | null
          welfare_toilets_clean?: string | null
        }
        Relationships: []
      }
      skip_inventory: {
        Row: {
          asset_number: string
          asset_type: string
          condition: string | null
          created_at: string
          id: string
          last_cataloged_at: string | null
          last_location: string | null
          last_reported_by: string | null
          last_skiptrak_ticket: string | null
          notes: string | null
          office_verified: boolean
          photos: Json
          repair_notes: string | null
          repairs_required: boolean
          size: string | null
          tags: string[]
          updated_at: string
          value_override: number | null
        }
        Insert: {
          asset_number: string
          asset_type?: string
          condition?: string | null
          created_at?: string
          id?: string
          last_cataloged_at?: string | null
          last_location?: string | null
          last_reported_by?: string | null
          last_skiptrak_ticket?: string | null
          notes?: string | null
          office_verified?: boolean
          photos?: Json
          repair_notes?: string | null
          repairs_required?: boolean
          size?: string | null
          tags?: string[]
          updated_at?: string
          value_override?: number | null
        }
        Update: {
          asset_number?: string
          asset_type?: string
          condition?: string | null
          created_at?: string
          id?: string
          last_cataloged_at?: string | null
          last_location?: string | null
          last_reported_by?: string | null
          last_skiptrak_ticket?: string | null
          notes?: string | null
          office_verified?: boolean
          photos?: Json
          repair_notes?: string | null
          repairs_required?: boolean
          size?: string | null
          tags?: string[]
          updated_at?: string
          value_override?: number | null
        }
        Relationships: []
      }
      skip_inventory_condition_values: {
        Row: {
          asset_type: string
          condition: string
          created_at: string
          id: string
          size_group: string | null
          sizes: string[]
          updated_at: string
          value: number
        }
        Insert: {
          asset_type: string
          condition: string
          created_at?: string
          id?: string
          size_group?: string | null
          sizes?: string[]
          updated_at?: string
          value?: number
        }
        Update: {
          asset_type?: string
          condition?: string
          created_at?: string
          id?: string
          size_group?: string | null
          sizes?: string[]
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      skip_inventory_sizes: {
        Row: {
          asset_type: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      skip_inventory_tags: {
        Row: {
          colour: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          colour?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          colour?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      skip_tracker_reports: {
        Row: {
          asset_number: string
          asset_type: string
          condition: string | null
          created_at: string
          id: string
          inventory_id: string | null
          location: string | null
          photos: Json
          points_awarded: number
          repair_notes: string | null
          repairs_required: boolean
          reporter_driver_id: string | null
          reporter_name: string
          skiptrak_ticket: string | null
        }
        Insert: {
          asset_number: string
          asset_type?: string
          condition?: string | null
          created_at?: string
          id?: string
          inventory_id?: string | null
          location?: string | null
          photos?: Json
          points_awarded?: number
          repair_notes?: string | null
          repairs_required?: boolean
          reporter_driver_id?: string | null
          reporter_name: string
          skiptrak_ticket?: string | null
        }
        Update: {
          asset_number?: string
          asset_type?: string
          condition?: string | null
          created_at?: string
          id?: string
          inventory_id?: string | null
          location?: string | null
          photos?: Json
          points_awarded?: number
          repair_notes?: string | null
          repairs_required?: boolean
          reporter_driver_id?: string | null
          reporter_name?: string
          skiptrak_ticket?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skip_tracker_reports_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "skip_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      skip_tracker_settings: {
        Row: {
          auto_clear_photo_tag: boolean
          created_at: string
          id: string
          photos_required: number
          updated_at: string
        }
        Insert: {
          auto_clear_photo_tag?: boolean
          created_at?: string
          id?: string
          photos_required?: number
          updated_at?: string
        }
        Update: {
          auto_clear_photo_tag?: boolean
          created_at?: string
          id?: string
          photos_required?: number
          updated_at?: string
        }
        Relationships: []
      }
      staci_monthly_reports: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          period_end: string
          period_start: string
          report_data: Json
          signature_image: string | null
          signed_at: string | null
          signed_by: string | null
          signer_name: string | null
          signer_position: string | null
          site_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          period_end: string
          period_start: string
          report_data?: Json
          signature_image?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_name?: string | null
          signer_position?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          period_end?: string
          period_start?: string
          report_data?: Json
          signature_image?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signer_name?: string | null
          signer_position?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staci_monthly_reports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staci_monthly_reports_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      staci_pallet_charges: {
        Row: {
          charge_key: string
          charge_value: number
          created_at: string
          effective_from: string
          id: string
          updated_at: string
        }
        Insert: {
          charge_key: string
          charge_value?: number
          created_at?: string
          effective_from: string
          id?: string
          updated_at?: string
        }
        Update: {
          charge_key?: string
          charge_value?: number
          created_at?: string
          effective_from?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      staci_pallet_entries: {
        Row: {
          colour: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          load_report_id: string
          pallet_count: number
          pallet_type: string | null
          updated_at: string
          waste_breakdown: Json | null
          weight_kg: number
        }
        Insert: {
          colour: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          load_report_id: string
          pallet_count?: number
          pallet_type?: string | null
          updated_at?: string
          waste_breakdown?: Json | null
          weight_kg?: number
        }
        Update: {
          colour?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          load_report_id?: string
          pallet_count?: number
          pallet_type?: string | null
          updated_at?: string
          waste_breakdown?: Json | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "staci_pallet_entries_load_report_id_fkey"
            columns: ["load_report_id"]
            isOneToOne: false
            referencedRelation: "load_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      staci_pallet_rates: {
        Row: {
          colour: string
          created_at: string
          effective_from: string
          id: string
          rate: number
          updated_at: string
        }
        Insert: {
          colour: string
          created_at?: string
          effective_from: string
          id?: string
          rate?: number
          updated_at?: string
        }
        Update: {
          colour?: string
          created_at?: string
          effective_from?: string
          id?: string
          rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_check_container_types: {
        Row: {
          category: string
          created_at: string
          data_hub_keywords: string[] | null
          default_runner: number
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          data_hub_keywords?: string[] | null
          default_runner?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          data_hub_keywords?: string[] | null
          default_runner?: number
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_check_daily_entries: {
        Row: {
          actual_in: number | null
          actual_out: number | null
          container_type_id: string
          created_at: string
          entry_date: string
          id: string
          projected_in: number
          projected_out: number
          stock_check_id: string
          updated_at: string
        }
        Insert: {
          actual_in?: number | null
          actual_out?: number | null
          container_type_id: string
          created_at?: string
          entry_date: string
          id?: string
          projected_in?: number
          projected_out?: number
          stock_check_id: string
          updated_at?: string
        }
        Update: {
          actual_in?: number | null
          actual_out?: number | null
          container_type_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          projected_in?: number
          projected_out?: number
          stock_check_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_check_daily_entries_container_type_id_fkey"
            columns: ["container_type_id"]
            isOneToOne: false
            referencedRelation: "stock_check_container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_check_daily_entries_stock_check_id_fkey"
            columns: ["stock_check_id"]
            isOneToOne: false
            referencedRelation: "stock_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_check_ewc_reclass_rules: {
        Row: {
          created_at: string
          ewc_codes: string[]
          from_type_id: string
          id: string
          is_active: boolean
          to_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ewc_codes?: string[]
          from_type_id: string
          id?: string
          is_active?: boolean
          to_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ewc_codes?: string[]
          from_type_id?: string
          id?: string
          is_active?: boolean
          to_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_check_ewc_reclass_rules_from_type_id_fkey"
            columns: ["from_type_id"]
            isOneToOne: false
            referencedRelation: "stock_check_container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_check_ewc_reclass_rules_to_type_id_fkey"
            columns: ["to_type_id"]
            isOneToOne: false
            referencedRelation: "stock_check_container_types"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_check_excluded_sites: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          site_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          site_name: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          site_name?: string
        }
        Relationships: []
      }
      stock_check_items: {
        Row: {
          container_type_id: string
          created_at: string
          id: string
          in_yard: number
          notes: string | null
          runner: number
          stock_check_id: string
          updated_at: string
        }
        Insert: {
          container_type_id: string
          created_at?: string
          id?: string
          in_yard?: number
          notes?: string | null
          runner?: number
          stock_check_id: string
          updated_at?: string
        }
        Update: {
          container_type_id?: string
          created_at?: string
          id?: string
          in_yard?: number
          notes?: string | null
          runner?: number
          stock_check_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_check_items_container_type_id_fkey"
            columns: ["container_type_id"]
            isOneToOne: false
            referencedRelation: "stock_check_container_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_check_items_stock_check_id_fkey"
            columns: ["stock_check_id"]
            isOneToOne: false
            referencedRelation: "stock_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_checks: {
        Row: {
          check_date: string
          created_at: string
          data_hub_sync_enabled: boolean
          id: string
          notes: string | null
          operator_id: string | null
          operator_name: string
          status: string
          updated_at: string
          week_commencing: string
        }
        Insert: {
          check_date?: string
          created_at?: string
          data_hub_sync_enabled?: boolean
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name: string
          status?: string
          updated_at?: string
          week_commencing?: string
        }
        Update: {
          check_date?: string
          created_at?: string
          data_hub_sync_enabled?: boolean
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string
          status?: string
          updated_at?: string
          week_commencing?: string
        }
        Relationships: []
      }
      stock_report_email_settings: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          recipient_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          recipient_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          recipient_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_report_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          material: string
          on_stock: number
          out: number
          stock_report_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          material: string
          on_stock?: number
          out?: number
          stock_report_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          material?: string
          on_stock?: number
          out?: number
          stock_report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_report_items_stock_report_id_fkey"
            columns: ["stock_report_id"]
            isOneToOne: false
            referencedRelation: "stock_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reports: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          operator_id: string | null
          operator_name: string
          report_date: string
          total_on_stock: number
          total_out: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name: string
          report_date?: string
          total_on_stock?: number
          total_out?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string
          report_date?: string
          total_on_stock?: number
          total_out?: number
          updated_at?: string
        }
        Relationships: []
      }
      toolbox_talk_signatures: {
        Row: {
          created_at: string
          id: string
          signature_image: string | null
          signed_at: string
          toolbox_talk_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          signature_image?: string | null
          signed_at?: string
          toolbox_talk_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          signature_image?: string | null
          signed_at?: string
          toolbox_talk_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolbox_talk_signatures_toolbox_talk_id_fkey"
            columns: ["toolbox_talk_id"]
            isOneToOne: false
            referencedRelation: "toolbox_talks"
            referencedColumns: ["id"]
          },
        ]
      }
      toolbox_talks: {
        Row: {
          assigned_users: string[] | null
          content: string
          content_pl: string | null
          content_ro: string | null
          content_uk: string | null
          created_at: string
          created_date: string
          id: string
          is_mandatory: boolean
          is_published: boolean
          reference_code: string
          title: string
          title_pl: string | null
          title_ro: string | null
          title_uk: string | null
          updated_at: string
          user_types: string[]
        }
        Insert: {
          assigned_users?: string[] | null
          content: string
          content_pl?: string | null
          content_ro?: string | null
          content_uk?: string | null
          created_at?: string
          created_date?: string
          id?: string
          is_mandatory?: boolean
          is_published?: boolean
          reference_code: string
          title: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
          user_types?: string[]
        }
        Update: {
          assigned_users?: string[] | null
          content?: string
          content_pl?: string | null
          content_ro?: string | null
          content_uk?: string | null
          created_at?: string
          created_date?: string
          id?: string
          is_mandatory?: boolean
          is_published?: boolean
          reference_code?: string
          title?: string
          title_pl?: string | null
          title_ro?: string | null
          title_uk?: string | null
          updated_at?: string
          user_types?: string[]
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
      waste_stream_values: {
        Row: {
          additional_processing: number
          created_at: string
          haulage: number
          id: string
          is_recovery: boolean
          processes: string | null
          share: number
          sort_order: number
          stream: string
          updated_at: string
          waste_cost: number
        }
        Insert: {
          additional_processing?: number
          created_at?: string
          haulage?: number
          id?: string
          is_recovery?: boolean
          processes?: string | null
          share?: number
          sort_order?: number
          stream: string
          updated_at?: string
          waste_cost?: number
        }
        Update: {
          additional_processing?: number
          created_at?: string
          haulage?: number
          id?: string
          is_recovery?: boolean
          processes?: string | null
          share?: number
          sort_order?: number
          stream?: string
          updated_at?: string
          waste_cost?: number
        }
        Relationships: []
      }
      waste_value_settings: {
        Row: {
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      weighbridge_additional_items: {
        Row: {
          cost: number
          created_at: string
          description: string
          display_order: number
          id: string
          transaction_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          display_order?: number
          id?: string
          transaction_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weighbridge_additional_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      weighbridge_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          kind: string
          notes: string | null
          storage_path: string
          transaction_id: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          kind?: string
          notes?: string | null
          storage_path: string
          transaction_id: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          kind?: string
          notes?: string | null
          storage_path?: string
          transaction_id?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weighbridge_attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      weighbridge_customers: {
        Row: {
          carrier_name: string | null
          carrier_registration: string | null
          created_at: string
          customer_name: string
          id: string
          is_active: boolean
          rate_group_id: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          carrier_registration?: string | null
          created_at?: string
          customer_name: string
          id?: string
          is_active?: boolean
          rate_group_id?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          carrier_registration?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_active?: boolean
          rate_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weighbridge_customers_rate_group_id_fkey"
            columns: ["rate_group_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_rate_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      weighbridge_item_templates: {
        Row: {
          cost: number
          created_at: string
          display_order: number
          ewc_code: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      weighbridge_rate_group_prices: {
        Row: {
          created_at: string
          id: string
          min_charge: number
          price_per_tonne: number
          rate_group_id: string
          updated_at: string
          waste_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_charge?: number
          price_per_tonne?: number
          rate_group_id: string
          updated_at?: string
          waste_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_charge?: number
          price_per_tonne?: number
          rate_group_id?: string
          updated_at?: string
          waste_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weighbridge_rate_group_prices_rate_group_id_fkey"
            columns: ["rate_group_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_rate_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighbridge_rate_group_prices_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      weighbridge_rate_groups: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      weighbridge_transactions: {
        Row: {
          additional_items_total: number | null
          carrier_name: string | null
          carrier_registration: string | null
          container_type: string | null
          created_at: string
          customer: string | null
          driver_name: string | null
          driver_signature: string | null
          ewc_code: string | null
          first_weigh_at: string | null
          gross_weight_kg: number | null
          id: string
          job_type: string | null
          linked_job_date: string | null
          linked_job_number: string | null
          linked_job_source: string | null
          means_of_transport: string | null
          min_charge: number | null
          net_weight_kg: number | null
          notes: string | null
          operator_id: string | null
          operator_name: string | null
          operator_signature: string | null
          physical_form: string | null
          price_per_tonne: number | null
          rate_group_id: string | null
          second_weigh_at: string | null
          site: string | null
          status: Database["public"]["Enums"]["weighbridge_status"]
          tare_weight_kg: number | null
          ticket_number: string
          total_price: number | null
          updated_at: string
          vehicle_reg: string
          vehicle_type: string | null
          waste_description: string | null
          waste_type_id: string | null
          weight_charge: number | null
        }
        Insert: {
          additional_items_total?: number | null
          carrier_name?: string | null
          carrier_registration?: string | null
          container_type?: string | null
          created_at?: string
          customer?: string | null
          driver_name?: string | null
          driver_signature?: string | null
          ewc_code?: string | null
          first_weigh_at?: string | null
          gross_weight_kg?: number | null
          id?: string
          job_type?: string | null
          linked_job_date?: string | null
          linked_job_number?: string | null
          linked_job_source?: string | null
          means_of_transport?: string | null
          min_charge?: number | null
          net_weight_kg?: number | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          operator_signature?: string | null
          physical_form?: string | null
          price_per_tonne?: number | null
          rate_group_id?: string | null
          second_weigh_at?: string | null
          site?: string | null
          status?: Database["public"]["Enums"]["weighbridge_status"]
          tare_weight_kg?: number | null
          ticket_number: string
          total_price?: number | null
          updated_at?: string
          vehicle_reg: string
          vehicle_type?: string | null
          waste_description?: string | null
          waste_type_id?: string | null
          weight_charge?: number | null
        }
        Update: {
          additional_items_total?: number | null
          carrier_name?: string | null
          carrier_registration?: string | null
          container_type?: string | null
          created_at?: string
          customer?: string | null
          driver_name?: string | null
          driver_signature?: string | null
          ewc_code?: string | null
          first_weigh_at?: string | null
          gross_weight_kg?: number | null
          id?: string
          job_type?: string | null
          linked_job_date?: string | null
          linked_job_number?: string | null
          linked_job_source?: string | null
          means_of_transport?: string | null
          min_charge?: number | null
          net_weight_kg?: number | null
          notes?: string | null
          operator_id?: string | null
          operator_name?: string | null
          operator_signature?: string | null
          physical_form?: string | null
          price_per_tonne?: number | null
          rate_group_id?: string | null
          second_weigh_at?: string | null
          site?: string | null
          status?: Database["public"]["Enums"]["weighbridge_status"]
          tare_weight_kg?: number | null
          ticket_number?: string
          total_price?: number | null
          updated_at?: string
          vehicle_reg?: string
          vehicle_type?: string | null
          waste_description?: string | null
          waste_type_id?: string | null
          weight_charge?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weighbridge_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighbridge_transactions_rate_group_id_fkey"
            columns: ["rate_group_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_rate_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighbridge_transactions_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "weighbridge_waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      weighbridge_vehicles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          vehicle_reg: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          vehicle_reg: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          vehicle_reg?: string
        }
        Relationships: []
      }
      weighbridge_waste_types: {
        Row: {
          created_at: string
          display_order: number
          ewc_code: string | null
          id: string
          is_active: boolean
          min_charge: number
          price_per_tonne: number
          updated_at: string
          waste_type: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          id?: string
          is_active?: boolean
          min_charge?: number
          price_per_tonne?: number
          updated_at?: string
          waste_type: string
        }
        Update: {
          created_at?: string
          display_order?: number
          ewc_code?: string | null
          id?: string
          is_active?: boolean
          min_charge?: number
          price_per_tonne?: number
          updated_at?: string
          waste_type?: string
        }
        Relationships: []
      }
      wtn_document_images: {
        Row: {
          created_at: string
          document_id: string
          height: number | null
          id: string
          kind: string
          page: number | null
          sort_order: number
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          document_id: string
          height?: number | null
          id?: string
          kind?: string
          page?: number | null
          sort_order?: number
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          document_id?: string
          height?: number | null
          id?: string
          kind?: string
          page?: number | null
          sort_order?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wtn_document_images_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "wtn_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      wtn_documents: {
        Row: {
          created_at: string
          customer: string | null
          customer_name: string | null
          customer_signature_path: string | null
          driver_name: string | null
          driver_signature_path: string | null
          email_from: string | null
          email_subject: string | null
          file_name: string
          file_size: number | null
          id: string
          job_date: string | null
          job_number: string | null
          parse_error: string | null
          parse_status: string
          parsed_at: string | null
          received_via: string
          site: string | null
          source: string
          storage_path: string
          text_content: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer?: string | null
          customer_name?: string | null
          customer_signature_path?: string | null
          driver_name?: string | null
          driver_signature_path?: string | null
          email_from?: string | null
          email_subject?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          job_date?: string | null
          job_number?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          received_via?: string
          site?: string | null
          source?: string
          storage_path: string
          text_content?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer?: string | null
          customer_name?: string | null
          customer_signature_path?: string | null
          driver_name?: string | null
          driver_signature_path?: string | null
          email_from?: string | null
          email_subject?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          job_date?: string | null
          job_number?: string | null
          parse_error?: string | null
          parse_status?: string
          parsed_at?: string | null
          received_via?: string
          site?: string | null
          source?: string
          storage_path?: string
          text_content?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      wtn_ticket_templates: {
        Row: {
          created_at: string
          html: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          html: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          html?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      yard_incentive_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      yard_staff: {
        Row: {
          created_at: string
          department: string | null
          display_order: number
          id: string
          is_active: boolean
          pin: string | null
          staff_name: string
          staff_number: number | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          pin?: string | null
          staff_name: string
          staff_number?: number | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          pin?: string | null
          staff_name?: string
          staff_number?: number | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_portal_user_access_data_hub_job: {
        Args: { _job_customer: string; _job_site: string; _user_id: string }
        Returns: boolean
      }
      crm_match_customer_by_email: { Args: { _email: string }; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      get_customer_activity_summary: {
        Args: never
        Returns: {
          contact_count: number
          customer_code: string
          customer_id: string
          customer_name: string
          is_inactive: boolean
          job_count: number
          last_activity_date: string
          site_count: number
        }[]
      }
      get_midweigh_container_types: {
        Args: never
        Returns: {
          container_type: string
          vehicle_type: string
        }[]
      }
      get_skiptrak_customer_sites: {
        Args: never
        Returns: {
          customer: string
          site: string
        }[]
      }
      get_skiptrak_rental_positions: {
        Args: never
        Returns: {
          collected: number
          container_type: string
          customer: string
          delivered: number
          ewc: string
          exchanged: number
          last_collection_date: string
          last_job_number: string
          last_keep_date: string
          site: string
          tipreturn: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_finance_user: { Args: { _user_id: string }; Returns: boolean }
      is_management: { Args: { _user_id: string }; Returns: boolean }
      lookup_job_weights: {
        Args: { pairs: Json }
        Returns: {
          container_type: string
          customer: string
          job_date: string
          job_number: string
          order_number: string
          postcode: string
          site: string
          source: string
          waste_description: string
          weight_t: number
        }[]
      }
      next_invoice_number: { Args: never; Returns: string }
      user_has_reconomy_membership: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "finance"
      booking_status:
        | "pending"
        | "confirmed"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
      pricing_status: "price" | "call_for_quote" | "not_available"
      route_one_job_status:
        | "unassigned"
        | "assigned"
        | "in_progress"
        | "completed"
        | "query"
      route_one_job_type:
        | "delivery"
        | "exchange"
        | "collection"
        | "waste_truck"
        | "wasted_journey"
        | "waste_out_skip"
      skip_material_type: "card_loose" | "scrap_metal"
      user_type: "driver" | "yard" | "office" | "management"
      weighbridge_status: "first_weigh" | "completed" | "voided"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user", "finance"],
      booking_status: [
        "pending",
        "confirmed",
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
      ],
      pricing_status: ["price", "call_for_quote", "not_available"],
      route_one_job_status: [
        "unassigned",
        "assigned",
        "in_progress",
        "completed",
        "query",
      ],
      route_one_job_type: [
        "delivery",
        "exchange",
        "collection",
        "waste_truck",
        "wasted_journey",
        "waste_out_skip",
      ],
      skip_material_type: ["card_loose", "scrap_metal"],
      user_type: ["driver", "yard", "office", "management"],
      weighbridge_status: ["first_weigh", "completed", "voided"],
    },
  },
} as const
