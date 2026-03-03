<p align="center">
  <a href="https://www.npmjs.com/package/pgshell"><img src="https://img.shields.io/npm/v/pgshell?color=cb3837&logo=npm" alt="npm" /></a>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-ISC-blue.svg" alt="License" />
</p>

<h1 align="center">PgShell</h1>
<p align="center">
  <strong>All-in-one powerful and human-friendly PostgreSQL CLI Manager</strong>
</p>

<p align="center">
  <em>Explore, modify, and monitor PostgreSQL databases from the terminal — no GUI required.</em>
</p>

---

## ✨ What is PgShell?

PgShell is a terminal-based tool that gives you full control over PostgreSQL through an **interactive menu** and **direct query mode**. Connect to local or cloud databases, browse tables, run SQL, monitor activity — all from your favorite terminal.

| | |
|---|---|
| 🖥️ | **Interactive UI** — Guided menus for common tasks |
| ⚡ | **Direct queries** — `pgshell query "SELECT * FROM users"` |
| 🔐 | **Flexible config** — `.env`, URI, or interactive setup |
| 📊 | **Formatted output** — Clean tables with syntax highlighting |

---

## 📋 Table of Contents

- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Interactive UI](#-interactive-ui)
- [Direct Query Mode](#-direct-query-mode)
- [Examples](#-examples)
- [Project Structure](#-project-structure)
- [License](#-license)

---

## 🛠 Requirements

- **Node.js** 18+
- **PostgreSQL** server (local or remote)
- Database credentials

---

## 📦 Installation

**Quick install** — Use PgShell from anywhere with a single command:

```bash
npm install -g pgshell
```

Then run:

```bash
pgshell
# or
pgshell query "SELECT * FROM users LIMIT 5"
```

---

**From source** (for development or contribution):

```bash
git clone https://github.com/Foisalislambd/pgshell
cd pgshell
npm install
npm run build
```

Run the interactive UI:

```bash
node dist/index.js
# or
npx tsx src/index.ts
```

**Development** (with hot reload):

```bash
npm run dev
```

**Local link** (run from source without publishing):

```bash
npm link
pgshell
```

---

## ⚙️ Configuration

PgShell reads credentials from a `.env` file in the **current directory** where you run `pgshell`. Create it in your project folder before running.

### Option 1 — Individual variables

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=your_database
```

### Option 2 — Connection URL

```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

> `DATABASE_URL` overrides individual variables if both exist.

### Option 3 — Standard PostgreSQL vars

```env
PGUSER=postgres
PGPASSWORD=yourpassword
PGHOST=localhost
PGPORT=5432
PGDATABASE=yourdatabase
```

### Cloud & SSL

SSL is enabled automatically for `sslmode=require`, `amazonaws.com`, or `supabase.com` in the connection string.

---

## 🚀 Usage

1. Install: `npm install -g pgshell`
2. Create a `.env` file in your project directory (see [Configuration](#-configuration))
3. Run `pgshell` — PgShell connects automatically; otherwise it prompts for connection details

---

## 📱 Interactive UI

Run `pgshell` or `pgshell ui` to open the interactive menu. Works with or without `.env`.

| Menu Option | Description |
|-------------|-------------|
| 📂 **List all databases** | See all databases on the server with sizes |
| ➕ **Create database** | Create a new database |
| 🗑️ **Delete database** | Drop a database (with confirmation) |
| 🔄 **Switch database** | Reconnect to a different database |
| 📋 **List all tables** | Tables in `public` schema with owner and row estimates |
| 🔍 **View table data** | Browse rows with configurable limit |
| 📖 **Table structure** | Columns, types, nullability, defaults |
| ➕ **Create new table** | Define tables with column syntax |
| 📥 **Add new row** | Insert with guided prompts per column |
| 🗑️ **Delete one table** | Drop a single table (with confirmation) |
| 🚨 **Delete all tables** | Drop all `public` tables (extra confirmation) |
| ⚡ **Run custom SQL** | Execute any SQL command |
| 📊 **Monitor active queries** | Live view of running queries |
| ❌ **Disconnect & Exit** | Close connection and quit |

### Connection (when no `.env`)

1. **Localhost** — Enter host, port, user, password, database
2. **External / URI** — Paste full `postgresql://` connection string

### Tips

- **Ctrl+C** — Safe exit
- Blank insert fields → use DEFAULT or NULL
- Table and database names: letters, numbers, underscores only
- Dangerous SQL is blocked in table creation
- When you drop the database you're connected to, PgShell automatically reconnects to `postgres`

---

## ⚡ Direct Query Mode

Run a single query without the UI. Requires `.env` credentials.

```bash
pgshell query "SELECT * FROM users LIMIT 5"
```

## 📂 Database Commands

Run database operations from the CLI. Requires `.env` credentials.

```bash
# List all databases
pgshell list

# Create a database
pgshell create my_database

# Drop a database (prompts for confirmation)
pgshell drop my_database

# Drop without confirmation
pgshell drop my_database --yes
```

```bash
# Select
pgshell query "SELECT * FROM products WHERE price > 100"

# Count
pgshell query "SELECT COUNT(*) FROM orders"

# Insert
pgshell query "INSERT INTO logs (message) VALUES ('test')"
```

Results appear as formatted tables. Exits with code 1 on errors.

---

## 📝 Examples

**List tables**

```bash
pgshell
# → List all tables
```

**Create table**

```bash
pgshell
# → Create new table
# Name: users
# Columns: id SERIAL PRIMARY KEY, email VARCHAR(255), created_at TIMESTAMP DEFAULT NOW()
```

**Insert row**

```bash
pgshell
# → Add new row → select table → enter values
```

**Quick query**

```bash
pgshell query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
```

---

## 📂 Project Structure

```
pgshell/
├── src/
│   ├── index.ts              # CLI entry, Commander
│   ├── commands/query.ts     # Direct query command
│   ├── db/
│   │   ├── client.ts         # Connection pool
│   │   └── env.ts            # .env credentials
│   ├── ui/
│   │   ├── mainMenu.ts       # Interactive menu
│   │   └── tableRenderer.ts  # Result formatting
│   └── utils/
│       ├── banner.ts         # ASCII banner
│       └── sanitizeError.ts  # Error sanitization
├── .env.example
├── package.json
└── README.md
```

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run with hot reload |
| `npm run build` | Build to `dist/` |
| `npm start` | Run built output |

---

## 📄 License

ISC
