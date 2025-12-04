// server.js  (CommonJS – matches your current package.json)
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

async function connectDB() {
  if (!uri) return;
  try {
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // uses the DB name from your connection string
    console.log("✅ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    db = null; // fall back to local data
  }
}

connectDB();

// ======= fallback lesson data (used when db is null) =======
const FALLBACK_LESSONS = [
  {
    id: "1",
    subject: "Math",
    location: "North London",
    price: 20,
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

// GET /lessons  (coursework: REST API + fetch GET)
app.get("/lessons", async (req, res) => {
  try {
    // If DB isn't connected (TLS drama on your laptop),
    // fall back to the hard-coded lessons above.
    if (!db) {
      console.warn("DB not connected, returning FALLBACK_LESSONS.");
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

// POST /orders  (coursework: save new order)
app.post("/orders", async (req, res) => {
  const { name, phone, email, items, total } = req.body;

  if (!name || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid order data" });
  }

  // If DB not connected locally, act like a "demo save" so front-end doesn’t break
  if (!db) {
    console.warn("DB not connected, accepting order in DEMO mode only.");
    return res.status(200).json({
      message: "Order accepted (demo – DB not connected on this machine)",
      demo: true,
    });
  }

  try {
    // coursework says: minimal fields name, phone, lesson IDs, number of spaces
    const lessonIDs = [];
    let totalSpaces = 0;

    items.forEach((item) => {
      if (item.lessonId && item.quantity) {
        // on Render, lessonId will be the stringified _id
        try {
          lessonIDs.push(new ObjectId(item.lessonId));
        } catch {
          // if it isn’t a valid ObjectId, just store raw id
          lessonIDs.push(item.lessonId);
        }
        totalSpaces += Number(item.quantity);
      }
    });

    const orderDoc = {
      name,
      phone,
      email: email || null,
      lessonIDs,
      spaces: totalSpaces,
      items,
      total,
      createdAt: new Date(),
    };

    const result = await db.collection("orders").insertOne(orderDoc);

    res.status(201).json({
      message: "Order saved",
      orderId: result.insertedId,
    });
  } catch (err) {
    console.error("Error saving order:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

// PUT /lessons/:id  (coursework: update any attribute, esp. spaces)
app.put("/lessons/:id", async (req, res) => {
  const { id } = req.params;

  // If DB not connected locally, behave as demo
  if (!db) {
    console.warn(
      `DB not connected, pretending to update lesson ${id} in DEMO mode.`
    );
    return res.status(200).json({
      message: "Lesson update accepted (demo – DB not connected)",
      demo: true,
    });
  }

  try {
    const updateFields = {};
    // allow updating any of these attributes
    ["subject", "location", "price", "spaces", "description", "image"].forEach(
      (field) => {
        if (req.body[field] !== undefined) {
          updateFields[field] = req.body[field];
        }
      }
    );

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const filter = { _id: new ObjectId(id) };

    const result = await db.collection("lesson").updateOne(filter, {
      $set: updateFields,
    });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    res.json({ message: "Lesson updated", modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error("Error updating lesson:", err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

// ======= start server =======
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
