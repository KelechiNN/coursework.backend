// server.js  (CommonJS – works with your current setup)
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// Logger (for coursework marks)
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  if (["POST", "PUT"].includes(req.method)) {
    console.log("   Body:", req.body);
  }
  next();
});

// Static image middleware (for coursework marks)
app.use("/images", (req, res) => {
  const fileName = req.path.replace(/^\//, "");
  const filePath = path.join(__dirname, "images", fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ error: "Image file does not exist" });
    }
    res.sendFile(filePath);
  });
});

// ===== MongoDB =====
let db;

async function connectDB() {
  if (!uri) {
    console.error("❌ MONGO_URI is missing in .env");
    return;
  }
  try {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // uses DB name from connection string
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    db = null; // fall back to local data
  }
}

connectDB();

// ===== Fallback lessons (used if db is null) =====
const FALLBACK_LESSONS = [
  {
    id: "1",
    subject: "Math",
    location: "North London",
    price: 21,
    spaces: 5,
    description:
      "Improve your algebra, fractions, equations and problem-solving skills.",
    image: "math.jpg",
  },
  {
    id: "2",
    subject: "Science",
    location: "West London",
    price: 25,
    spaces: 6,
    description:
      "Learn physics, chemistry and biology with hands-on experiments.",
    image: "science.jpg",
  },
  {
    id: "3",
    subject: "English",
    location: "South London",
    price: 18,
    spaces: 7,
    description:
      "Grammar, comprehension, essay writing and reading confidence.",
    image: "english.jpg",
  },
  {
    id: "4",
    subject: "Art",
    location: "East London",
    price: 15,
    spaces: 4,
    description: "Creative drawing, painting and craft skills.",
    image: "art.jpg",
  },
];

// ===== Routes =====

// health check
app.get("/", (req, res) => {
  res.send("✅ Backend API is running. Try GET /lessons");
});

// GET /lessons  (for marks + frontend)
app.get("/lessons", async (req, res) => {
  try {
    if (!db) {
      console.warn("⚠️ DB not connected, returning fallback lessons.");
      return res.json(FALLBACK_LESSONS);
    }

    // IMPORTANT: collection name must match Atlas ("lessons" usually)
    const lessons = await db.collection("lessons").find({}).toArray();

    const normalised = lessons.map((l) => ({
      id: l._id.toString(),
      subject: l.subject,
      location: l.location,
      price: l.price,
      spaces: l.spaces,
      description: l.description,
      image: l.image,
    }));

    res.json(normalised);
  } catch (err) {
    console.error("Error fetching lessons:", err);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// (later: POST /orders, PUT /lessons/:id for marks)

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
