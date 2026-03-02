'use strict';

require('dotenv').config();

const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT       = process.env.PORT       || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'onlygeneric_super_secret_jwt_key_change_me';

// ─── Database Pool ────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'onlygeneric',
  waitForConnections: true,
  connectionLimit:  10,
  timezone:         '+00:00',
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── POST /api/login ──────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error('[/api/login]', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── GET /api/suggestions?q=<partial_name> ────────────────────────────────────
// Returns all generic mappings whose prescribed_name contains the query string.
app.get('/api/suggestions', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);

  try {
    const [rows] = await pool.query(
      `SELECT prescribed_name, generic_name, prescribed_price, generic_price
         FROM medicine_mappings
        WHERE prescribed_name LIKE ?
        ORDER BY prescribed_name ASC, generic_name ASC
        LIMIT 50`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('[/api/suggestions]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── POST /api/mappings ───────────────────────────────────────────────────────
// Saves / updates medicine mappings + customer. Body: { mappings, customer? }
app.post('/api/mappings', authMiddleware, async (req, res) => {
  const { mappings, customer } = req.body || {};
  const hasMappings = Array.isArray(mappings) && mappings.length > 0;
  const hasCustomer = customer && /^\d{10}$/.test(customer.mobile || '');
  if (!hasMappings && !hasCustomer) {
    return res.status(400).json({ error: 'No data provided.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const m of (mappings || [])) {
      const prescribedName  = (m.prescribed_name  || '').toLowerCase().trim();
      const genericName     = (m.generic_name     || '').toLowerCase().trim();
      const prescribedPrice = parseFloat(m.prescribed_price) || 0;
      const genericPrice    = parseFloat(m.generic_price)    || 0;

      if (!prescribedName || !genericName) continue;

      await conn.execute(
        `INSERT INTO medicine_mappings
           (prescribed_name, generic_name, prescribed_price, generic_price, updated_at)
           VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           prescribed_price = VALUES(prescribed_price),
           generic_price    = VALUES(generic_price),
           updated_at       = NOW()`,
        [prescribedName, genericName, prescribedPrice, genericPrice]
      );
    }

    // Save / update customer if provided
    if (customer && customer.mobile && /^\d{10}$/.test(customer.mobile)) {
      await conn.execute(
        `INSERT INTO customers (mobile, customer_name, updated_at)
              VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE customer_name = VALUES(customer_name), updated_at = NOW()`,
        [customer.mobile, (customer.customer_name || '').trim()]
      );
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('[/api/mappings]', err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    conn.release();
  }
});

// ─── GET /api/customers?q=<partial_mobile> ────────────────────────────────────
app.get('/api/customers', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const [rows] = await pool.query(
      `SELECT mobile, customer_name
         FROM customers
        WHERE mobile LIKE ?
        ORDER BY mobile ASC
        LIMIT 15`,
      [`${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error('[/api/customers]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── GET /api/quotation-number ────────────────────────────────────────────────
// Atomically increments and returns the next quotation number.
app.get('/api/quotation-number', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      'UPDATE quotation_counter SET last_number = last_number + 1 WHERE id = 1'
    );
    const [rows] = await conn.execute(
      'SELECT last_number FROM quotation_counter WHERE id = 1'
    );

    await conn.commit();

    const num       = rows[0].last_number;
    const year      = new Date().getFullYear();
    const formatted = `OG-${year}-${String(num).padStart(4, '0')}`;

    res.json({ number: formatted, raw: num });
  } catch (err) {
    await conn.rollback();
    console.error('[/api/quotation-number]', err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    conn.release();
  }
});

// ─── Serve index.html for all non-API routes ──────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🏥  OnlyGeneric Quotation Generator`);
  console.log(`  ✅  Server running at http://localhost:${PORT}\n`);
});
