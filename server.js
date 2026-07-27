const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

// ===== CORS & JSON =====
app.use(cors());
app.use(express.json());

// ===== DATABASE =====
const db = new sqlite3.Database('./omnicore.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user'
  )`);
  db.get(`SELECT * FROM users WHERE username = 'ARZ'`, (err, row) => {
    if (!row) {
      db.run(`INSERT INTO users (username, password, role) VALUES ('ARZ', 'CORE V1', 'owner')`);
      db.run(`INSERT INTO users (username, password, role) VALUES ('EPIN', 'CORE V2', 'owner')`);
      db.run(`INSERT INTO users (username, password, role) VALUES ('manzz', 'CORE V3', 'owner')`);
    }
  });
});

// ===== ENDPOINT TEST =====
app.get('/api/stats', (req, res) => {
  res.json({
    online_users: 1,
    connections: 1,
    expiration: 'Lifetime',
    total_users: 3,
    total_logs: 0
  });
});

app.get('/', (req, res) => {
  res.send('🔥 OmniCore Backend Online!');
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
