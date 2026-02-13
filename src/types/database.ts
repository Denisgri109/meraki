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
      academy_submissions: {
        Row: {
          chapter_name: string | null
          course_name: string
          created_at: string | null
          feedback: string | null
          grade: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          notes: string | null
          photo_url: string
          status: string | null
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          chapter_name?: string | null
          course_name: string
          created_at?: string | null
          feedback?: string | null
          grade?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          notes?: string | null
          photo_url: string
          status?: string | null
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          chapter_name?: string | null
          course_name?: string
          created_at?: string | null
          feedback?: string | null
          grade?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          notes?: string | null
          photo_url?: string
          status?: string | null
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aftercare_campaigns: {
        Row: {
          campaign_type: string
          created_at: string | null
          days_after_appointment: number | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          last_broadcast_at: string | null
          master_id: string
          message: string
          name: string
          send_date: string | null
          service_category: string | null
          start_date: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_type: string
          created_at?: string | null
          days_after_appointment?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          last_broadcast_at?: string | null
          master_id: string
          message: string
          name: string
          send_date?: string | null
          service_category?: string | null
          start_date?: string | null
          updated_at?: string | null
        }

        Update: {
          campaign_type?: string
          created_at?: string | null
          days_after_appointment?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          last_broadcast_at?: string | null
          master_id?: string
          message?: string
          name?: string
          send_date?: string | null
          service_category?: string | null
          start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aftercare_campaigns_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_confirmations: {
        Row: {
          appointment_id: string
          client_arrived_at: string | null
          client_arrived_late: boolean | null
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          grace_period_ends_at: string | null
          id: string
          master_notified_at: string | null
          no_show_charge_captured: boolean | null
          no_show_charge_receipt_url: string | null
          reminder_sent_at: string | null
          responded_at: string | null
          response_type: string | null
        }
        Insert: {
          appointment_id: string
          client_arrived_at?: string | null
          client_arrived_late?: boolean | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          master_notified_at?: string | null
          no_show_charge_captured?: boolean | null
          no_show_charge_receipt_url?: string | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          response_type?: string | null
        }
        Update: {
          appointment_id?: string
          client_arrived_at?: string | null
          client_arrived_late?: boolean | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          grace_period_ends_at?: string | null
          id?: string
          master_notified_at?: string | null
          no_show_charge_captured?: boolean | null
          no_show_charge_receipt_url?: string | null
          reminder_sent_at?: string | null
          responded_at?: string | null
          response_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_confirmations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          aftercare_sent: boolean | null
          auto_cancel_scheduled: boolean | null
          client_confirmed: boolean | null
          client_id: string
          confirmation_deadline: string | null
          confirmation_reminder_count: number | null
          confirmation_sent_at: string | null
          created_at: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          deposit_payment_intent_id: string | null
          end_time: string
          id: string
          master_id: string
          no_show_charge_amount: number | null
          no_show_processed_at: string | null
          notes: string | null
          payment_hold_amount: number | null
          price: number
          proposed_end_time: string | null
          proposed_start_time: string | null
          requires_confirmation: boolean | null
          reschedule_initiated_by: string | null
          service_duration_minutes: number | null
          service_id: string
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          status_updated_at: string | null
          stripe_payment_intent_id: string | null
          stripe_setup_intent_id: string | null
          updated_at: string | null
        }
        Insert: {
          aftercare_sent?: boolean | null
          auto_cancel_scheduled?: boolean | null
          client_confirmed?: boolean | null
          client_id: string
          confirmation_deadline?: string | null
          confirmation_reminder_count?: number | null
          confirmation_sent_at?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          deposit_payment_intent_id?: string | null
          end_time: string
          id?: string
          master_id: string
          no_show_charge_amount?: number | null
          no_show_processed_at?: string | null
          notes?: string | null
          payment_hold_amount?: number | null
          price: number
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          requires_confirmation?: boolean | null
          reschedule_initiated_by?: string | null
          service_duration_minutes?: number | null
          service_id: string
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          status_updated_at?: string | null
          stripe_payment_intent_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          aftercare_sent?: boolean | null
          auto_cancel_scheduled?: boolean | null
          client_confirmed?: boolean | null
          client_id?: string
          confirmation_deadline?: string | null
          confirmation_reminder_count?: number | null
          confirmation_sent_at?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          deposit_payment_intent_id?: string | null
          end_time?: string
          id?: string
          master_id?: string
          no_show_charge_amount?: number | null
          no_show_processed_at?: string | null
          notes?: string | null
          payment_hold_amount?: number | null
          price?: number
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          requires_confirmation?: boolean | null
          reschedule_initiated_by?: string | null
          service_duration_minutes?: number | null
          service_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          status_updated_at?: string | null
          stripe_payment_intent_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_reschedule_initiated_by_fkey"
            columns: ["reschedule_initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_slots: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          master_id: string
          reason: string | null
          start_time: string
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          master_id: string
          reason?: string | null
          start_time: string
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          master_id?: string
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_slots_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_consultations: {
        Row: {
          additional_notes: string | null
          approval_expires_at: string | null
          booking_id: string | null
          booking_link_token: string | null
          client_id: string
          converted_to_booking: boolean | null
          created_at: string | null
          had_before: boolean
          how_long_ago: string | null
          id: string
          master_id: string | null
          master_notes: string | null
          photo_urls: string[] | null
          responded_at: string | null
          service_id: string
          status: Database["public"]["Enums"]["booking_consultation_status"]
          updated_at: string | null
          was_my_work: boolean | null
        }
        Insert: {
          additional_notes?: string | null
          approval_expires_at?: string | null
          booking_id?: string | null
          booking_link_token?: string | null
          client_id: string
          converted_to_booking?: boolean | null
          created_at?: string | null
          had_before?: boolean
          how_long_ago?: string | null
          id?: string
          master_id?: string | null
          master_notes?: string | null
          photo_urls?: string[] | null
          responded_at?: string | null
          service_id: string
          status?: Database["public"]["Enums"]["booking_consultation_status"]
          updated_at?: string | null
          was_my_work?: boolean | null
        }
        Update: {
          additional_notes?: string | null
          approval_expires_at?: string | null
          booking_id?: string | null
          booking_link_token?: string | null
          client_id?: string
          converted_to_booking?: boolean | null
          created_at?: string | null
          had_before?: boolean
          how_long_ago?: string | null
          id?: string
          master_id?: string | null
          master_notes?: string | null
          photo_urls?: string[] | null
          responded_at?: string | null
          service_id?: string
          status?: Database["public"]["Enums"]["booking_consultation_status"]
          updated_at?: string | null
          was_my_work?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_consultations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_consultations_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_consultations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_notifications_sent: {
        Row: {
          appointment_id: string | null
          campaign_id: string
          client_id: string
          id: string
          sent_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          campaign_id: string
          client_id: string
          id?: string
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          campaign_id?: string
          client_id?: string
          id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_notifications_sent_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_notifications_sent_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "aftercare_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_notifications_sent_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          order_index: number | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          order_index?: number | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          order_index?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      client_stamps: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          last_redeemed_at: string | null
          last_stamp_at: string | null
          loyalty_card_id: string
          master_id: string
          stamps_collected: number | null
          stamps_redeemed: number | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          last_redeemed_at?: string | null
          last_stamp_at?: string | null
          loyalty_card_id: string
          master_id: string
          stamps_collected?: number | null
          stamps_redeemed?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          last_redeemed_at?: string | null
          last_stamp_at?: string | null
          loyalty_card_id?: string
          master_id?: string
          stamps_collected?: number | null
          stamps_redeemed?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_stamps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stamps_loyalty_card_id_fkey"
            columns: ["loyalty_card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_stamps_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_responses: {
        Row: {
          additional_answers: Json | null
          appointment_id: string | null
          client_id: string
          consultation_completed: boolean | null
          consultation_notes: string | null
          consultation_required: boolean | null
          created_at: string | null
          has_had_before: boolean | null
          id: string
          master_id: string | null
          service_id: string | null
          time_since_last: string | null
          updated_at: string | null
          was_with_this_master: boolean | null
        }
        Insert: {
          additional_answers?: Json | null
          appointment_id?: string | null
          client_id: string
          consultation_completed?: boolean | null
          consultation_notes?: string | null
          consultation_required?: boolean | null
          created_at?: string | null
          has_had_before?: boolean | null
          id?: string
          master_id?: string | null
          service_id?: string | null
          time_since_last?: string | null
          updated_at?: string | null
          was_with_this_master?: boolean | null
        }
        Update: {
          additional_answers?: Json | null
          appointment_id?: string | null
          client_id?: string
          consultation_completed?: boolean | null
          consultation_notes?: string | null
          consultation_required?: boolean | null
          created_at?: string | null
          has_had_before?: boolean | null
          id?: string
          master_id?: string | null
          service_id?: string | null
          time_since_last?: string | null
          updated_at?: string | null
          was_with_this_master?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_responses_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_responses_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          last_message_at: string | null
          master_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          master_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          master_id?: string | null
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string | null
          enrolled_at: string | null
          id: string
          payment_intent_id: string | null
          progress: number | null
          student_id: string | null
        }
        Insert: {
          completed_at?: string | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          payment_intent_id?: string | null
          progress?: number | null
          student_id?: string | null
        }
        Update: {
          completed_at?: string | null
          course_id?: string | null
          enrolled_at?: string | null
          id?: string
          payment_intent_id?: string | null
          progress?: number | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          instructor_id: string | null
          is_published: boolean | null
          price: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_published?: boolean | null
          price?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          instructor_id?: string | null
          is_published?: boolean | null
          price?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      european_countries: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: string
          lesson_id: string
          notes: string | null
          photo_url: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          lesson_id: string
          notes?: string | null
          photo_url: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: string
          lesson_id?: string
          notes?: string | null
          photo_url?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string | null
          id: string
          last_restocked_at: string | null
          low_stock_threshold: number | null
          product_id: string
          quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_restocked_at?: string | null
          low_stock_threshold?: number | null
          product_id: string
          quantity?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_restocked_at?: string | null
          low_stock_threshold?: number | null
          product_id?: string
          quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          last_position_seconds: number | null
          lesson_id: string
          progress_percent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          lesson_id: string
          progress_percent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          lesson_id?: string
          progress_percent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string | null
          course_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          has_homework: boolean | null
          id: string
          order_index: number | null
          resource_url: string | null
          title: string
          updated_at: string | null
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          chapter_id?: string | null
          course_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          has_homework?: boolean | null
          id?: string
          order_index?: number | null
          resource_url?: string | null
          title: string
          updated_at?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          chapter_id?: string | null
          course_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          has_homework?: boolean | null
          id?: string
          order_index?: number | null
          resource_url?: string | null
          title?: string
          updated_at?: string | null
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          applicable_service_ids: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          master_id: string
          name: string
          reward_type: string
          reward_value: number | null
          service_category: string | null
          stamps_required: number
          updated_at: string | null
        }
        Insert: {
          applicable_service_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          master_id: string
          name: string
          reward_type?: string
          reward_value?: number | null
          service_category?: string | null
          stamps_required?: number
          updated_at?: string | null
        }
        Update: {
          applicable_service_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          master_id?: string
          name?: string
          reward_type?: string
          reward_value?: number | null
          service_category?: string | null
          stamps_required?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_qr_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          points_value: number | null
          scans_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          points_value?: number | null
          scans_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          points_value?: number | null
          scans_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_qr_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          created_at: string | null
          credit_type: string | null
          description: string | null
          discount_amount: number | null
          id: string
          is_active: boolean | null
          master_id: string | null
          name: string
          points_cost: number
        }
        Insert: {
          created_at?: string | null
          credit_type?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          is_active?: boolean | null
          master_id?: string | null
          name: string
          points_cost: number
        }
        Update: {
          created_at?: string | null
          credit_type?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          is_active?: boolean | null
          master_id?: string | null
          name?: string
          points_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          points: number
          qr_code_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          points: number
          qr_code_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          qr_code_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "loyalty_qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_applications: {
        Row: {
          bio: string | null
          certifications: string[] | null
          city: string | null
          country_code: string
          created_at: string | null
          currency_code: string
          email: string
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          portfolio_urls: string[] | null
          profile_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_radius_km: number | null
          specialties: string[] | null
          status: string
          timezone: string
          updated_at: string | null
          years_of_experience: number | null
        }
        Insert: {
          bio?: string | null
          certifications?: string[] | null
          city?: string | null
          country_code: string
          created_at?: string | null
          currency_code?: string
          email: string
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          portfolio_urls?: string[] | null
          profile_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_radius_km?: number | null
          specialties?: string[] | null
          status?: string
          timezone?: string
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Update: {
          bio?: string | null
          certifications?: string[] | null
          city?: string | null
          country_code?: string
          created_at?: string | null
          currency_code?: string
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          portfolio_urls?: string[] | null
          profile_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_radius_km?: number | null
          specialties?: string[] | null
          status?: string
          timezone?: string
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          master_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          master_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          master_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_availability_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_services: {
        Row: {
          created_at: string | null
          custom_duration: number | null
          custom_price: number | null
          id: string
          is_available: boolean | null
          master_id: string
          service_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_duration?: number | null
          custom_price?: number | null
          id?: string
          is_available?: boolean | null
          master_id: string
          service_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_duration?: number | null
          custom_price?: number | null
          id?: string
          is_available?: boolean | null
          master_id?: string
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_services_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "master_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      master_settings: {
        Row: {
          accepts_new_clients: boolean | null
          auto_charge_after_grace_period: boolean | null
          cancellation_charge_percent: number | null
          confirmation_response_timeout_hours: number | null
          confirmation_timing_hours: number | null
          created_at: string | null
          deposit_amount: number | null
          deposit_percentage: number | null
          deposit_type: string | null
          grace_period_multiplier: number | null
          id: string
          is_visible_globally: boolean | null
          late_arrival_minutes: number | null
          late_cancellation_window_hours: number | null
          master_id: string
          no_show_charge_percent: number | null
          require_tc_acceptance: boolean | null
          terms_and_conditions: string | null
          terms_updated_at: string | null
          updated_at: string | null
        }
        Insert: {
          accepts_new_clients?: boolean | null
          auto_charge_after_grace_period?: boolean | null
          cancellation_charge_percent?: number | null
          confirmation_response_timeout_hours?: number | null
          confirmation_timing_hours?: number | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          deposit_type?: string | null
          grace_period_multiplier?: number | null
          id?: string
          is_visible_globally?: boolean | null
          late_arrival_minutes?: number | null
          late_cancellation_window_hours?: number | null
          master_id: string
          no_show_charge_percent?: number | null
          require_tc_acceptance?: boolean | null
          terms_and_conditions?: string | null
          terms_updated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          accepts_new_clients?: boolean | null
          auto_charge_after_grace_period?: boolean | null
          cancellation_charge_percent?: number | null
          confirmation_response_timeout_hours?: number | null
          confirmation_timing_hours?: number | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_percentage?: number | null
          deposit_type?: string | null
          grace_period_multiplier?: number | null
          id?: string
          is_visible_globally?: boolean | null
          late_arrival_minutes?: number | null
          late_cancellation_window_hours?: number | null
          master_id?: string
          no_show_charge_percent?: number | null
          require_tc_acceptance?: boolean | null
          terms_and_conditions?: string | null
          terms_updated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_settings_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      master_supplies: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          description: string | null
          id: string
          low_stock_threshold: number | null
          master_id: string
          name: string
          quantity: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          low_stock_threshold?: number | null
          master_id: string
          name: string
          quantity?: number
          unit?: string
          updated_at?: string | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          low_stock_threshold?: number | null
          master_id?: string
          name?: string
          quantity?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_supplies_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          is_deleted: boolean | null
          media_type: string | null
          media_url: string | null
          read_at: string | null
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_type?: string | null
          media_url?: string | null
          read_at?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          appointment_id: string | null
          body: string
          campaign_id: string | null
          data: Json | null
          delivered: boolean | null
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          campaign_id?: string | null
          data?: Json | null
          delivered?: boolean | null
          error_message?: string | null
          id?: string
          notification_type: string
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          campaign_id?: string | null
          data?: Json | null
          delivered?: boolean | null
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "aftercare_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          appointment_id: string | null
          channel: string
          created_at: string | null
          error_message: string | null
          id: string
          notification_type: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          notification_type: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          notification_type?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          price: number
          product_id?: string | null
          product_name: string
          quantity: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          customs_duties: number | null
          estimated_delivery_date: string | null
          id: string
          notes: string | null
          shipping_address: string | null
          shipping_cost: number | null
          shipping_country: string | null
          shipping_method: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          total: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customs_duties?: number | null
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          shipping_address?: string | null
          shipping_cost?: number | null
          shipping_country?: string | null
          shipping_method?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customs_duties?: number | null
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          shipping_address?: string | null
          shipping_cost?: number | null
          shipping_country?: string | null
          shipping_method?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          total?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_supplies: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          description: string | null
          id: string
          low_stock_threshold: number | null
          name: string
          owner_id: string
          quantity: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          low_stock_threshold?: number | null
          name: string
          owner_id: string
          quantity?: number
          unit?: string
          updated_at?: string | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          low_stock_threshold?: number | null
          name?: string
          owner_id?: string
          quantity?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_supplies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_supply_consumption_log: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_used: number
          supply_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_after: number
          quantity_before: number
          quantity_used: number
          supply_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_used?: number
          supply_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_supply_consumption_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_supply_consumption_log_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "owner_low_stock_supplies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_supply_consumption_log_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "owner_supplies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_supply_consumption_log_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "owner_supply_usage_summary"
            referencedColumns: ["supply_id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string
          created_at: string | null
          exp_month: number
          exp_year: number
          id: string
          is_default: boolean | null
          last4: string
          stripe_payment_method_id: string
          user_id: string
        }
        Insert: {
          brand: string
          created_at?: string | null
          exp_month: number
          exp_year: number
          id?: string
          is_default?: boolean | null
          last4: string
          stripe_payment_method_id: string
          user_id: string
        }
        Update: {
          brand?: string
          created_at?: string | null
          exp_month?: number
          exp_year?: number
          id?: string
          is_default?: boolean | null
          last4?: string
          stripe_payment_method_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          order_id: string | null
          payment_type: string
          status: string
          stripe_payment_intent_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          appointment_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          payment_type: string
          status: string
          stripe_payment_intent_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          order_id?: string | null
          payment_type?: string
          status?: string
          stripe_payment_intent_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string | null
          currency: string | null
          id: string
          master_id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          status: string | null
          stripe_payout_id: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          master_id: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          stripe_payout_id?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          master_id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          stripe_payout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_masters: {
        Row: {
          bio: string | null
          commission_rate: number | null
          created_at: string | null
          created_by: string | null
          email: string
          full_name: string
          id: string
          master_status: string | null
          phone: string | null
        }
        Insert: {
          bio?: string | null
          commission_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          master_status?: string | null
          phone?: string | null
        }
        Update: {
          bio?: string | null
          commission_rate?: number | null
          created_at?: string | null
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          master_status?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      photo_consultations: {
        Row: {
          booking_id: string | null
          client_id: string
          client_message: string | null
          converted_to_booking: boolean | null
          created_at: string | null
          description: string | null
          estimated_duration: string | null
          estimated_price_range: string | null
          id: string
          is_doable: boolean | null
          master_id: string | null
          master_reply: string | null
          photo_url: string
          photo_urls: string[] | null
          professional_notes: string | null
          recommendations: string | null
          replied_at: string | null
          responded_by: string | null
          service_type: string | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          client_message?: string | null
          converted_to_booking?: boolean | null
          created_at?: string | null
          description?: string | null
          estimated_duration?: string | null
          estimated_price_range?: string | null
          id?: string
          is_doable?: boolean | null
          master_id?: string | null
          master_reply?: string | null
          photo_url: string
          photo_urls?: string[] | null
          professional_notes?: string | null
          recommendations?: string | null
          replied_at?: string | null
          responded_by?: string | null
          service_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          client_message?: string | null
          converted_to_booking?: boolean | null
          created_at?: string | null
          description?: string | null
          estimated_duration?: string | null
          estimated_price_range?: string | null
          id?: string
          is_doable?: boolean | null
          master_id?: string | null
          master_reply?: string | null
          photo_url?: string
          photo_urls?: string[] | null
          professional_notes?: string | null
          recommendations?: string | null
          replied_at?: string | null
          responded_by?: string | null
          service_type?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_consultations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_consultations_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_consultations_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          master_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          master_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string
          master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_countries: string[] | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_digital: boolean | null
          low_stock_threshold: number | null
          name: string
          restricted_countries: string[] | null
          retail_price: number
          shipping_weight_kg: number | null
          stock_count: number | null
          updated_at: string | null
          wholesale_price: number
        }
        Insert: {
          available_countries?: string[] | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_digital?: boolean | null
          low_stock_threshold?: number | null
          name: string
          restricted_countries?: string[] | null
          retail_price: number
          shipping_weight_kg?: number | null
          stock_count?: number | null
          updated_at?: string | null
          wholesale_price: number
        }
        Update: {
          available_countries?: string[] | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_digital?: boolean | null
          low_stock_threshold?: number | null
          name?: string
          restricted_countries?: string[] | null
          retail_price?: number
          shipping_weight_kg?: number | null
          stock_count?: number | null
          updated_at?: string | null
          wholesale_price?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          commission_rate: number | null
          country: string | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          currency_code: string | null
          email: string
          full_name: string | null
          id: string
          invite_accepted_at: string | null
          invited_by: string | null
          is_master: boolean | null
          is_verified: boolean | null
          loyalty_points: number | null
          master_status: string | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          phone: string | null
          push_token: string | null
          push_token_updated_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          service_radius_km: number | null
          specialties: string[] | null
          stripe_connect_id: string | null
          stripe_connect_status: string | null
          stripe_customer_id: string | null
          timezone: string | null
          tos_accepted: boolean | null
          tos_accepted_at: string | null
          tos_version: string | null
          updated_at: string | null
          verification_documents: string[] | null
          years_of_experience: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          commission_rate?: number | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          currency_code?: string | null
          email: string
          full_name?: string | null
          id: string
          invite_accepted_at?: string | null
          invited_by?: string | null
          is_master?: boolean | null
          is_verified?: boolean | null
          loyalty_points?: number | null
          master_status?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          phone?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          service_radius_km?: number | null
          specialties?: string[] | null
          stripe_connect_id?: string | null
          stripe_connect_status?: string | null
          stripe_customer_id?: string | null
          timezone?: string | null
          tos_accepted?: boolean | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          updated_at?: string | null
          verification_documents?: string[] | null
          years_of_experience?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          commission_rate?: number | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          currency_code?: string | null
          email?: string
          full_name?: string | null
          id?: string
          invite_accepted_at?: string | null
          invited_by?: string | null
          is_master?: boolean | null
          is_verified?: boolean | null
          loyalty_points?: number | null
          master_status?: string | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          phone?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          service_radius_km?: number | null
          specialties?: string[] | null
          stripe_connect_id?: string | null
          stripe_connect_status?: string | null
          stripe_customer_id?: string | null
          timezone?: string | null
          tos_accepted?: boolean | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          updated_at?: string | null
          verification_documents?: string[] | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          payment_id: string
          processed_by: string | null
          reason: string | null
          status: string | null
          stripe_refund_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          payment_id: string
          processed_by?: string | null
          reason?: string | null
          status?: string | null
          stripe_refund_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          payment_id?: string
          processed_by?: string | null
          reason?: string | null
          status?: string | null
          stripe_refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          appointment_id: string | null
          body: string
          created_at: string | null
          data: Json | null
          id: string
          scheduled_for: string
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          scheduled_for: string
          sent_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          scheduled_for?: string
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_supplies: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          quantity_per_service: number
          service_id: string
          supply_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          quantity_per_service?: number
          service_id: string
          supply_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          quantity_per_service?: number
          service_id?: string
          supply_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_supplies_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_supplies_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "low_stock_supplies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_supplies_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "master_supplies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_supplies_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supply_usage_summary"
            referencedColumns: ["supply_id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          category: string | null
          consultation_questions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          requires_consultation: boolean | null
          updated_at: string | null
        }
        Insert: {
          base_price: number
          category?: string | null
          consultation_questions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          requires_consultation?: boolean | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          category?: string | null
          consultation_questions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          requires_consultation?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_history: {
        Row: {
          action: string
          appointment_id: string | null
          client_stamp_id: string
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          stamps_change: number
        }
        Insert: {
          action: string
          appointment_id?: string | null
          client_stamp_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          stamps_change: number
        }
        Update: {
          action?: string
          appointment_id?: string | null
          client_stamp_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          stamps_change?: number
        }
        Relationships: [
          {
            foreignKeyName: "stamp_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_history_client_stamp_id_fkey"
            columns: ["client_stamp_id"]
            isOneToOne: false
            referencedRelation: "client_stamps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_consumption_log: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          quantity_used: number
          supply_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_after: number
          quantity_before: number
          quantity_used: number
          supply_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          quantity_used?: number
          supply_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_consumption_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_consumption_log_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_consumption_log_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "low_stock_supplies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_consumption_log_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "master_supplies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_consumption_log_supply_id_fkey"
            columns: ["supply_id"]
            isOneToOne: false
            referencedRelation: "supply_usage_summary"
            referencedColumns: ["supply_id"]
          },
        ]
      }
      tc_acceptances: {
        Row: {
          accepted_at: string | null
          accepted_version_hash: string | null
          client_id: string
          id: string
          master_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_version_hash?: string | null
          client_id: string
          id?: string
          master_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_version_hash?: string | null
          client_id?: string
          id?: string
          master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tc_acceptances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tc_acceptances_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          amount: number
          appointment_id: string | null
          created_at: string | null
          credit_type: string
          description: string | null
          expires_at: string | null
          id: string
          is_used: boolean | null
          reward_id: string | null
          used_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          appointment_id?: string | null
          created_at?: string | null
          credit_type: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          reward_id?: string | null
          used_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          appointment_id?: string | null
          created_at?: string | null
          credit_type?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_used?: boolean | null
          reward_id?: string | null
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_credits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credits_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "loyalty_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      low_stock_supplies: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          description: string | null
          global_threshold: number | null
          id: string | null
          is_low_stock: boolean | null
          low_stock_threshold: number | null
          master_id: string | null
          name: string | null
          quantity: number | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_supplies_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_low_stock_supplies: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          description: string | null
          global_threshold: number | null
          id: string | null
          is_low_stock: boolean | null
          low_stock_threshold: number | null
          name: string | null
          owner_id: string | null
          quantity: number | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_supplies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_supply_usage_summary: {
        Row: {
          current_quantity: number | null
          owner_id: string | null
          supply_id: string | null
          supply_name: string | null
          total_used_30_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_supplies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_usage_summary: {
        Row: {
          current_quantity: number | null
          master_id: string | null
          supply_id: string | null
          supply_name: string | null
          total_used_30_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "master_supplies_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_loyalty_stamp: {
        Args: {
          p_appointment_id?: string
          p_client_id: string
          p_loyalty_card_id: string
        }
        Returns: {
          message: string
          new_total: number
          reward_available: boolean
          success: boolean
        }[]
      }
      adjust_owner_supply_quantity: {
        Args: { p_new_quantity: number; p_reason?: string; p_supply_id: string }
        Returns: undefined
      }
      adjust_supply_quantity: {
        Args: { p_new_quantity: number; p_reason?: string; p_supply_id: string }
        Returns: undefined
      }
      auto_cancel_appointment: {
        Args: { p_appointment_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      book_appointment: {
        Args: {
          p_master_id: string
          p_notes?: string
          p_service_id: string
          p_start_time: string
        }
        Returns: string
      }
      book_appointment_with_confirmation:
      | {
        Args: {
          p_deposit_amount?: number
          p_deposit_payment_intent_id?: string
          p_master_id: string
          p_notes?: string
          p_service_id: string
          p_start_time: string
          p_stripe_payment_intent_id?: string
          p_stripe_setup_intent_id?: string
        }
        Returns: string
      }
      | {
        Args: {
          p_master_id: string
          p_notes?: string
          p_service_id: string
          p_start_time: string
          p_stripe_payment_intent_id: string
          p_stripe_setup_intent_id: string
        }
        Returns: string
      }
      calculate_confirmation_deadline: {
        Args: {
          p_appointment_time: string
          p_confirmation_timing_hours: number
          p_response_timeout_hours?: number
        }
        Returns: string
      }
      calculate_grace_period: {
        Args: {
          p_grace_period_multiplier?: number
          p_service_duration_minutes: number
        }
        Returns: number
      }
      cleanup_orphaned_profiles: { Args: never; Returns: undefined }
      client_arrived_late: {
        Args: { p_appointment_id: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      client_confirm_appointment: {
        Args: { p_appointment_id: string; p_response: string }
        Returns: {
          message: string
          new_status: string
          success: boolean
        }[]
      }
      decrement_stock: {
        Args: { p_product_id: string; p_quantity?: number }
        Returns: boolean
      }
      get_appointments_for_auto_cancel: {
        Args: never
        Returns: {
          appointment_id: string
          client_email: string
          client_id: string
          master_email: string
          master_id: string
          service_name: string
          start_time: string
          stripe_payment_intent_id: string
        }[]
      }
      get_appointments_needing_confirmation_reminder: {
        Args: never
        Returns: {
          appointment_id: string
          client_email: string
          client_id: string
          client_push_token: string
          confirmation_deadline: string
          master_full_name: string
          master_id: string
          service_name: string
          start_time: string
        }[]
      }
      get_available_slots: {
        Args: {
          p_date: string
          p_master_id: string
          p_service_duration?: number
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      get_client_stamp_cards: {
        Args: { p_client_id: string }
        Returns: {
          card_description: string
          card_id: string
          card_name: string
          last_stamp_at: string
          master_avatar: string
          master_id: string
          master_name: string
          reward_available: boolean
          reward_type: string
          reward_value: number
          stamp_id: string
          stamps_collected: number
          stamps_redeemed: number
          stamps_required: number
        }[]
      }
      get_master_clients: {
        Args: { p_master_id: string }
        Returns: {
          client_id: string
          full_name: string
          push_token: string
        }[]
      }
      get_master_deposit_settings: {
        Args: { p_master_id: string }
        Returns: {
          deposit_amount: number
          deposit_percentage: number
          deposit_type: string
        }[]
      }
      get_my_qr_code: { Args: never; Returns: string }
      get_or_create_qr_code: {
        Args: { p_owner_id: string }
        Returns: {
          id: string
          last_scanned_at: string
          points_value: number
          token: string
          total_scans: number
        }[]
      }
      is_valid_role: { Args: { role_text: string }; Returns: boolean }
      process_no_show_charge: {
        Args: { p_appointment_id: string; p_charge_now?: boolean }
        Returns: {
          charge_amount: number
          grace_period_ends_at: string
          grace_period_minutes: number
          message: string
          success: boolean
        }[]
      }
      process_qr_scan: {
        Args: { p_client_id: string; p_code: string }
        Returns: Json
      }
      process_stamp_scan: {
        Args: { p_client_id: string; p_master_id: string }
        Returns: Json
      }
      redeem_reward: {
        Args: { p_reward_id: string; p_user_id: string }
        Returns: Json
      }
      redeem_stamp_card: {
        Args: { p_client_id: string; p_client_stamp_id: string }
        Returns: Json
      }
      regenerate_qr_token: { Args: { p_owner_id: string }; Returns: string }
      scan_loyalty_qr: {
        Args: { p_client_id: string; p_token: string }
        Returns: Json
      }
    }
    Enums: {
      appointment_status:
      | "pending"
      | "confirmed"
      | "completed"
      | "cancelled"
      | "no_show"
      | "pending_cancellation"
      | "pending_reschedule"
      | "reschedule_pending"
      | "cancelled_free"
      | "cancelled_charge"
      booking_consultation_status:
      | "pending"
      | "approved"
      | "declined"
      | "chat_requested"
      user_role: "client" | "master" | "owner" | "pending_master"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Service = Database['public']['Tables']['services']['Row'];
export type MasterSupply = Database['public']['Tables']['master_supplies']['Row'];
export type ServiceSupply = Database['public']['Tables']['service_supplies']['Row'];
export type Portfolio = Database['public']['Tables']['portfolios']['Row'];
export type MasterService = Database['public']['Tables']['master_services']['Row'];

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
      appointment_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
        "pending_cancellation",
        "pending_reschedule",
        "reschedule_pending",
        "cancelled_free",
        "cancelled_charge",
      ],
      booking_consultation_status: [
        "pending",
        "approved",
        "declined",
        "chat_requested",
      ],
      user_role: ["client", "master", "owner", "pending_master"],
    },
  },
} as const

export type BlockedSlot = Database['public']['Tables']['blocked_slots']['Row']
export type BookingConsultation = Database['public']['Tables']['booking_consultations']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type OwnerSupply = Database['public']['Tables']['owner_supplies']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type UserRole = Database['public']['Enums']['user_role']
export type PhotoConsultation = Database['public']['Tables']['photo_consultations']['Row']
export type LoyaltyReward = Database['public']['Tables']['loyalty_rewards']['Row']
