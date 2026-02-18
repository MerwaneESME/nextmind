# Mission Projet – Visu, tests agent, idées

## Objectif
Améliorer le **visuel** sur la partie Projet et proposer des changements/idées concrets.  
**But métier :** faciliter la **communication** sur un projet (petit, moyen ou grand).  
*Travail uniquement sur nextmind (pas d’autre backend).*

---

## Structure actuelle (à garder en tête)

```
Projet
  └── contrôlé par un chef de projet
        └── Interventions  (= lots dans la base : sous-traitants ou équipe interne)
              └── génèrent des tâches d’action sur le chantier
```

- **Projet** : `projects` (nom, type, adresse, client, membres).
- **Interventions** : en base ce sont les **lots** (`lots`), rattachés à une **phase** (`phases`). Chaque lot peut avoir un responsable, des tâches (`lot_tasks`), un budget.
- **Phases** : regroupent les lots (ex. « Gros œuvre », « Second œuvre »). Une phase a un `phase_manager`.
- **Tâches** : au niveau projet (`project_tasks`) ou au niveau lot (`lot_tasks`).

Dans l’UI :
- **Dashboard > Projets** : liste des projets.
- **Projet [id]** : onglets Aperçu, **Interventions**, Chat, Devis, Planning, Membres, **Assistant IA**, Guide.
- **Interventions** : liste des lots ; clic → **Intervention [id]** = page détail d’un lot (tâches, chat, budget, assistant).

---

## 1. Visu – Ce qui a été / peut être amélioré

- **Liste des projets** : cartes avec statut, progression, budget, nombre d’interventions (déjà en place ; on peut affiner couleurs et hiérarchie).
- **Onglet Aperçu projet** : blocs Infos, Tâches, Interventions (résumé) ; rendre la hiérarchie Projet → Interventions → Tâches plus claire.
- **Onglet Interventions** : cartes par intervention (nom, statut, tâches faites/total, budget, dates, entreprise) ; barre de progression. Idée : distinguer visuellement « sous-traitant » vs « interne » si l’info existe.
- **Cohérence** : utiliser `statusColors` (phase / project / lot) partout pour les badges de statut.

---

## 2. Assistant IA (hors périmètre actuel)

On ne travaille que sur **nextmind**. L’onglet **Assistant IA** (projet et intervention) est prêt côté UI ; il pourra être branché plus tard à une API de ton choix via `NEXT_PUBLIC_AI_API_URL` et `lib/ai-service.ts`. Pour l’instant, pas besoin de configurer ou tester un backend externe.

---

## 3. À changer ou retirer (idées concrètes)

- **Doublons / confusion** :  
  - « Devis » apparaît en onglet projet et peut-être ailleurs ; clarifier « Devis du projet » vs devis par lot/intervention si besoin.  
  - S’assurer que partout on parle d’**Interventions** (et pas « lots » dans l’UI) pour rester aligné avec le métier.

- **Onglets** :  
  - Beaucoup d’onglets sur la fiche projet (Aperçu, Interventions, Chat, Devis, Planning, Membres, Assistant IA, Guide). Idée : garder les essentiels bien visibles (Aperçu, Interventions, Chat, Assistant IA) et regrouper le reste (ex. Devis + Planning dans « Suivi », ou sous-menu) si on veut alléger.

- **Guide** : si peu utilisé, le laisser en secondaire ou le fusionner avec un bloc « Aide » à côté de l’assistant.

- **Planning** : si deux plannings (projet vs tâches par lot) coexistent, éviter la redondance ; un seul endroit « Planning » avec filtres (par projet / par intervention) peut suffire.

- **Membres** : distinguer clairement **Chef de projet**, **Client**, **Intervenants** (sous-traitants / internes) pour faciliter la com.

---

## 4. Idées pour faciliter la com sur le projet

- **Fil de discussion** (déjà là en onglet Chat) : le garder bien visible ; éventuellement un indicateur « X nouveaux messages ».
- **Résumé projet** : sur l’aperçu, un encart « En bref » (statut, prochaine échéance, blocage éventuel) alimenté par les tâches + l’agent si possible.
- **Notifications / alertes** : rappels tâches en retard, devis en attente de validation (si pas déjà en place).
- **Rôle par intervention** : afficher qui est responsable de quelle intervention (sous-traitant / entreprise) pour que le chef de projet et le client s’y retrouvent.
- **Export** : PDF ou mail de synthèse « état du projet » (dates, tâches, budget) pour partage rapide avec le client ou la maîtrise d’œuvre.

---

## 5. Récap technique rapide

| Élément        | Fichiers / lieu |
|----------------|------------------|
| Liste projets  | `app/dashboard/projets/page.tsx` |
| Détail projet  | `app/dashboard/projets/[id]/page.tsx` |
| Détail intervention (lot) | `app/dashboard/projets/[id]/interventions/[interventionId]/page.tsx` |
| Assistant IA (UI) | `lib/ai-service.ts` (à brancher plus tard) |
| Couleurs / badges | `lib/design/colors.ts`, `components/ui/Badge.tsx` |

---

*Document rédigé pour la mission : amélioration visu projet, tests avec l’agent, propositions concrètes.*
