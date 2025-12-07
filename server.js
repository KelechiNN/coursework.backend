// server.js  (CommonJS version)
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;

// ======= basic middleware =======
app.use(cors());
app.use(express.json());

// A) logger middleware – required by coursework
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  if (req.method === "POST" || req.method === "PUT") {
    console.log("   Body:", req.body);
  }
  next();
});

// B) static file middleware for lesson images
//    Put any test images in a folder called /images next to server.js
app.use("/images", (req, res) => {
  const fileName = req.path.replace(/^\//, ""); // remove leading /
  const filePath = path.join(__dirname, "images", fileName);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // explicit error message if file does not exist
      return res.status(404).json({ error: "Image file does not exist" });
    }
    res.sendFile(filePath);
  });
});

// ======= Mongo connection =======
if (!uri) {
  console.error("❌ ERROR: MONGO_URI missing from .env");
}

let db;

// on your laptop TLS may fail => db stays null
async function connectDB() {
  if (!uri) return;
  try {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // uses DB from the connection string
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    db = null; // important: keep app running with fallback
  }
}

connectDB();

// ======= fallback lesson data (used when db is null) =======
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
  {
    id: "5",
    subject: "Music",
    location: "Central London",
    price: 22,
    spaces: 5,
    description:
      "Rhythm, melody and performance across different instruments.",
    image: "music.jpg",
  },
  {
    id: "6",
    subject: "History",
    location: "North London",
    price: 19,
    spaces: 9,
    description: "Important events, people and timelines from the past.",
    image: "history.jpg",
  },
  {
    id: "7",
    subject: "Geography",
    location: "East London",
    price: 17,
    spaces: 6,
    description: "Maps, climates, natural disasters and the environment.",
    image: "geography.jpg",
  },
  {
    id: "8",
    subject: "Coding",
    location: "Central London",
    price: 30,
    spaces: 10,
    description: "Programming basics, logic and building simple apps.",
    image: "coding.jpg",
  },
  {
    id: "9",
    subject: "Drama",
    location: "West London",
    price: 16,
    spaces: 5,
    description: "Acting, improvisation and performance confidence.",
    image: "drama.jpg",
  },
  {
    id: "10",
    subject: "Sports",
    location: "South London",
    price: 12,
    spaces: 7,
    description: "Teamwork, fitness and a mix of popular sports.",
    image: "sports.jpg",
  },
];

// ======= routes =======

// health check
app.get("/", (req, res) => {
  res.send("✅ Backend API is running. Try GET /lessons");
});

// A) GET /lessons  (coursework: REST API + Postman + fetch)
app.get("/lessons", async (req, res) => {
  try {
    // If DB isn't connected (TLS problem locally),
    // fall back to the hard-coded lessons above.
    if (!db) {
      console.warn("DB not connected, returning fallback lessons.");
      return res.json(FALLBACK_LESSONS);
    }

    const lessons = await db.collection("lesson").find({}).toArray();

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
// ---------- GET /search?q=term ----------
app.get("/search", async (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  try {
    let lessons = [];

    if (!db) {
      // No MongoDB connection → use fallback lessons
      console.warn("Using FALLBACK_LESSONS in /search (no db).");
      lessons = FALLBACK_LESSONS.map(normaliseLesson);
    } else {
      // MongoDB is connected → get all lessons first
      const docs = await db.collection("lesson").find({}).toArray();
      lessons = docs.map(normaliseLesson);
    }

    // If no query string, just return all lessons (same as /lessons)
    if (!q) {
      return res.json(lessons);
    }

    // Filter in Node: subject, location, price, spaces
    const filtered = lessons.filter((l) => {
      const text = `${l.subject} ${l.location} ${l.price} ${l.spaces}`.toLowerCase();
      return text.includes(q);
    });

    return res.json(filtered);
  } catch (err) {
    console.error("Error in GET /search:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// B) POST /orders  (coursework: save new order)
app.post("/orders", async (req, res) => {
  try {
    const { name, phone, email, items, total } = req.body;

    if (!name || !phone || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "name, phone and items are required" });
    }

    const orderDoc = {
      name,
      phone,
      email: email || null,
      items, // [{ lessonId, quantity, price }]
      total: total || 0,
      createdAt: new Date(),
    };

    if (!db) {
      console.warn("DB not connected, mocking order save.");
      console.log("Mock order payload:", orderDoc);
      return res
        .status(201)
        .json({ message: "Order received (mock, no DB)", order: orderDoc });
    }

    const result = await db.collection("orders").insertOne(orderDoc);
    res
      .status(201)
      .json({ message: "Order stored", orderId: result.insertedId.toString() });
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// C) PUT /lessons/:id  (coursework: update lesson attributes, esp. spaces)
app.put("/lessons/:id", async (req, res) => {
  const { id } = req.params;
  const update = req.body || {};

  try {
    if (!db) {
      // fallback: update in-memory array
      const idx = FALLBACK_LESSONS.findIndex((l) => l.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: "Lesson not found (fallback)" });
      }
      FALLBACK_LESSONS[idx] = { ...FALLBACK_LESSONS[idx], ...update };
      return res.json({
        message: "Lesson updated (fallback, no DB)",
        lesson: FALLBACK_LESSONS[idx],
      });
    }

    const result = await db
      .collection("lesson")
      .updateOne({ _id: new ObjectId(id) }, { $set: update });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({
      message: "Lesson updated",
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error updating lesson:", err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
