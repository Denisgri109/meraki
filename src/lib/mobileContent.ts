/**
 * Registry of every owner-editable piece of copy and imagery in the mobile app.
 *
 * Single source of truth: screens render `<EditableText contentKey="..." />`
 * and the Customize App screen lists the same entries, so an inline edit and a
 * dashboard edit can never disagree about the factory default.
 *
 * Key namespaces
 *   mobile.*   — surfaces that only exist in the app
 *   brand.* / footer.* / support.* / contact.* / legal.* / image.*
 *              — shared with meraki-WEB so one edit updates both platforms
 */

import { ImageSourcePropType } from 'react-native';

export interface EditableTextField {
    key: string;
    label: string;
    fallback: string;
    multiline?: boolean;
    description?: string;
}

export interface EditableTextGroup {
    id: string;
    title: string;
    description: string;
    fields: EditableTextField[];
}

export interface EditableImageField {
    key: string;
    label: string;
    description: string;
    fallbackSource: ImageSourcePropType;
    pathPrefix: string;
}

export interface FaqItem {
    id: string;
    question: string;
    answer: string;
    category: string;
    order: number;
}

export interface SupportSettings {
    email: string;
    phone: string;
    hours: string;
    address: string;
    additional_info: string;
}

// ─── Text ───────────────────────────────────────────────────────────────

export const TEXT_GROUPS: EditableTextGroup[] = [
    {
        id: 'branding',
        title: 'Branding',
        description: 'Brand name and tagline shown across the app. Shared with the website.',
        fields: [
            { key: 'brand.logo_text', label: 'Brand Name', fallback: 'Merakí' },
            { key: 'footer.tagline', label: 'Tagline', fallback: 'Beauty with soul' },
        ],
    },
    {
        id: 'home',
        title: 'Home Screen',
        description: 'Hero banner and the two editorial cards on the client home screen.',
        fields: [
            {
                key: 'mobile.home.hero_tagline',
                label: 'Hero Headline',
                fallback: "WE'RE OBSESSED\nWITH YOU",
                multiline: true,
            },
            {
                key: 'mobile.home.hero_subtext',
                label: 'Hero Subtext',
                fallback: 'Discover the skincare, lash, and\nbeauty products curated for you',
                multiline: true,
            },
            { key: 'mobile.home.hero_button', label: 'Hero Button Label', fallback: 'Shop Now' },
            { key: 'mobile.home.editorial_shop_label', label: 'Shop Card — Eyebrow', fallback: 'NEW ARRIVALS' },
            { key: 'mobile.home.editorial_shop_title', label: 'Shop Card — Title', fallback: 'Fresh Drops' },
            { key: 'mobile.home.editorial_shop_cta', label: 'Shop Card — Link', fallback: 'SHOP NOW →' },
            { key: 'mobile.home.editorial_academy_label', label: 'Academy Card — Eyebrow', fallback: 'ACADEMY' },
            { key: 'mobile.home.editorial_academy_title', label: 'Academy Card — Title', fallback: 'Learn & Grow' },
            { key: 'mobile.home.editorial_academy_cta', label: 'Academy Card — Link', fallback: 'EXPLORE →' },
        ],
    },
    {
        id: 'shop',
        title: 'Shop',
        description: 'Header and empty-state copy on the shop tab.',
        fields: [
            { key: 'mobile.shop.header_label', label: 'Shop Eyebrow', fallback: 'THE COLLECTION' },
            { key: 'mobile.shop.brand_label', label: 'Product Brand Label', fallback: 'MERAKÍ' },
        ],
    },
    {
        id: 'support',
        title: 'Support Page',
        description: 'Titles and banner text on Help & Support. Shared with the website.',
        fields: [
            { key: 'support.header_title', label: 'Support Title', fallback: 'Help & Support' },
            {
                key: 'support.banner_text',
                label: 'Support Banner',
                fallback: 'If a feature is not working as expected, please try the website.',
                multiline: true,
            },
            { key: 'mobile.support.contact_title', label: 'Contact Section Title', fallback: 'Contact Us' },
            { key: 'mobile.support.faq_title', label: 'FAQ Section Title', fallback: 'Frequently Asked Questions' },
        ],
    },
    {
        id: 'auth',
        title: 'Sign In & Sign Up',
        description: 'Copy shown on the sign-in and sign-up screens.',
        fields: [
            { key: 'mobile.auth.login_tagline', label: 'Sign In Tagline', fallback: 'BEAUTY WITH SOUL' },
            { key: 'mobile.auth.register_title', label: 'Sign Up Title', fallback: 'Create Account' },
            {
                key: 'mobile.auth.register_subtitle',
                label: 'Sign Up Subtitle',
                fallback: 'Join the Merakí community',
            },
        ],
    },
];

