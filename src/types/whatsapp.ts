export type WhatsappNumberStatus = 'available' | 'reserved' | 'assigned' | 'verified' | 'disabled';

export interface WhatsappNumberInventoryItem {
  id: string | number;
  phone_number: string;
  sender_id?: string | null;
  prefix?: string | null;
  city?: string | null;
  state?: string | null;
  status: WhatsappNumberStatus;
  tenant_id?: number | null;
  tenant_slug?: string | null;
  tenant_nombre?: string | null;
}

export interface WhatsappNumberCreatePayload {
  phone_number: string;
  sender_id: string;
  status?: WhatsappNumberStatus;
  tenant_slug?: string | null;
}

export interface WhatsappExternalNumberPayload {
  tenant_slug?: string | null;
  number: string;
  sender_id: string;
  status?: WhatsappNumberStatus;
}
