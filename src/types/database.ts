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
                    deposit_amount: number | null
                    deposit_paid: boolean | null
                    deposit_payment_intent_id: string | null
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
                    deposit_amount?: number | null
                    deposit_paid?: boolean | null
                    deposit_payment_intent_id?: string | null
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
                    deposit_amount?: number | null
                    deposit_paid?: boolean | null
                    deposit_payment_intent_id?: string | null
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
            booking_consultations: {
                Row: {
                    id: string
                    client_id: string
                    service_id: string
                    master_id: string | null
                    had_before: boolean
                    how_long_ago: string | null
                    was_my_work: boolean | null
                    photo_urls: string[]
                    additional_notes: string | null
                    status: Database["public"]["Enums"]["booking_consultation_status"]
                    booking_link_token: string
                    approval_expires_at: string | null
                    master_notes: string | null
                    responded_at: string | null
                    converted_to_booking: boolean
                    booking_id: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    client_id: string
                    service_id: string
                    master_id?: string | null
                    had_before?: boolean
                    how_long_ago?: string | null
                    was_my_work?: boolean | null
                    photo_urls?: string[]
                    additional_notes?: string | null
                    status?: Database["public"]["Enums"]["booking_consultation_status"]
                    booking_link_token?: string
                    approval_expires_at?: string | null
                    master_notes?: string | null
                    responded_at?: string | null
                    converted_to_booking?: boolean
                    booking_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    client_id?: string
                    service_id?: string
                    master_id?: string | null
                    had_before?: boolean
                    how_long_ago?: string | null
                    was_my_work?: boolean | null
                    photo_urls?: string[]
                    additional_notes?: string | null
                    status?: Database["public"]["Enums"]["booking_consultation_status"]
                    booking_link_token?: string
                    approval_expires_at?: string | null
                    master_notes?: string | null
                    responded_at?: string | null
                    converted_to_booking?: boolean
                    booking_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "booking_consultations_client_id_fkey"
                        columns: ["client_id"]
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
                    {
                        foreignKeyName: "booking_consultations_master_id_fkey"
                        columns: ["master_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            master_settings: {
                Row: {
                    master_id: string
                    no_show_charge_percent: number | null
                    grace_period_multiplier: number | null
                    auto_charge_after_grace_period: boolean | null
                    deposit_type: string | null
                    deposit_amount: number | null
                    deposit_percentage: number | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    master_id: string
                    no_show_charge_percent?: number | null
                    grace_period_multiplier?: number | null
                    auto_charge_after_grace_period?: boolean | null
                    deposit_type?: string | null
                    deposit_amount?: number | null
                    deposit_percentage?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    master_id?: string
                    no_show_charge_percent?: number | null
                    grace_period_multiplier?: number | null
                    auto_charge_after_grace_period?: boolean | null
                    deposit_type?: string | null
                    deposit_amount?: number | null
                    deposit_percentage?: number | null
                    created_at?: string | null
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
                    onboarding_completed: boolean | null
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
                    onboarding_completed?: boolean | null
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
                    onboarding_completed?: boolean | null
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
                    requires_consultation: boolean | null
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
                    requires_consultation?: boolean | null
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
                    requires_consultation?: boolean | null
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
            master_supplies: {
                Row: {
                    id: string
                    master_id: string
                    name: string
                    description: string | null
                    quantity: number
                    unit: string
                    low_stock_threshold: number | null
                    cost_per_unit: number | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    master_id: string
                    name: string
                    description?: string | null
                    quantity?: number
                    unit?: string
                    low_stock_threshold?: number | null
                    cost_per_unit?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    master_id?: string
                    name?: string
                    description?: string | null
                    quantity?: number
                    unit?: string
                    low_stock_threshold?: number | null
                    cost_per_unit?: number | null
                    created_at?: string | null
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
            service_supplies: {
                Row: {
                    id: string
                    service_id: string
                    supply_id: string
                    quantity_per_service: number
                    notes: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    service_id: string
                    supply_id: string
                    quantity_per_service?: number
                    notes?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    service_id?: string
                    supply_id?: string
                    quantity_per_service?: number
                    notes?: string | null
                    created_at?: string | null
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
                        referencedRelation: "master_supplies"
                        referencedColumns: ["id"]
                    },
                ]
            }
            supply_consumption_log: {
                Row: {
                    id: string
                    supply_id: string
                    appointment_id: string | null
                    quantity_used: number
                    quantity_before: number
                    quantity_after: number
                    notes: string | null
                    created_by: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    supply_id: string
                    appointment_id?: string | null
                    quantity_used: number
                    quantity_before: number
                    quantity_after: number
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    supply_id?: string
                    appointment_id?: string | null
                    quantity_used?: number
                    quantity_before?: number
                    quantity_after?: number
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "supply_consumption_log_supply_id_fkey"
                        columns: ["supply_id"]
                        isOneToOne: false
                        referencedRelation: "master_supplies"
                        referencedColumns: ["id"]
                    },
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
                ]
            }
            global_settings: {
                Row: {
                    id: string
                    key: string
                    value: string
                    description: string | null
                    updated_at: string | null
                    updated_by: string | null
                }
                Insert: {
                    id?: string
                    key: string
                    value: string
                    description?: string | null
                    updated_at?: string | null
                    updated_by?: string | null
                }
                Update: {
                    id?: string
                    key?: string
                    value?: string
                    description?: string | null
                    updated_at?: string | null
                    updated_by?: string | null
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
            owner_supplies: {
                Row: {
                    id: string
                    owner_id: string
                    name: string
                    description: string | null
                    quantity: number
                    unit: string
                    low_stock_threshold: number | null
                    cost_per_unit: number | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string
                    owner_id: string
                    name: string
                    description?: string | null
                    quantity?: number
                    unit?: string
                    low_stock_threshold?: number | null
                    cost_per_unit?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string
                    owner_id?: string
                    name?: string
                    description?: string | null
                    quantity?: number
                    unit?: string
                    low_stock_threshold?: number | null
                    cost_per_unit?: number | null
                    created_at?: string | null
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
                    id: string
                    supply_id: string
                    quantity_used: number
                    quantity_before: number
                    quantity_after: number
                    notes: string | null
                    created_by: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: string
                    supply_id: string
                    quantity_used: number
                    quantity_before: number
                    quantity_after: number
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string
                    supply_id?: string
                    quantity_used?: number
                    quantity_before?: number
                    quantity_after?: number
                    notes?: string | null
                    created_by?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "owner_supply_consumption_log_supply_id_fkey"
                        columns: ["supply_id"]
                        isOneToOne: false
                        referencedRelation: "owner_supplies"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "owner_supply_consumption_log_created_by_fkey"
                        columns: ["created_by"]
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
            book_appointment_with_confirmation: {
                Args: {
                    p_master_id: string
                    p_service_id: string
                    p_start_time: string
                    p_stripe_setup_intent_id: string
                    p_stripe_payment_intent_id: string
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
            client_confirm_appointment: {
                Args: {
                    p_appointment_id: string
                    p_response: string
                }
                Returns: {
                    success: boolean
                    new_status: string
                    message: string
                }[]
            }
            process_no_show_charge: {
                Args: {
                    p_appointment_id: string
                    p_charge_now: boolean
                }
                Returns: {
                    success: boolean
                    charge_amount: number
                    grace_period_minutes: number
                    grace_period_ends_at: string
                    message: string
                }[]
            }
            auto_cancel_appointment: {
                Args: {
                    p_appointment_id: string
                }
                Returns: {
                    success: boolean
                    message: string
                }[]
            }
            client_arrived_late: {
                Args: {
                    p_appointment_id: string
                }
                Returns: {
                    success: boolean
                    message: string
                }[]
            }
            get_appointments_needing_confirmation_reminder: {
                Args: Record<PropertyKey, never>
                Returns: {
                    appointment_id: string
                    client_id: string
                    master_id: string
                    start_time: string
                    confirmation_deadline: string
                    master_full_name: string
                    client_email: string
                    client_push_token: string
                    service_name: string
                }[]
            }
            get_appointments_for_auto_cancel: {
                Args: Record<PropertyKey, never>
                Returns: {
                    appointment_id: string
                    client_id: string
                    master_id: string
                    stripe_payment_intent_id: string
                    client_email: string
                    master_email: string
                    service_name: string
                    start_time: string
                }[]
            }
            get_appointments_for_auto_charge: {
                Args: Record<PropertyKey, never>
                Returns: {
                    appointment_id: string
                    client_id: string
                    master_id: string
                    no_show_charge_amount: number
                    stripe_payment_intent_id: string
                    client_email: string
                    master_email: string
                }[]
            }
        }
        Enums: {
            appointment_status: "awaiting_confirmation" | "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "pending_cancellation" | "pending_reschedule" | "reschedule_pending"
            booking_consultation_status: "pending" | "approved" | "declined" | "chat_requested"
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
export type MasterSupply = Tables<'master_supplies'>
export type ServiceSupply = Tables<'service_supplies'>
export type SupplyConsumptionLog = Tables<'supply_consumption_log'>
export type GlobalSetting = Tables<'global_settings'>
export type OwnerSupply = Tables<'owner_supplies'>
export type OwnerSupplyConsumptionLog = Tables<'owner_supply_consumption_log'>

// Booking Consultation for pre-booking approval flow
export type BookingConsultationStatus = 'pending' | 'approved' | 'declined' | 'chat_requested';

export interface BookingConsultation {
    id: string;
    client_id: string;
    service_id: string;
    master_id: string | null;
    had_before: boolean;
    how_long_ago: string | null;
    was_my_work: boolean | null;
    photo_urls: string[];
    additional_notes: string | null;
    status: BookingConsultationStatus;
    booking_link_token: string;
    approval_expires_at: string | null;
    master_notes: string | null;
    responded_at: string | null;
    converted_to_booking: boolean;
    booking_id: string | null;
    created_at: string | null;
    updated_at: string | null;
}

