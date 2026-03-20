# ARTISIA

**Tout sur le BTP pour mieux vous accompagner**

Plateforme web BTP mettant en relation particuliers et professionnels, avec un agent IA central pour accompagner les projets de construction et rénovation.

## 🚀 Fonctionnalités

### Pour les particuliers
- Création de projets BTP via l'assistant IA
- Recherche et comparaison de professionnels
- Suivi des projets en temps réel
- Messagerie intégrée
- Comparateur de devis

### Pour les professionnels
- Accès à une base de données de +2200 produits BTP
- Génération automatique de devis et factures via l'IA
- Gestion complète des projets et chantiers
- Suivi des délais avec alertes automatiques
- Dashboard professionnel complet

## 🛠️ Stack technique

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Architecture**: Composants réutilisables, séparation UI/logique métier

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build de production
npm run build

# Lancer en production
npm start
```

Le site sera accessible sur [http://localhost:3000](http://localhost:3000)

## 📁 Structure du projet

```
Site_Artisia/
├── app/                    # Pages Next.js (App Router)
│   ├── dashboard/         # Dashboards utilisateurs
│   ├── chat/              # Page chat IA dédiée
│   ├── login/             # Page de connexion
│   ├── register/          # Page d'inscription
│   └── page.tsx           # Landing page
├── components/            # Composants React
│   ├── ui/                # Composants UI réutilisables
│   ├── layout/            # Layout (Sidebar, Header)
│   └── chat/              # Composants chat IA
├── lib/                   # Utilitaires et services
│   ├── ai-service.ts      # Service d'intégration IA (prêt à brancher)
│   └── utils.ts           # Fonctions utilitaires
├── types/                 # Types TypeScript
└── public/                # Assets statiques
```

## 🔌 Intégration IA

Le service d'intégration IA est prêt dans `lib/ai-service.ts`. Il contient des fonctions mockées qu'il faudra remplacer par des appels réels à votre API IA :

- `sendMessageToAI()` - Envoi de messages à l'agent IA
- `generateProjectWithAI()` - Génération de projets via l'IA
- `generateQuoteWithAI()` - Génération de devis via l'IA
- `searchProductsWithAI()` - Recherche de produits BTP via l'IA

## 🔐 Authentification

L'authentification est actuellement simulée. Pour intégrer Supabase :

1. Installer `@supabase/supabase-js`
2. Créer un fichier `.env.local` avec vos clés Supabase
3. Créer un service d'authentification dans `lib/auth.ts`
4. Remplacer les appels mockés dans les pages d'authentification

## 🎨 Design

- Style sobre et professionnel
- Palette de couleurs neutres et modernes
- Design responsive (mobile-friendly)
- Composants UI cohérents et réutilisables

## 📝 Pages disponibles

- `/` - Landing page
- `/register` - Inscription (particulier/professionnel)
- `/login` - Connexion
- `/dashboard` - Dashboard principal (adapté au rôle)
- `/dashboard/projets` - Liste des projets (pro)
- `/dashboard/devis` - Gestion des devis (pro)
- `/dashboard/professionnels` - Liste des professionnels (particulier)
- `/dashboard/messages` - Messagerie
- `/dashboard/settings` - Paramètres
- `/chat` - Page dédiée au chat IA

## 🚧 Prochaines étapes

1. **Intégration Supabase**
   - Configuration de la base de données
   - Authentification complète
   - CRUD pour projets, devis, messages

2. **Intégration IA**
   - Connexion à l'API IA existante
   - Implémentation des fonctions dans `ai-service.ts`
   - Gestion du contexte utilisateur

3. **Base de données produits BTP**
   - Import des +2200 produits
   - Interface de recherche et filtrage
   - Intégration dans la génération de devis

4. **Fonctionnalités avancées**
   - Notifications en temps réel
   - Génération de PDF (devis/factures)
   - Système de paiement
   - Évaluations et avis

## 📄 Licence

Propriétaire - ARTISIA

