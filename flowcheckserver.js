const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// MySQL connection configuration
const dbConfig = {
  host: "127.0.0.1",       // safer than 'localhost'
  user: "root",
  password: "roott",       // ⚠️ replace with your actual MySQL password
  database: "flowcheck",
  connectTimeout: 10000
};
let db;

function handleDisconnect() {
  db = mysql.createConnection(dbConfig);

  db.connect((err) => {
    if (err) {
      console.error("❌ Error connecting to database:", err.message);
      setTimeout(handleDisconnect, 2000);
    }
  });

  db.on("error", (err) => {
    console.error("❌ Database error:", err.message);
    if (err.code === "PROTOCOL_CONNECTION_LOST") {
      handleDisconnect();
    } else {
      throw err;
    }
  });
}

handleDisconnect();

// ── SIGNUP ──
app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, birthday, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (first_name, last_name, email, birthday, password_hash) VALUES (?, ?, ?, ?, ?)",
    [firstName, lastName, email, birthday, hash],
    (err) => {
      if (err) return res.json({ error: err.message });
      res.json({ message: "Signup successful!" });
    }
  );
});

// ── LOGIN ──
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.query("SELECT * FROM users WHERE email=?", [email], async (err, results) => {
    if (err) return res.json({ error: err.message });
    if (results.length === 0) return res.json({ error: "Invalid email" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.json({ error: "Invalid password" });

    const token = crypto.randomBytes(32).toString("hex");

    db.query("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [user.id, token], (sessErr) => {
      if (sessErr) return res.json({ error: sessErr.message });
      res.json({ token, user: { id: user.id, name: user.first_name, email: user.email } });
    });
  });
});

// ── TASKS ──

// Get tasks for a user
app.get("/tasks/:userId", (req, res) => {
  const userId = req.params.userId;
  db.query("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, results) => {
    if (err) return res.json({ error: "Error fetching tasks" });
    res.json(results);
  });
});

// Add a new task
app.post("/tasks", (req, res) => {
  const { userId, title, description } = req.body;
  db.query(
    "INSERT INTO tasks (user_id, title, description) VALUES (?, ?, ?)",
    [userId, title, description || null],
    (err) => {
      if (err) return res.json({ error: "Error adding task" });
      res.json({ message: "Task added successfully!" });
    }
  );
});

// Update task status
app.put("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;
  db.query("UPDATE tasks SET status=? WHERE id=?", [status, taskId], (err) => {
    if (err) return res.json({ error: "Error updating task" });
    res.json({ message: "Task updated successfully!" });
  });
});

// Delete a task
app.delete("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  db.query("DELETE FROM tasks WHERE id=?", [taskId], (err) => {
    if (err) return res.json({ error: "Error deleting task" });
    res.json({ message: "Task deleted successfully!" });
  });
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});