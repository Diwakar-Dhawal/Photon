import fs from "fs";
import path from "path";
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import {
  detectFacesFromBuffer,
  ensureModelsPresent,
  initializeFaceDetection,
} from "./faceDetection.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  appEnv: process.env.APP_ENV || "local",
  storageType: process.env.STORAGE_TYPE || "local",
  faceDetectionMode: process.env.FACE_DETECTION_MODE || "local",
  localStoragePath: process.env.LOCAL_STORAGE_PATH || "./storage",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
};

const db = {
  users: [],
  collections: [],
  photos: [],
  faceGroups: [],
  permissions: [],
};

const seedDemoUsers = () => {
  if (config.appEnv !== "local" || db.users.length > 0) {
    return;
  }
  const now = new Date().toISOString();
  const demoUsers = [
    {
      id: nanoid(),
      name: "Local Owner",
      email: "owner@local.dev",
      password: bcrypt.hashSync("owner123", 10),
      role: "OWNER",
      createdAt: now,
    },
    {
      id: nanoid(),
      name: "Local Member",
      email: "member@local.dev",
      password: bcrypt.hashSync("member123", 10),
      role: "MEMBER",
      createdAt: now,
    },
    {
      id: nanoid(),
      name: "Local Viewer",
      email: "viewer@local.dev",
      password: bcrypt.hashSync("viewer123", 10),
      role: "VIEWER",
      createdAt: now,
    },
  ];
  db.users.push(...demoUsers);
};

const ensureStorage = () => {
  if (!fs.existsSync(config.localStoragePath)) {
    fs.mkdirSync(config.localStoragePath, { recursive: true });
  }
};

ensureStorage();
seedDemoUsers();

app.use(express.json());
app.use("/ui", express.static(path.join(process.cwd(), "ui")));
app.use("/uploads", express.static(config.localStoragePath));

let faceModelsReady = false;

if (config.faceDetectionMode === "local") {
  initializeFaceDetection()
    .then((ready) => {
      faceModelsReady = ready;
      if (!ready) {
        console.warn("Face detection models missing. See README.md to install.");
      }
    })
    .catch((error) => {
      console.error("Face detection initialization failed:", error);
    });
}

const authRequired = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.users.find((item) => item.id === payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
};

const getCollectionPermission = (collectionId, userId) =>
  db.permissions.find(
    (permission) =>
      permission.collectionId === collectionId &&
      permission.userId === userId,
  );

const canViewCollection = (collection, user) => {
  if (!collection) return false;
  if (user.role === "OWNER") return true;
  const permission = getCollectionPermission(collection.id, user.id);
  return Boolean(permission);
};

const canEditCollection = (collection, user) => {
  if (!collection) return false;
  if (user.role === "OWNER") return true;
  const permission = getCollectionPermission(collection.id, user.id);
  return permission?.role === "OWNER" || permission?.role === "MEMBER";
};

const uploader = multer({ dest: path.join(config.localStoragePath, "tmp") });

const createFaceEmbedding = () =>
  Array.from({ length: 8 }, () => Math.random().toFixed(4)).join(":");

const groupFaces = (collectionId, faceEmbeddings) => {
  const groups = [];
  faceEmbeddings.forEach((embedding) => {
    const existingGroup = db.faceGroups.find(
      (group) => group.collectionId === collectionId,
    );
    if (existingGroup) {
      groups.push(existingGroup.id);
    } else {
      const newGroup = {
        id: nanoid(),
        collectionId,
        faceEmbedding: embedding,
        label: null,
      };
      db.faceGroups.push(newGroup);
      groups.push(newGroup.id);
    }
  });
  return groups;
};

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "ui", "index.html"));
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    environment: config.appEnv,
    storage: config.storageType,
    faceDetection: config.faceDetectionMode,
  });
});

app.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (db.users.find((user) => user.email === email)) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    name,
    email,
    password: hashed,
    role: "MEMBER",
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  return res.status(201).json({ id: user.id, email: user.email });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find((item) => item.email === email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: "8h",
  });
  return res.json({ token });
});

app.get("/auth/me", authRequired, (req, res) => {
  const { password, ...safeUser } = req.user;
  res.json(safeUser);
});

app.get("/collections", authRequired, (req, res) => {
  const visible = db.collections.filter((collection) =>
    canViewCollection(collection, req.user),
  );
  res.json(visible);
});

app.post(
  "/collections",
  authRequired,
  requireRole(["OWNER", "MEMBER"]),
  (req, res) => {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Missing name" });
    }
    const collection = {
      id: nanoid(),
      name,
      description: description || "",
      createdBy: req.user.id,
      visibility: "private",
      createdAt: new Date().toISOString(),
    };
    db.collections.push(collection);
    db.permissions.push({
      id: nanoid(),
      userId: req.user.id,
      collectionId: collection.id,
      role: "OWNER",
    });
    return res.status(201).json(collection);
  },
);

