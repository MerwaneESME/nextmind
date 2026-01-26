export type UserRole = "particulier" | "professionnel";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: "en_cours" | "termine" | "en_attente";
  clientId: string;
  professionalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quote {
  id: string;
  projectId: string;
  professionalId: string;
  amount: number;
  status: "a_faire" | "envoye" | "valide" | "refuse";
  createdAt: string;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface BTPProduct {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  description?: string;
}

export interface Message {
  id: string;
  projectId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: "retard_chantier" | "nouveau_message" | "devis_expire" | "autre";
  title: string;
  message: string;
  projectId?: string;
  read: boolean;
  createdAt: string;
}

