export type TenantType = "municipio" | "pyme";

export interface TenantConfigBundle {
  tenant: {
    slug: string;
    nombre: string;
    tipo: TenantType;
    plan: string;
    logo_url?: string;
    color_primario?: string;
    color_secundario?: string;
    whatsapp_sender_id?: string | null;
  };
  configs: {
    menu: Record<string, MenuConfig>;
    contacts: Record<string, ContactsConfig>;
    links: Record<string, LinksConfig>;
    widget: Record<string, WidgetConfig>;
  };
  whatsapp?: {
    has_number: boolean;
    phone_number?: string;
    sender_id?: string;
  };
}

export type MenuItemType = "submenu" | "ticket_category" | "link" | "action";

export interface MenuItemBase {
  id: string;
  label: string;
  description?: string;
  type: MenuItemType;
}

export interface TicketCategoryItem extends MenuItemBase {
  type: "ticket_category";
  ticket_category: string;
}

export interface SubmenuItem extends MenuItemBase {
  type: "submenu";
}

export interface LinkItem extends MenuItemBase {
  type: "link";
  url: string;
}

export interface ActionItem extends MenuItemBase {
  type: "action";
  action: string;
  payload?: Record<string, any>;
}

export type AnyMenuItem = TicketCategoryItem | SubmenuItem | LinkItem | ActionItem;

export interface MenuConfig {
  version: number;
  main_menu: AnyMenuItem[];
  submenus: Record<string, AnyMenuItem[]>;
}

export interface ContactsConfig {
  telefono?: string;
  whatsapp_humano?: string;
  email?: string;
  redes?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    [key: string]: string | undefined;
  };
}

export interface LinkConfigItem {
  id: string;
  label: string;
  url: string;
  description?: string;
  group?: string;
}

export interface LinksConfig {
  items: LinkConfigItem[];
}

export interface WidgetConfig {
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  welcome_title?: string;
  welcome_subtitle?: string;
  default_open?: boolean;
  position?: "bottom-right" | "bottom-left";
  [key: string]: any;
}

export interface CreateTenantPayload {
  nombre: string;
  slug: string;
  tipo: TenantType;
  template_key: string;
  plan: string;
  auto_assign_whatsapp_number?: boolean;
  owner_email?: string;
  owner_password?: string;
}

export interface CreateTenantResponse {
  slug: string;
  widget_token: string;
  id: number;
}