app.delete("/collections/:id", authRequired, (req, res) => {
  const collection = db.collections.find((item) => item.id === req.params.id);
  if (!collection) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!canEditCollection(collection, req.user)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  db.collections = db.collections.filter((item) => item.id !== collection.id);
  db.photos = db.photos.filter((item) => item.collectionId !== collection.id);
  db.faceGroups = db.faceGroups.filter(
    (item) => item.collectionId !== collection.id,
  );
  db.permissions = db.permissions.filter(
    (item) => item.collectionId !== collection.id,
  );
  return res.status(204).send();
});

app.post(
  "/collections/:id/share",
  authRequired,
  requireRole(["OWNER", "MEMBER"]),
  (req, res) => {
    const { email, role } = req.body;
    const collection = db.collections.find((item) => item.id === req.params.id);
    if (!collection) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!canEditCollection(collection, req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const targetUser = db.users.find((item) => item.email === email);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const normalizedRole = ["OWNER", "MEMBER", "VIEWER"].includes(role)
      ? role
      : "VIEWER";
    const existing = getCollectionPermission(collection.id, targetUser.id);
    if (existing) {
      existing.role = normalizedRole;
      return res.json(existing);
    }
    const permission = {
      id: nanoid(),
      userId: targetUser.id,
      collectionId: collection.id,
      role: normalizedRole,
    };
    db.permissions.push(permission);
    return res.status(201).json(permission);
  },
);

app.post(
  "/photos/upload",
  authRequired,
  uploader.single("photo"),
  async (req, res) => {
    const { collectionId } = req.body;
    const collection = db.collections.find((item) => item.id === collectionId);
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    if (!canViewCollection(collection, req.user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Missing file" });
    }
    const fileName = `${nanoid()}-${req.file.originalname}`;
    const targetPath = path.join(config.localStoragePath, fileName);
    fs.renameSync(req.file.path, targetPath);

    let detectedFaces = [];
    if (config.faceDetectionMode === "local") {
      if (!faceModelsReady && ensureModelsPresent()) {
        faceModelsReady = await initializeFaceDetection();
      }
      if (!faceModelsReady) {
        return res.status(503).json({
          error: "Face detection models are not available.",
          hint: "Download models into /models and restart the server.",
        });
      }
      try {
        const buffer = fs.readFileSync(targetPath);
        detectedFaces = await detectFacesFromBuffer(buffer);
      } catch (error) {
        return res.status(500).json({ error: "Face detection failed." });
      }
    } else {
      detectedFaces = Array.from({ length: 2 }, () => ({
        embedding: createFaceEmbedding(),
      }));
    }
    const groupIds = groupFaces(
      collectionId,
      detectedFaces.map((face) => face.embedding),
    );
    const photo = {
      id: nanoid(),
      collectionId,
      uploadedBy: req.user.id,
      storagePath: `/uploads/${fileName}`,
      detectedFaces,
      faceGroupIds: groupIds,
      createdAt: new Date().toISOString(),
    };
    db.photos.push(photo);
    return res.status(201).json(photo);
  },
);

app.get("/collections/:id/photos", authRequired, (req, res) => {
  const collection = db.collections.find((item) => item.id === req.params.id);
  if (!collection) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!canViewCollection(collection, req.user)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const photos = db.photos.filter(
    (item) => item.collectionId === collection.id,
  );
  res.json(photos);
});

app.delete("/photos/:id", authRequired, (req, res) => {
  const photo = db.photos.find((item) => item.id === req.params.id);
  if (!photo) {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.user.role !== "OWNER" && photo.uploadedBy !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  db.photos = db.photos.filter((item) => item.id !== photo.id);
  return res.status(204).send();
});

app.get("/collections/:id/faces", authRequired, (req, res) => {
  const collection = db.collections.find((item) => item.id === req.params.id);
  if (!collection) {
    return res.status(404).json({ error: "Not found" });
  }
  if (!canViewCollection(collection, req.user)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const groups = db.faceGroups.filter(
    (item) => item.collectionId === collection.id,
  );
  res.json(groups);
});

app.get("/faces/:id/photos", authRequired, (req, res) => {
  const group = db.faceGroups.find((item) => item.id === req.params.id);
  if (!group) {
    return res.status(404).json({ error: "Not found" });
  }
  const collection = db.collections.find(
    (item) => item.id === group.collectionId,
  );
  if (!collection || !canViewCollection(collection, req.user)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const photos = db.photos.filter((photo) =>
    photo.faceGroupIds?.includes(group.id),
  );
  res.json(photos);
});

app.listen(PORT, () => {
  console.log(`Photon running on http://localhost:${PORT}`);
});
