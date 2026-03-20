# Guide d'intégration ARTISIA

Ce document décrit les étapes pour intégrer Supabase et l'API IA dans le projet ARTISIA.

## 🔐 Intégration Supabase

### 1. Installation

```bash
npm install @supabase/supabase-js
```

### 2. Configuration

Créer un fichier `lib/supabase.ts` :

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 3. Schema de base de donnees

Le schema a jour est fourni dans `supabase/schema.sql`. Les tables/vues utilisees par l'app :

- `profiles` (infos utilisateur + `user_type`, preferences, coordonnees pro)
- `public_pro_profiles` (view des profils pro publics)
- `pro_specialties`
- `pro_portfolio_projects`
- `projects`
- `project_members`
- `project_messages` (legacy)
- `messages` (chat contextualise projet/phase/lot)
- `project_tasks`
- `task_learning_events`
- `phases`
- `lots`
- `phase_members`
- `tasks`
- `documents` (contextualise projet/phase/lot)
- `quotes`
- `invoices`
- `devis`
- `devis_items`
- `network_conversations`
- `network_conversation_members`
- `network_messages`

### 4. Authentification

Créer un fichier `lib/auth.ts` :

```typescript
import { supabase } from './supabase'
import { User } from '@/types'

export async function signUp(email: string, password: string, name: string, role: 'particulier' | 'professionnel') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      }
    }
  })
  return { data, error }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  
  // Récupérer les données utilisateur depuis la table users
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return userData as User
}
```

### 5. Mise à jour des pages

Remplacer les appels mockés dans :
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/dashboard/layout.tsx`

## 🤖 Intégration API IA

### 1. Configuration

Mettre à jour `lib/ai-service.ts` avec vos endpoints réels :

```typescript
const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL
const AI_API_KEY = process.env.NEXT_PUBLIC_AI_API_KEY

export async function sendMessageToAI(
  message: string,
  context: AIContext
): Promise<AIResponse> {
  const response = await fetch(`${AI_API_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      message,
      context,
    }),
  })
  
  if (!response.ok) {
    throw new Error('Erreur lors de l\'appel à l\'API IA')
  }
  
  return response.json()
}
```

### 2. Endpoints attendus

L'API IA doit exposer les endpoints suivants :

- `POST /chat` - Chat avec l'agent IA
- `POST /generate-project` - Génération de projet
- `POST /generate-quote` - Génération de devis
- `POST /search-products` - Recherche de produits BTP

### 3. Format des requêtes/réponses

Voir les types dans `lib/ai-service.ts` pour les formats attendus.

## 📦 Base de données produits BTP

### 1. Import des produits

Créer un script d'import dans `scripts/import-products.ts` :

```typescript
import { supabase } from '@/lib/supabase'
import products from '@/data/products.json' // Votre fichier JSON avec les produits

async function importProducts() {
  for (const product of products) {
    const { error } = await supabase
      .from('btp_products')
      .insert(product)
    
    if (error) {
      console.error('Erreur lors de l\'import:', error)
    }
  }
}

importProducts()
```

### 2. Recherche de produits

Créer une fonction dans `lib/products.ts` :

```typescript
import { supabase } from './supabase'
import { BTPProduct } from '@/types'

export async function searchProducts(query: string): Promise<BTPProduct[]> {
  const { data, error } = await supabase
    .from('btp_products')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(50)
  
  if (error) {
    console.error('Erreur lors de la recherche:', error)
    return []
  }
  
  return data as BTPProduct[]
}
```

## 🔔 Notifications en temps réel

Utiliser Supabase Realtime pour les notifications :

```typescript
import { supabase } from './supabase'

export function subscribeToAlerts(userId: string, callback: (alert: Alert) => void) {
  const channel = supabase
    .channel('alerts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload.new as Alert)
      }
    )
    .subscribe()
  
  return () => {
    supabase.removeChannel(channel)
  }
}
```

## 📄 Génération de PDF

Pour générer des devis/factures en PDF :

1. Installer une bibliothèque PDF (ex: `react-pdf` ou `pdfkit`)
2. Créer des templates dans `templates/`
3. Créer une fonction de génération dans `lib/pdf-generator.ts`

## ✅ Checklist d'intégration

- [ ] Configuration Supabase
- [ ] Création des tables
- [ ] Intégration authentification
- [ ] Remplacement des données mockées par des appels Supabase
- [ ] Configuration API IA
- [ ] Import des produits BTP
- [ ] Mise en place des notifications temps réel
- [ ] Tests de bout en bout
- [ ] Déploiement
