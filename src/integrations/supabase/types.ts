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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
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
      customer_site_price_sets: {
        Row: {
          created_at: string
          id: string
          price_set_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_set_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
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
            isOneToOne: true
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
          id: string
          material_type: Database["public"]["Enums"]["skip_material_type"]
          rebate_enabled: boolean | null
          set_value: number | null
          site_id: string
          threshold_tonnes: number | null
          updated_at: string
          value_type: string
          value_type_item_id: string | null
        }
        Insert: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          id?: string
          material_type: Database["public"]["Enums"]["skip_material_type"]
          rebate_enabled?: boolean | null
          set_value?: number | null
          site_id: string
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
        }
        Update: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          id?: string
          material_type?: Database["public"]["Enums"]["skip_material_type"]
          rebate_enabled?: boolean | null
          set_value?: number | null
          site_id?: string
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
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
          created_at: string
          customer_id: string
          data_hub_customer: string | null
          data_hub_site: string | null
          data_hub_site_2: string | null
          data_hub_site_3: string | null
          data_hub_site_4: string | null
          data_hub_site_5: string | null
          id: string
          load_report_type: string | null
          owner_contact_id: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          data_hub_customer?: string | null
          data_hub_site?: string | null
          data_hub_site_2?: string | null
          data_hub_site_3?: string | null
          data_hub_site_4?: string | null
          data_hub_site_5?: string | null
          id?: string
          load_report_type?: string | null
          owner_contact_id?: string | null
          site_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          data_hub_customer?: string | null
          data_hub_site?: string | null
          data_hub_site_2?: string | null
          data_hub_site_3?: string | null
          data_hub_site_4?: string | null
          data_hub_site_5?: string | null
          id?: string
          load_report_type?: string | null
          owner_contact_id?: string | null
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
          id: string
          material_type: string
          rebate_enabled: boolean | null
          set_value: number | null
          threshold_tonnes: number | null
          updated_at: string
          value_type: string
          value_type_item_id: string | null
        }
        Insert: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          customer_id: string
          id?: string
          material_type: string
          rebate_enabled?: boolean | null
          set_value?: number | null
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
        }
        Update: {
          adjustment?: number | null
          container_type_filter?: string[] | null
          created_at?: string
          customer_id?: string
          id?: string
          material_type?: string
          rebate_enabled?: boolean | null
          set_value?: number | null
          threshold_tonnes?: number | null
          updated_at?: string
          value_type?: string
          value_type_item_id?: string | null
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
          created_at: string
          customer_code: string
          customer_name: string
          id: string
          po_notification_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_code: string
          customer_name: string
          id?: string
          po_notification_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_code?: string
          customer_name?: string
          id?: string
          po_notification_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_hub_jobs: {
        Row: {
          category: string | null
          container_type: string | null
          created_at: string
          customer: string | null
          ewc: string | null
          id: string
          job_date: string | null
          job_number: string
          job_type: string | null
          movement_type: string | null
          order_number_override: string | null
          raw: Json
          site: string | null
          source: string
          updated_at: string
          vehicle_registration: string | null
          waste_description: string | null
          weight_t: number | null
        }
        Insert: {
          category?: string | null
          container_type?: string | null
          created_at?: string
          customer?: string | null
          ewc?: string | null
          id?: string
          job_date?: string | null
          job_number: string
          job_type?: string | null
          movement_type?: string | null
          order_number_override?: string | null
          raw?: Json
          site?: string | null
          source: string
          updated_at?: string
          vehicle_registration?: string | null
          waste_description?: string | null
          weight_t?: number | null
        }
        Update: {
          category?: string | null
          container_type?: string | null
          created_at?: string
          customer?: string | null
          ewc?: string | null
          id?: string
          job_date?: string | null
          job_number?: string
          job_type?: string | null
          movement_type?: string | null
          order_number_override?: string | null
          raw?: Json
          site?: string | null
          source?: string
          updated_at?: string
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
      load_line_items: {
        Row: {
          avg_weight_kg: number
          created_at: string
          display_order: number
          id: string
          load_report_id: string
          pallet_count: number
          total_weight_kg: number
          updated_at: string
          waste_type: string
        }
        Insert: {
          avg_weight_kg?: number
          created_at?: string
          display_order?: number
          id?: string
          load_report_id: string
          pallet_count?: number
          total_weight_kg?: number
          updated_at?: string
          waste_type: string
        }
        Update: {
          avg_weight_kg?: number
          created_at?: string
          display_order?: number
          id?: string
          load_report_id?: string
          pallet_count?: number
          total_weight_kg?: number
          updated_at?: string
          waste_type?: string
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
          created_at: string
          id: string
          notes: string | null
          operator_id: string | null
          operator_name: string
          pallets_out: number | null
          report_date: string
          site_id: string | null
          status: string
          submitted_at: string | null
          total_pallets: number
          total_weight_kg: number
          updated_at: string
          vehicle_reg: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name: string
          pallets_out?: number | null
          report_date?: string
          site_id?: string | null
          status?: string
          submitted_at?: string | null
          total_pallets?: number
          total_weight_kg?: number
          updated_at?: string
          vehicle_reg?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          operator_id?: string | null
          operator_name?: string
          pallets_out?: number | null
          report_date?: string
          site_id?: string | null
          status?: string
          submitted_at?: string | null
          total_pallets?: number
          total_weight_kg?: number
          updated_at?: string
          vehicle_reg?: string | null
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
          default_avg_weight_kg: number
          display_order: number
          id: string
          is_active: boolean
          pallet_weight_kg: number
          waste_type: string
        }
        Insert: {
          created_at?: string
          default_avg_weight_kg?: number
          display_order?: number
          id?: string
          is_active?: boolean
          pallet_weight_kg?: number
          waste_type: string
        }
        Update: {
          created_at?: string
          default_avg_weight_kg?: number
          display_order?: number
          id?: string
          is_active?: boolean
          pallet_weight_kg?: number
          waste_type?: string
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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
          user_types: Database["public"]["Enums"]["user_type"][] | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
          user_types?: Database["public"]["Enums"]["user_type"][] | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
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
          user_id: string
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
          user_id: string
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
          user_id?: string
          welfare_comments?: string | null
          welfare_drinking_water?: string | null
          welfare_rest_areas?: string | null
          welfare_toilets_clean?: string | null
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
      is_management: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      skip_material_type: "card_loose" | "scrap_metal"
      user_type: "driver" | "yard" | "office" | "management"
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
      skip_material_type: ["card_loose", "scrap_metal"],
      user_type: ["driver", "yard", "office", "management"],
    },
  },
} as const
