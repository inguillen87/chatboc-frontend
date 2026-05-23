export interface Tenant {
  id: number;
  slug: string;
  nombre: string;
  tipo: 'pyme' | 'municipio' | 'colegio';
  plan: string;
  status: 'active' | 'inactive';
  is_active: boolean;
  created_at: string;
  owner_email?: string;
  whatsapp_sender_id?: string;
}

export interface CreateTenantDTO {
  slug: string;
  nombre: string;
  tipo: 'pyme' | 'municipio' | 'colegio';
  email_admin?: string;
  plan?: string;
}

export interface UpdateTenantDTO {
  nombre?: string;
  plan?: string;
  is_active?: boolean;
  whatsapp_sender_id?: string;
}
