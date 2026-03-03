import pg from 'pg';

let pool: pg.Pool | null = null;
let storedConnectionString: string | null = null;

export interface DBConnectionConfig {
  connectionString: string;
}

/** Returns connection string for admin operations (e.g. connect to postgres DB) */
export function getAdminConnectionString(targetDb = 'postgres'): string | null {
  if (!storedConnectionString) return null;
  // Replace database name in URL with target (e.g. postgres for DROP DATABASE)
  return storedConnectionString.replace(/\/([^/]+)(\?.*)?$/, (_, _db, q = '') => `/${targetDb}${q}`);
}

/** Returns the current connection string, or null if not connected */
export function getConnectionString(): string | null {
  return storedConnectionString;
}

export function connect(config: DBConnectionConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      storedConnectionString = config.connectionString;
      pool = new pg.Pool({
        connectionString: config.connectionString,
        ssl: config.connectionString.includes('sslmode=require') || config.connectionString.includes('amazonaws.com') || config.connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined
      });
      
      // Test the connection securely
      pool.query('SELECT 1')
        .then(() => resolve())
        .catch((err) => {
          pool = null;
          storedConnectionString = null;
          reject(err);
        });
    } catch (err) {
      reject(err);
    }
  });
}

export function disconnect(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    storedConnectionString = null;
    return p.end();
  }
  storedConnectionString = null;
  return Promise.resolve();
}

export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
  if (!pool) {
    throw new Error('Database not connected. Please connect first.');
  }
  return pool.query(text, params);
}

/** Run a query on a different database (e.g. postgres). Used for DROP DATABASE etc. */
export async function runOnDatabase<T>(
  targetDb: string,
  fn: (client: pg.Pool) => Promise<T>
): Promise<T> {
  const adminUrl = getAdminConnectionString(targetDb);
  if (!adminUrl) throw new Error('Not connected. Cannot run admin operation.');
  const adminPool = new pg.Pool({
    connectionString: adminUrl,
    ssl: adminUrl.includes('sslmode=require') || adminUrl.includes('amazonaws.com') || adminUrl.includes('supabase.com') ? { rejectUnauthorized: false } : undefined
  });
  try {
    return await fn(adminPool);
  } finally {
    await adminPool.end();
  }
}
