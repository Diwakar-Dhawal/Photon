# Photon

Minimalistic photo collection MVP skeleton with role-based access control and face grouping. This repository includes a lightweight Node/Express API plus a static UI mock that reflects the desired UX direction.

## What’s Included
- **In-memory API** for authentication, collections, photos, face groups, and sharing.
- **RBAC middleware** that enforces Owner/Member/Viewer permissions.
- **Local storage mode** for photo uploads with environment toggles for future cloud mode.
- **Static UI** showcasing sidebar navigation, photo grid, and face-group toggle.

## Quick Start
```bash
npm install
npm run dev
```

Open `http://localhost:3000` to view the UI.

## Environment Variables
Create a `.env` file for configuration:
```
APP_ENV=local
STORAGE_TYPE=local
FACE_DETECTION_MODE=local
LOCAL_STORAGE_PATH=./storage
JWT_SECRET=replace-me
```

## API Summary
```
POST /auth/register
POST /auth/login
GET  /auth/me

GET  /collections
POST /collections
DELETE /collections/:id
POST /collections/:id/share

POST /photos/upload
GET  /collections/:id/photos
DELETE /photos/:id

GET  /collections/:id/faces
GET  /faces/:id/photos
```

## Notes
- Face detection is mocked with random embeddings to illustrate the workflow.
- Storage is local by default; plug in Supabase or another provider via environment variables later.
