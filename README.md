# OnlyGeneric — Quotation Generator

> Internal tool for generating professional medicine quotations comparing branded/prescribed medicines with generic alternatives (up to 70% savings).

---

## Tech Stack

| Layer    | Technology                     |
|----------|-------------------------------|
| Frontend | HTML + Vanilla JS + CSS (single file) |
| Backend  | Node.js + Express             |
| Database | MySQL                         |
| PDF      | jsPDF + jsPDF-AutoTable (CDN) |

---

## Prerequisites

- **Node.js** v16 or later — https://nodejs.org
- **MySQL** 5.7+ or 8.x running locally (or a remote instance)
- **npm** (bundled with Node.js)

---

## Setup Instructions

### 1. Clone / open the project folder

```bash
cd /path/to/onlygenric
```

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your MySQL credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```dotenv
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_root_password
DB_NAME=onlygeneric
PORT=8080
JWT_SECRET=change_this_to_a_long_random_secret
```

### 4. Create the database and tables

Log into MySQL and run the schema script:

```bash
mysql -u root -p < schema.sql
```

Or inside the MySQL shell:

```sql
SOURCE /full/path/to/onlygenric/schema.sql;
```

### 5. Seed the default admin user

```bash
npm run seed
```

This creates the default login:

| Username | Password        |
|----------|-----------------|
| `admin`  | `onlygeneric123` |

> You can run this command again at any time to reset the admin password.

### 6. Start the server

```bash
npm start
```

The app will be available at **http://localhost:8080**

---

## Usage

1. Open **http://localhost:8080** in your browser.
2. Log in with `admin` / `onlygeneric123`.
3. Fill in customer details (mobile number is mandatory, others are optional).
4. Add medicine rows — type in the **Prescribed Medicine** field to get autocomplete suggestions from past entries.
5. Fill in prices — **Savings** and the **Summary Bar** update in real time.
6. Click **Generate Quotation (PDF)**:
   - Medicine mappings are saved to the database.
   - A professional PDF is immediately downloaded in your browser.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/login` | — | Authenticate and receive JWT |
| GET | `/api/suggestions?q=<name>` | Bearer JWT | Fetch generic medicine suggestions |
| POST | `/api/mappings` | Bearer JWT | Save / update medicine mappings |
| GET | `/api/quotation-number` | Bearer JWT | Get next auto-incremented quotation number |

---

## Database Schema

```sql
users               (id, username, password_hash, created_at)
medicine_mappings   (id, prescribed_name, generic_name, generic_price, updated_at)
                    UNIQUE (prescribed_name, generic_name)
quotation_counter   (id, last_number)
```

---

## Project Structure

```
onlygenric/
├── index.html      ← Single-page frontend (login + quotation builder)
├── server.js       ← Express backend + all API routes
├── schema.sql      ← Database setup script (run once)
├── seed.js         ← Seeds the default admin user (run once)
├── package.json
├── .env.example    ← Copy to .env and fill in your config
└── README.md
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Error: connect ECONNREFUSED` | MySQL is not running — start your MySQL service |
| `Unknown database 'onlygeneric'` | Run `mysql < schema.sql` first |
| `Invalid username or password` | Run `npm run seed` to reset the admin user |
| Port 8080 already in use | Change `PORT=` in `.env` |
| jsPDF not loading | Check internet connection (CDN is required) |
