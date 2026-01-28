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
                    created_at: string | null
                    email: string
                    full_name: string | null
                    id: string
                    is_master: boolean | null
                    notification_preferences: Json | null
                    phone: string | null
                    push_token: string | null
                    role: Database["public"]["Enums"]["user_role"]
                    stripe_customer_id: string | null
                    updated_at: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string | null
                    email: string
                    full_name?: string | null
                    id: string
                    is_master?: boolean | null
                    phone?: string | null
                    push_token?: string | null
                    role?: Database["public"]["Enums"]["user_role"]
                    stripe_customer_id?: string | null
                    updated_at?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string | null
                    email?: string
                    full_name?: string | null
                    id?: string
                    is_master?: boolean | null
                    notification_preferences?: Json | null
                    phone?: string | null
                    push_token?: string | null
                    role?: Database["public"]["Enums"]["user_role"]
                    stripe_customer_id?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            services: {
                Row: {
                    base_price: number
                    category: string | null
                    created_at: string | null
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
