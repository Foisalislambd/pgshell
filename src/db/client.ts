import pg from 'pg';

let pool: pg.Pool | null = null;

export interface DBConnectionConfig {
  connectionString: string;
}

export function connect(config: DBConnectionConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      pool = new pg.Pool({
        connectionString: config.connectionString,
        ssl: config.connectionString.includes('sslmode=require') || config.connectionString.includes('amazonaws.com') || config.connectionString.includes('supabase.com') ? { rejectUnauthorized: false } : undefined
      });
      
      // Test the connection securely
      pool.query('SELECT 1')
        .then(() => resolve())
        .catch((err) => {
          pool = null;
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
    return p.end();
  }
  return Promise.resolve();
}

export async function query(text: string, params?: any[]): Promise<pg.QueryResult> {
  if (!pool) {
    throw new Error('Database not connected. Please connect first.');
  }
  return pool.query(text, params);
}
