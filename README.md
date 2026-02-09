# Photon

Minimalistic photo collection MVP skeleton with role-based access control and face grouping. This repository includes a lightweight Node/Express API plus a static UI mock that reflects the desired UX direction.

## What’s Included
- **In-memory API** for authentication, collections, photos, face groups, and sharing.
- **RBAC middleware** that enforces Owner/Member/Viewer permissions.
- **Local storage mode** for photo uploads with environment toggles for future cloud mode.
- **Local face detection** powered by `@vladmandic/face-api` + TensorFlow.js (requires models).
- **Static UI** showcasing sidebar navigation, photo grid, and face-group toggle.

## Quick Start
```bash
npm install
npm run dev
```

Open `http://localhost:3000` to view the UI.

### Node.js Version (Windows)
If `npm install` fails on Windows when installing `@tensorflow/tfjs-node`, use Node 20 or 22 LTS. Node 24 often lacks prebuilt binaries and forces a native build that fails without full C++ tooling.

**Using nvm-windows (recommended):**
```bash
nvm install 22
nvm use 22
nvm alias default 22
```

Then reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

**Manual install:**
1. Uninstall Node 24 from Apps & Features.
2. Install Node 22 LTS from https://nodejs.org/en/download
3. Reinstall dependencies as above.

### Local Demo Logins (APP_ENV=local)
The local environment seeds demo users so you can test each role immediately:
- **Owner:** `owner@local.dev` / `owner123`
- **Member:** `member@local.dev` / `member123`
- **Viewer:** `viewer@local.dev` / `viewer123`

## Environment Variables
Create a `.env` file for configuration:
```
APP_ENV=local
STORAGE_TYPE=local
FACE_DETECTION_MODE=local
LOCAL_STORAGE_PATH=./storage
JWT_SECRET=replace-me
```

## Face Detection Models (Local)
For local face detection, download the face-api.js models into a `models/` folder:
```
mkdir -p models
curl -L https://github.com/vladmandic/face-api/raw/master/model/ssd_mobilenetv1_model-weights_manifest.json -o models/ssd_mobilenetv1_model-weights_manifest.json
curl -L https://github.com/vladmandic/face-api/raw/master/model/ssd_mobilenetv1_model-shard1 -o models/ssd_mobilenetv1_model-shard1
curl -L https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-weights_manifest.json -o models/face_landmark_68_model-weights_manifest.json
curl -L https://github.com/vladmandic/face-api/raw/master/model/face_landmark_68_model-shard1 -o models/face_landmark_68_model-shard1
curl -L https://github.com/vladmandic/face-api/raw/master/model/face_recognition_model-weights_manifest.json -o models/face_recognition_model-weights_manifest.json
curl -L https://github.com/vladmandic/face-api/raw/master/model/face_recognition_model-shard1 -o models/face_recognition_model-shard1
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
- Face detection runs locally when models are available; non-local modes fall back to mock embeddings.
- Storage is local by default; plug in Supabase or another provider via environment variables later.
