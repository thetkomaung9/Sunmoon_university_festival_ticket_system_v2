export type TicketStatus = "VALID" | "USED" | "CANCELLED" | "EXPIRED";
export type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | "EXPIRED";
export type TicketTypeName = "Regular" | "VIP" | "Early Bird" | "Student";
export type Role = "user" | "staff" | "admin";

export const TICKET_TYPE_NAMES: TicketTypeName[] = ["Regular", "VIP", "Early Bird", "Student"];

export const STATUS_LABELS_MM: Record<TicketStatus, string> = {
  VALID: "အသုံးပြုနိုင်",
  USED: "သုံးပြီး",
  CANCELLED: "ပယ်ဖျက်ပြီး",
  EXPIRED: "သက်တမ်းကုန်",
};

export const TICKET_TYPE_MM: Record<TicketTypeName, string> = {
  Regular: "ပုံမှန်",
  VIP: "ဗီအိုင်ပီ",
  "Early Bird": "ကြိုတင်ဝယ်",
  Student: "ကျောင်းသား",
};