/** Flat lookup of every editable text key → factory default. */
export const TEXT_FALLBACKS: Record<string, string> = TEXT_GROUPS.reduce(
    (acc, group) => {
        for (const field of group.fields) acc[field.key] = field.fallback;
        return acc;
    },
    {} as Record<string, string>
);

export const ALL_TEXT_FIELDS: EditableTextField[] = TEXT_GROUPS.flatMap((g) => g.fields);

/**
 * Factory default for a content key. Returns '' for unknown keys so a typo
 * degrades to empty rather than throwing at render time.
 */
export function getTextFallback(key: string): string {
    return TEXT_FALLBACKS[key] ?? '';
}

// ─── Images ─────────────────────────────────────────────────────────────

export const IMAGE_FIELDS: EditableImageField[] = [
    {
        key: 'mobile.home.hero_banner',
        label: 'Home Hero Banner',
        description: 'Main banner on the client home screen',
        fallbackSource: require('../assets/hero_beauty_banner.png'),
        pathPrefix: 'mobile-content/hero',
    },
    {
        key: 'mobile.home.editorial_shop',
        label: 'Shop Editorial Card',
        description: 'Image behind the "New Arrivals" shop card',
        fallbackSource: require('../assets/editorial_new_arrivals.png'),
        pathPrefix: 'mobile-content/editorial-shop',
    },
    {
        key: 'mobile.home.editorial_academy',
        label: 'Academy Editorial Card',
        description: 'Image behind the "Academy" learn card',
        fallbackSource: require('../assets/editorial_academy.png'),
        pathPrefix: 'mobile-content/editorial-academy',
    },
];

// ─── Legal documents ────────────────────────────────────────────────────

export const LEGAL_DOCUMENTS = [
    {
        key: 'legal.tos_body',
        label: 'Terms of Service',
        description: 'Leave empty to restore the built-in Terms of Service.',
    },
    {
        key: 'legal.privacy_policy_body',
        label: 'Privacy Policy',
        description: 'Leave empty to restore the built-in Privacy Policy.',
    },
] as const;

// ─── Support settings & FAQ (shared shape with meraki-WEB) ──────────────

export const SUPPORT_SETTING_FIELDS: {
    field: keyof SupportSettings;
    label: string;
    placeholder: string;
    multiline?: boolean;
}[] = [
        { field: 'email', label: 'Support Email', placeholder: 'support@yoursalon.com' },
        { field: 'phone', label: 'Support Phone', placeholder: '+353 1 234 5678' },
        { field: 'hours', label: 'Business Hours', placeholder: 'Mon-Fri: 9:00 AM - 6:00 PM' },
        { field: 'address', label: 'Address', placeholder: '123 Beauty Lane, Dublin' },
        {
            field: 'additional_info',
            label: 'Additional Info',
            placeholder: 'Any additional information for clients...',
            multiline: true,
        },
    ];

export const DEFAULT_SUPPORT_SETTINGS: SupportSettings = {
    email: '',
    phone: '',
    hours: 'Mon-Fri: 9:00 AM - 6:00 PM',
    address: '',
    additional_info: '',
};

/**
 * Bundled fallback list, used only while the owner has not saved a custom
 * `faq_items` row. Verbatim copy of what the app shipped with, so enabling the
 * editor does not silently reword anything.
 */
