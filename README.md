# Firebase Class Word Cloud

A realtime classroom word cloud built with Firebase Hosting and Cloud Firestore.

Live site: https://fir-1-b887a.web.app

## Features

- Realtime Firestore submissions from the `wordcloud_words` collection
- Canvas-rendered word cloud with responsive layout
- Top keyword ranking and latest submission chips
- Firebase Hosting deployment-ready static files

## Project Files

- `public/index.html`: page structure
- `public/styles.css`: responsive classroom UI
- `public/app.js`: Firebase connection, submissions, realtime listener, and canvas word cloud
- `firestore.rules`: classroom demo write/read rules for `wordcloud_words`
- `firebase.json`: Firestore and Hosting deployment config
- `AGENTS.md`: Codex project working rules

## Firebase

Project ID: `fir-1-b887a`

Deploy rules and hosting:

```powershell
npx.cmd -y firebase-tools@latest deploy --only firestore:rules,hosting
```

## Work Mode

This project follows lazy pack #07:

- Say `開工` to resume from `AGENTS.md`, Obsidian cockpit, and Git status.
- Say `收工` to record progress in Obsidian and optionally commit/push.
- Keep stable rules in `AGENTS.md`; keep progress notes in Obsidian.

Obsidian cockpit:

```text
I:\我的雲端硬碟\2nd Brain\obsidian\firebase-wordcloud\專案工作流程.md
```

## Safety

- Do not commit Firebase Admin credentials, tokens, or `.env` files.
- Firebase frontend config is public by design.
- For formal student data, use seat numbers and class codes instead of real names.
