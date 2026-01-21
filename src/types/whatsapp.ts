export type WhatsappNumberStatus = 'available' | 'reserved' | 'assigned' | 'verified';

export interface WhatsappNumberInventoryItem {
  id: string | number;
  phone_number: string;
  prefix?: string | null;
  city?: string | null;
  state?: string | null;
  status: WhatsappNumberStatus;
  tenant_slug?: string | null;
  tenant_name?: string | null;
}

export interface WhatsappNumberRequestPayload {
  prefix?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface WhatsappExternalNumberPayload {
  phone_number: string;
  sender_id: string;
  token: string;
}