export const DEFAULT_FAQS: FaqItem[] = [
    { id: '1', question: 'How do I book an appointment?', answer: 'Navigate to the Book tab, select "Book New", choose your desired service, select a Master, pick your date and time, and confirm your booking.', category: 'Bookings', order: 0 },
    { id: '2', question: 'Can I cancel or reschedule my appointment?', answer: 'Yes. Navigate to the Book tab, select the "Appointments" sub-tab, tap the appointment you wish to change, and select Cancel or Reschedule. Please note that cancellations or reschedules within 24 hours of your appointment may incur a 50% penalty fee.', category: 'Bookings', order: 1 },
    { id: '3', question: 'How do deposits work?', answer: 'Some services require a deposit at the time of booking. The deposit is applied toward your total service cost. The remaining balance is due at the salon on the day of your appointment.', category: 'Payments', order: 2 },
    { id: '4', question: 'What payment methods are accepted?', answer: 'We accept all major credit and debit cards through our secure Stripe payment system. You can save and manage your cards under Menu > Payment.', category: 'Payments', order: 3 },
    { id: '5', question: 'How do I earn loyalty points?', answer: "Earn points by scanning the Master's QR code at the salon using the in-app scanner after your service. You can view your stamp cards and track your rewards under Menu > Loyalty.", category: 'Loyalty', order: 4 },
    { id: '6', question: 'How do I update my profile or security settings?', answer: 'Go to Menu > Edit Profile to update your name, photo, and bio. Security settings (like password changes) can be managed under Settings.', category: 'Account', order: 5 },
    { id: '7', question: 'How do refunds work?', answer: 'Refunds are processed by the salon owner. If eligible, refunds are returned to your original payment method and typically appear within 5-10 business days.', category: 'Payments', order: 6 },
    { id: '8', question: 'How do I access courses in the Academy?', answer: 'Navigate to the Academy tab. You can browse and purchase courses, watch video lessons, track your progress, and submit your homework assignments directly from the app.', category: 'Academy', order: 7 },
    { id: '9', question: 'How does the Shop and shipping work?', answer: 'Tap the Shop tab to browse products. Fill in your European shipping address and check out securely. You can view and track your purchases under Menu > Orders.', category: 'Shop', order: 8 },
    { id: '10', question: 'What are photo consultations?', answer: 'If a Master requires a pre-service assessment, you can submit a photo consultation request. Navigate to the Book tab, upload your photos, and once approved, you will be able to book.', category: 'Consultations', order: 9 },
];

export const FAQ_CATEGORIES = [
    'General', 'Bookings', 'Payments', 'Account', 'Shop', 'Academy', 'Loyalty', 'Consultations',
];

/** Owner-managed JSON blobs stored as single `global_settings` rows. */
export const FAQ_ITEMS_KEY = 'faq_items';
export const SUPPORT_SETTINGS_KEY = 'support_settings';

export function parseFaqItems(raw: string | undefined): FaqItem[] {
    if (!raw) return DEFAULT_FAQS;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as FaqItem[];
    } catch {
        // Malformed override — fall back to the shipped list.
    }
    return DEFAULT_FAQS;
}

export function parseSupportSettings(raw: string | undefined): SupportSettings {
    if (!raw) return DEFAULT_SUPPORT_SETTINGS;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_SUPPORT_SETTINGS, ...parsed };
        }
    } catch {
        // Malformed override — fall back to defaults.
    }
    return DEFAULT_SUPPORT_SETTINGS;
}

// ─── Reset ──────────────────────────────────────────────────────────────

export interface ResetSection {
    id: string;
    title: string;
    description: string;
    prefixes: string[];
    keys: string[];
}

export const RESET_SECTIONS: ResetSection[] = [
    {
        id: 'app',
        title: 'App Screens',
        description: 'Home, shop, support and sign-in copy plus every replaced app image.',
        prefixes: ['mobile.'],
        keys: [],
    },
    {
        id: 'branding',
        title: 'Branding',
        description: 'Brand name, tagline and custom logo. Also affects the website.',
        prefixes: ['brand.', 'footer.', 'image.'],
        keys: [],
    },
    {
        id: 'support',
        title: 'Support & FAQ',
        description: 'Support page text, contact details and all FAQ items. Also affects the website.',
        prefixes: ['support.'],
        keys: [FAQ_ITEMS_KEY, SUPPORT_SETTINGS_KEY],
    },
    {
        id: 'legal',
        title: 'Legal Documents',
        description: 'Custom Terms of Service and Privacy Policy bodies. Also affects the website.',
        prefixes: ['legal.'],
        keys: [],
    },
];

/** Every prefix the visual editor owns. Theme colours are deliberately excluded. */
export const CONTENT_RESET_PREFIXES = RESET_SECTIONS.flatMap((s) => s.prefixes);
