# Study Notes

React notes app with section-based notes, edit/delete, search, import/export, smooth UI motion, and optional Firebase Firestore sync.

## Run Locally

```bash
npm install
npm run dev
```

## Firebase Setup

1. Create a Firebase project.
2. Add a Web App in Firebase project settings.
3. Enable Cloud Firestore.
4. Copy `.env.example` to `.env` and fill in the Firebase web config values.
5. Restart the Vite dev server.

The app stores notes in:

```text
noteWorkspaces/{VITE_FIREBASE_WORKSPACE_ID}
```

If `VITE_FIREBASE_WORKSPACE_ID` is empty, the app creates a browser-specific workspace ID and stores it locally. Use the same workspace ID across devices if you want the same notes to appear everywhere.

For a simple private test project, your Firestore rules can temporarily allow your own app to read/write. Tighten these rules before sharing the app publicly.
