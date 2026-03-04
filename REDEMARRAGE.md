# Redémarrage propre de NextMind

## Problème
L'erreur `useContext` et les 500 venaient de **Next.js 14.2.35** (bug connu).  
La version a été fixée à **14.2.18**.

## Étapes pour repartir proprement

### 1. Arrêter tous les serveurs Next.js
Dans chaque terminal où `npm run dev` tourne, appuyer sur **Ctrl+C**.

### 2. Libérer les ports (optionnel)
Si des processus restent bloqués sur les ports 3000–3003 :
```bash
lsof -ti:3000,3001,3002,3003 | xargs kill -9
```

### 3. Nettoyer le cache
```bash
cd "/Users/ugolesur/Desktop/dossier sans titre 2/nextmind"
rm -rf .next
```

### 4. Lancer le serveur
```bash
npm run dev
```

Le serveur démarre sur **http://localhost:3000** (ou 3001, 3002… si 3000 est pris).

---

## Si erreur "EMFILE: too many open files"
Sur macOS, augmenter la limite :
```bash
ulimit -n 10240
```
Puis relancer `npm run dev`.
