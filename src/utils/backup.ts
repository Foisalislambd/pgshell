import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import pg from 'pg';

export interface BackupResult {
  path: string;
  success: boolean;
  error?: string;
}

/** Escape a value for SQL INSERT statement */
function escapeSqlValue(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number' && !Number.isFinite(val)) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (Buffer.isBuffer(val)) return `E'\\x${val.toString('hex')}'`;
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

/** Get the default backup folder path */
function getBackupFolder(): string {
  const envFolder = process.env.PGSHELL_BACKUP_FOLDER;
  if (envFolder) return envFolder;
  return join(process.cwd(), 'backups');
}

/**
 * Create database backup using pure Node.js (pg library).
 * No pg_dump required - works on any device.
 */
export async function createDatabaseBackup(connectionString: string): Promise<BackupResult> {
  const backupFolder = getBackupFolder();
  await mkdir(backupFolder, { recursive: true });

  const url = new URL(connectionString.replace(/^postgres:/, 'postgresql:'));
  const pathname = url.pathname.replace(/^\//, '') || 'postgres';
  const database = pathname.split('?')[0] || 'postgres';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeDbName = database.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeDbName}_${timestamp}.sql`;
  const backupPath = join(backupFolder, filename);

  const pool = new pg.Pool({
    connectionString,
    ssl:
      connectionString.includes('sslmode=require') ||
      connectionString.includes('amazonaws.com') ||
      connectionString.includes('supabase.com')
        ? { rejectUnauthorized: false }
        : undefined,
  });

  try {
    const lines: string[] = [
      '-- pgshell backup (pure Node.js, no pg_dump required)',
      `-- Database: ${database}`,
      `-- Created: ${new Date().toISOString()}`,
      '',
      '-- Disable FK checks during restore (PostgreSQL)',
      "SET session_replication_role = 'replica';",
      '',
    ];

    // Get all user tables (excluding system schemas)
    const tablesResult = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

    for (const row of tablesResult.rows) {
      const schema = row.table_schema as string;
      const tableName = row.table_name as string;
      const fullName = schema === 'public' ? `"${tableName}"` : `"${schema}"."${tableName}"`;

      // Get column definitions for CREATE TABLE
      const colsResult = await pool.query(
        `
        SELECT column_name, data_type, character_maximum_length,
               is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
        [schema, tableName]
      );

      const colDefs = colsResult.rows.map((c) => {
        let def = `"${c.column_name}" ${c.data_type}`;
        if (c.character_maximum_length)
          def += `(${c.character_maximum_length})`;
        if (c.is_nullable === 'NO') def += ' NOT NULL';
        if (c.column_default) def += ` DEFAULT ${c.column_default}`;
        return def;
      });

      lines.push(`-- Table: ${fullName}`);
      lines.push(`DROP TABLE IF EXISTS ${fullName} CASCADE;`);
      lines.push(`CREATE TABLE ${fullName} (`);
      lines.push(colDefs.join(',\n'));
      lines.push(');');
      lines.push('');

      // Dump data
      const dataResult = await pool.query({
        text: `SELECT * FROM ${schema === 'public' ? `"${tableName}"` : `"${schema}"."${tableName}"`}`,
        rowMode: 'array',
      });

      if (dataResult.rows.length > 0) {
        const columns = dataResult.fields!.map((f) => `"${f.name}"`);
        const batchSize = 100;
        for (let i = 0; i < dataResult.rows.length; i += batchSize) {
          const batch = dataResult.rows.slice(i, i + batchSize);
          const values = batch
            .map(
              (row) =>
                `(${row.map((v: unknown) => escapeSqlValue(v)).join(', ')})`
            )
            .join(',\n  ');
          lines.push(
            `INSERT INTO ${fullName} (${columns.join(', ')}) VALUES\n  ${values};`
          );
        }
        lines.push('');
      }
    }

    lines.push("SET session_replication_role = 'origin';");
    lines.push('');

    await writeFile(backupPath, lines.join('\n'), 'utf8');
    await pool.end();
    return { path: backupPath, success: true };
  } catch (err) {
    await pool.end();
    return {
      path: backupPath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
