import { MaterialIcons } from "@expo/vector-icons";

export interface SeedAction {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  category: string;
  action: string;
  params?: Record<string, unknown>;
  destructive?: boolean;
}

export interface NotificationScenario {
  id:
    | "appointment_reminder"
    | "confirmation_request"
    | "message"
    | "promotion"
    | "aftercare"
    | "consultation_response";
  label: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export interface SeedSettings {
  clientEmail: string;
  masterEmail: string;
  minutesOffset: string;
  durationMinutes: string;
  price: string;
  notes: string;
  message: string;
  loyaltyAmount: string;
  orderQuantity: string;
}

export interface SeedResult {
  ok: boolean;
  label: string;
  message: string;
  at: number;
}
