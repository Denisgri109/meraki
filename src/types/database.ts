export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            appointment_confirmations: {
                Row: {
                    appointment_id: string
                    confirmed: boolean | null
                    confirmed_at: string | null
                    created_at: string | null
                    id: string
                    reminder_sent_at: string | null
                }
                Insert: {
                    appointment_id: string
                    confirmed?: boolean | null
                    confirmed_at?: string | null
                    created_at?: string | null
                    id?: string
                    reminder_sent_at?: string | null
                }
                Update: {
                    appointment_id?: string
                    confirmed?: boolean | null
                    confirmed_at?: string | null
                    created_at?: string | null
                    id?: string
                    reminder_sent_at?: string | null
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
                    client_id: string
                    created_at: string | null
                    end_time: string
                    id: string
                    master_id: string
                    notes: string | null
                    price: number
                    service_id: string
                    start_time: string
                    status: Database["public"]["Enums"]["appointment_status"]
                    stripe_payment_intent_id: string | null
                    updated_at: string | null
                }
                Insert: {
                    client_id: string
                    created_at?: string | null
                    end_time: string
                    id?: string
                    master_id: string
                    notes?: string | null
                    price: number
                    service_id: string
                    start_time: string
                    status?: Database["public"]["Enums"]["appointment_status"]
                    stripe_payment_intent_id?: string | null
                    updated_at?: string | null
                }
                Update: {
                    client_id?: string
                    created_at?: string | null
                    end_time?: string
                    id?: string
                    master_id?: string
                    notes?: string | null
                    price?: number
                    service_id?: string
                    start_time?: string
                    status?: Database["public"]["Enums"]["appointment_status"]
                    stripe_payment_intent_id?: string | null
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
                        foreignKeyName: "appointments_service_id_fkey"
                        columns: ["service_id"]
                        isOneToOne: false
                        referencedRelation: "services"
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
            profiles: {
                Row: {
                    avatar_url: string | null
                    bio: string | null
                    city: string | null
                    country: string | null
                    created_at: string | null
                    currency: string | null
                    email: string
                    full_name: string | null
                    id: string
                    is_master: boolean | null
                    notification_preferences: Json | null
                    phone: string | null
                    push_token: string | null
                    role: Database["public"]["Enums"]["user_role"]
                    stripe_connect_id: string | null
                    stripe_connect_status: string | null
                    stripe_customer_id: string | null
                    timezone: string | null
                    updated_at: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    bio?: string | null
                    city?: string | null
                    country?: string | null
                    created_at?: string | null
                    currency?: string | null
                    email: string
                    full_name?: string | null
                    id: string
                    is_master?: boolean | null
                    phone?: string | null
                    push_token?: string | null
                    role?: Database["public"]["Enums"]["user_role"]
                    stripe_connect_id?: string | null
                    stripe_connect_status?: string | null
                    stripe_customer_id?: string | null
                    timezone?: string | null
                    updated_at?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    bio?: string | null
                    city?: string | null
                    country?: string | null
                    created_at?: string | null
                    currency?: string | null
                    email?: string
                    full_name?: string | null
                    id?: string
                    is_master?: boolean | null
                    notification_preferences?: Json | null
                    phone?: string | null
                    push_token?: string | null
                    role?: Database["public"]["Enums"]["user_role"]
                    stripe_connect_id?: string | null
                    stripe_connect_status?: string | null
                    stripe_customer_id?: string | null
                    timezone?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            services: {
                Row: {
                    base_price: number
                    category: string | null
                    created_at: string | null
                    created_by: string | null
                    description: string | null
                    duration_minutes: number
                    id: string
                    image_url: string | null
                    is_active: boolean | null
                    name: string
                    updated_at: string | null
                }
                Insert: {
                    base_price: number
                    category?: string | null
                    created_at?: string | null
                    description?: string | null
                    duration_minutes?: number
                    id?: string
                    image_url?: string | null
                    is_active?: boolean | null
                    name: string
                    updated_at?: string | null
                }
                Update: {
                    base_price?: number
                    category?: string | null
                    created_at?: string | null
                    description?: string | null
                    duration_minutes?: number
                    id?: string
                    image_url?: string | null
                    is_active?: boolean | null
                    name?: string
                    updated_at?: string | null
                }
                Relationships: []
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
            master_applications: {
                Row: {
                    id: string
                    email: string
                    full_name: string
                    phone: string | null
                    bio: string | null
                    years_of_experience: number | null
                    specialties: string[] | null
                    certifications: string[] | null
                    portfolio_urls: string[] | null
                    country_code: string
                    city: string | null
                    timezone: string
                    service_radius_km: number | null
                    currency_code: string
                    status: string
                    reviewed_by: string | null
                    reviewed_at: string | null
                    rejection_reason: string | null
                    notes: string | null
                    profile_id: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    email: string
                    full_name: string
                    phone?: string | null
                    bio?: string | null
                    years_of_experience?: number | null
                    specialties?: string[] | null
                    certifications?: string[] | null
                    portfolio_urls?: string[] | null
                    country_code: string
                    city?: string | null
                    timezone?: string
                    service_radius_km?: number | null
                    currency_code?: string
                    status?: string
                    reviewed_by?: string | null
                    reviewed_at?: string | null
                    rejection_reason?: string | null
                    notes?: string | null
                    profile_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    email?: string
                    full_name?: string
                    phone?: string | null
                    bio?: string | null
                    years_of_experience?: number | null
                    specialties?: string[] | null
                    certifications?: string[] | null
                    portfolio_urls?: string[] | null
                    country_code?: string
                    city?: string | null
                    timezone?: string
                    service_radius_km?: number | null
                    currency_code?: string
                    status?: string
                    reviewed_by?: string | null
                    reviewed_at?: string | null
                    rejection_reason?: string | null
                    notes?: string | null
                    profile_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "master_applications_profile_id_fkey"
                        columns: ["profile_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            photo_consultations: {
                Row: {
                    id: string
                    client_id: string
                    master_id: string | null
                    title: string
                    description: string
                    service_type: string | null
                    photo_urls: string[]
                    status: string
                    is_doable: boolean | null
                    professional_notes: string | null
                    recommendations: string | null
                    estimated_price_range: string | null
                    estimated_duration: string | null
                    responded_at: string | null
                    responded_by: string | null
                    converted_to_booking: boolean | null
                    booking_id: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    client_id: string
                    master_id?: string | null
                    title: string
                    description: string
                    service_type?: string | null
                    photo_urls: string[]
                    status?: string
                    is_doable?: boolean | null
                    professional_notes?: string | null
                    recommendations?: string | null
                    estimated_price_range?: string | null
                    estimated_duration?: string | null
                    responded_at?: string | null
                    responded_by?: string | null
                    converted_to_booking?: boolean | null
                    booking_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    client_id?: string
                    master_id?: string | null
                    title?: string
                    description?: string
                    service_type?: string | null
                    photo_urls?: string[]
                    status?: string
                    is_doable?: boolean | null
                    professional_notes?: string | null
                    recommendations?: string | null
                    estimated_price_range?: string | null
                    estimated_duration?: string | null
                    responded_at?: string | null
                    responded_by?: string | null
                    converted_to_booking?: boolean | null
                    booking_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
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
                        foreignKeyName: "photo_consultations_booking_id_fkey"
                        columns: ["booking_id"]
                        isOneToOne: false
                        referencedRelation: "appointments"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            book_appointment: {
                Args: {
                    p_master_id: string
                    p_service_id: string
                    p_start_time: string
                    p_notes?: string
                }
                Returns: string
            }
            get_available_slots: {
                Args: {
                    p_master_id: string
                    p_date: string
                    p_service_duration?: number
                }
                Returns: {
                    slot_start: string
                    slot_end: string
                }[]
            }
        }
        Enums: {
            appointment_status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "pending_cancellation" | "pending_reschedule"
            user_role: "client" | "master" | "owner"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Convenience type aliases
export type Profile = Tables<'profiles'>
export type Service = Tables<'services'>
export type MasterService = Tables<'master_services'>
export type MasterAvailability = Tables<'master_availability'>
export type Appointment = Tables<'appointments'>
export type AppointmentConfirmation = Tables<'appointment_confirmations'>
export type UserRole = Enums<'user_role'>
export type AppointmentStatus = Enums<'appointment_status'>
export type BlockedSlot = Tables<'blocked_slots'>
export type Portfolio = Tables<'portfolios'>
export type MasterApplication = Tables<'master_applications'>
export type PhotoConsultation = Tables<'photo_consultations'>
