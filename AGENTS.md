# Firebase Class Word Cloud - AGENTS.md

## Project Entry

Project name: Firebase Class Word Cloud
Project purpose: Realtime classroom keyword collection and word cloud display for teaching activities.
Main work directory: I:\我的雲端硬碟\2026database
GitHub repo: https://github.com/regman520/firebase-wordcloud
Default branch: main

## Obsidian Note

Obsidian vault: I:\我的雲端硬碟\2nd Brain\obsidian
Project cockpit: firebase-wordcloud/專案工作流程.md
Update this cockpit first during shutdown.

The project cockpit is a note inside the Obsidian vault, not a Markdown progress file in this repo.

## Desk And Three Homes

- Work desk: I:\我的雲端硬碟\2026database
- GitHub: https://github.com/regman520/firebase-wordcloud
- Obsidian: I:\我的雲端硬碟\2nd Brain\obsidian + firebase-wordcloud/專案工作流程.md
- Firebase: fir-1-b887a

## Sync Rules

Startup:
- Use the `startup-sync` workflow when the user says "開工".
- Read this file.
- Read the Obsidian cockpit.
- Check Git status.
- Do not automatically pull, commit, push, or deploy.

Shutdown:
- Use the `shutdown-sync` workflow when the user says "收工".
- Update the Obsidian cockpit with progress and next steps.
- Update this file only if stable project rules, paths, deployment targets, or boundaries changed.
- Commit and push only when requested or clearly part of the task.

Project initialization:
- Use the `project-init-sync` workflow when the user says "新專案初始化" or asks to install lazy pack #07.

## Main Files

Entry file: public/index.html
Frontend logic: public/app.js
Styles: public/styles.css
Firebase config: firebase.json, .firebaserc
Firestore rules: firestore.rules
Deployment: Firebase Hosting at https://fir-1-b887a.web.app

## Commands

Deploy Firebase rules and hosting:

```powershell
npx.cmd -y firebase-tools@latest deploy --only firestore:rules,hosting
```

Check Git status:

```powershell
git status --short --branch
```

## Do Not Do

- Do not write daily progress into AGENTS.md.
- Do not automatically include unrelated Git changes.
- Do not commit API keys, tokens, Firebase Admin credentials, passwords, or `.env` files.
- Do not commit `.codex/`, `.claude/`, `.firebase/`, `node_modules/`, or local screenshots.
- Do not store student real names. Formal data should use seat numbers and class codes.
