# Firebase Class Word Cloud

A realtime classroom word cloud built with Firebase Hosting and Cloud Firestore.

## Features

- Realtime Firestore submissions from the `wordcloud_words` collection
- Canvas-rendered word cloud with responsive layout
- Top keyword ranking and latest submission chips
- Firebase Hosting deployment-ready static files

## Firebase

Project ID: `fir-1-b887a`

Deploy rules and hosting:

```powershell
npx.cmd -y firebase-tools@latest deploy --only firestore:rules,hosting
```
