import { input, select, password, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { connect, disconnect, query as dbQuery, getAdminConnectionString, runOnDatabase } from '../db/client.js';
import { renderTable } from './tableRenderer.js';
import { getDbUrlFromEnv, printEnvHint } from '../db/env.js';
import { printBanner } from '../utils/banner.js';
import { sanitizeErrorMessage } from '../utils/sanitizeError.js';

export async function runInteractiveUI() {
  console.clear();
  printBanner();

  // Connection Phase
  let connected = false;
  let connectionString = getDbUrlFromEnv() || '';

  if (!connectionString) {
    printEnvHint();
  } else {
    console.log(chalk.gray('Found database credentials in .env file automatically.\n'));
  }

  while (!connected) {
    try {
      if (!connectionString) {
        const connType = await select({
          message: 'How would you like to connect to PostgreSQL right now?',
          choices: [
            { name: '🏠 Localhost (Interactive Setup)', value: 'local', description: 'Enter username, password, and port manually' },
            { name: '🌐 External / URI (Paste Connection String)', value: 'external', description: 'Paste a full postgres:// connection URL' }
          ]
        });

        if (connType === 'local') {
          const user = await input({ message: 'Username:', default: 'postgres' });
          const pass = await password({ message: 'Password:', mask: '*' });
          const host = await input({ message: 'Host:', default: 'localhost' });
          const port = await input({ message: 'Port:', default: '5432' });
          const db = await input({ message: 'Database Name:', default: 'postgres' });

          const encodedPass = encodeURIComponent(pass);
          connectionString = `postgresql://${user}:${encodedPass}@${host}:${port}/${db}`;
        } else {
          connectionString = await input({
            message: 'Enter your PostgreSQL connection string (DATABASE_URL):',
            validate: (val) => val.startsWith('postgres') ? true : 'Must be a valid Postgres connection string (postgres://... or postgresql://...)'
          });
        }
      }

      console.log(chalk.cyan('\nConnecting to database...'));
      const start = Date.now();
      await connect({ connectionString });
      connected = true;
      const ms = Date.now() - start;
      console.log(chalk.green(`✓ Connected successfully! (${ms}ms)\n`));
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      if (err?.name === 'ExitPromptError' || err?.message?.includes('SIGINT')) {
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        process.exit(0);
      }
      console.log(chalk.red(`\nConnection failed: ${sanitizeErrorMessage(error)}\n`));
      connectionString = ''; // Reset so they can type it again
    }
  }

  // Main Loop
  let exit = false;
  while (!exit) {
    try {
      const currentDb = await getCurrentDatabase();
      const dbLabel = currentDb ? chalk.dim(` │ 📂 ${currentDb}`) : '';

      const action = await select({
        message: chalk.bold('What would you like to do?') + dbLabel,
        pageSize: 18,
        choices: [
          { name: '📋 List all tables', value: 'list_tables', description: 'See what tables exist in the database' },
          { name: '🔍 View table data', value: 'view_table', description: 'Browse rows/records in any table' },
          { name: '📖 Table structure', value: 'describe_table', description: 'See columns, types, and details' },
          { name: '➕ Create new table', value: 'create_table', description: 'Create a new table easily' },
          { name: '📥 Add new row', value: 'insert_row', description: 'Insert a new record into a table' },
          { name: '🗑️  Delete one table', value: 'drop_table', description: 'Remove a single table' },
          { name: '🚨 Delete all tables', value: 'drop_all_tables', description: 'Warning! Removes all data' },
          { name: '⚡ Run custom SQL', value: 'run_query', description: 'Execute any SQL command' },
          { name: '📊 Monitor active queries', value: 'monitor', description: 'See what queries are running now' },
          { name: '📂 List all databases', value: 'list_databases', description: 'See all databases on the server' },
          { name: '➕ Create database', value: 'create_database', description: 'Create a new database' },
          { name: '🗑️  Delete database', value: 'drop_database', description: 'Remove a database (with confirmation)' },
          { name: '🔄 Switch database', value: 'switch_database', description: 'Reconnect to a different database' },
          { name: '❌ Disconnect & Exit', value: 'exit', description: 'Close connection and quit' }
        ]
      });

      switch (action) {
        case 'list_databases':
          await handleListDatabases();
          break;
        case 'create_database':
          await handleCreateDatabase();
          break;
        case 'drop_database':
          await handleDropDatabase();
          break;
        case 'switch_database':
          await handleSwitchDatabase();
          break;
        case 'list_tables':
          await handleListTables();
          break;
        case 'view_table':
          await handleViewTable();
          break;
        case 'describe_table':
          await handleDescribeTable();
          break;
        case 'create_table':
          await handleCreateTable();
          break;
        case 'insert_row':
          await handleInsertRow();
          break;
        case 'drop_table':
          await handleDropSpecificTable();
          break;
        case 'drop_all_tables':
          await handleDropAllTables();
          break;
        case 'run_query':
          await handleRunQuery();
          break;
        case 'monitor':
          await handleMonitor();
          break;
        case 'exit':
          exit = true;
          break;
      }
    } catch (err: unknown) {
      const e = err as Error & { name?: string };
      if (e?.name === 'ExitPromptError' || e?.message?.includes('SIGINT')) {
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        await disconnect();
        process.exit(0);
      }
      console.log(chalk.red(`\nError: ${sanitizeErrorMessage(err)}`));
    }
    
    if (!exit) {
      console.log('\n');
    }
  }

  await disconnect();
  console.log(chalk.blue('Goodbye! 👋\n'));
}

const GET_TABLES_SQL = `
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`;

const GET_DATABASES_SQL = `
  SELECT datname as "Database", pg_size_pretty(pg_database_size(datname)) as "Size"
  FROM pg_database
  WHERE datistemplate = false
  ORDER BY datname;
`;

async function getPublicTables(): Promise<{ table_name: string }[]> {
  const result = await dbQuery(GET_TABLES_SQL);
  return result.rows;
}

async function getCurrentDatabase(): Promise<string | null> {
  const r = await dbQuery('SELECT current_database() as db');
  return r.rows[0]?.db ?? null;
}

async function handleListDatabases() {
  const result = await dbQuery(GET_DATABASES_SQL);
  console.log(chalk.cyan('\nDatabases on server:'));
  renderTable(result.rows);
}

function validateDatabaseName(val: string): true | string {
  const trimmed = val.trim();
  if (trimmed.length === 0) return 'Database name cannot be empty';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return 'Use only letters, numbers, underscores (e.g. my_database)';
  return true;
}

async function handleCreateDatabase() {
  const dbName = await input({
    message: 'Enter new database name:',
    validate: validateDatabaseName
  });

  try {
    await dbQuery(`CREATE DATABASE "${dbName}"`);
    console.log(chalk.green(`\n✓ Database "${dbName}" created! You can switch to it from the menu anytime.`));
  } catch (err: unknown) {
    console.log(chalk.red(`\nFailed to create database: ${sanitizeErrorMessage(err)}`));
  }
}

async function handleDropDatabase() {
  const result = await dbQuery(GET_DATABASES_SQL);
  const databases = result.rows as { Database: string; Size: string }[];
  const currentDb = await getCurrentDatabase();

  if (databases.length === 0) {
    console.log(chalk.yellow('No databases found.'));
    return;
  }

  const dbToDrop = await select({
    message: 'Select a database to DROP:',
    choices: databases.map((r) => ({
      name: `${r.Database} (${r.Size})` + (r.Database === currentDb ? ' [current]' : ''),
      value: r.Database
    }))
  });

  const isSure = await confirm({
    message: `Are you sure you want to DROP database "${dbToDrop}"? All data will be permanently lost!`,
    default: false
  });

  if (!isSure) {
    console.log(chalk.gray('\nOperation cancelled.'));
    return;
  }

  try {
    const postgresUrl = dbToDrop === currentDb ? getAdminConnectionString('postgres') : null;
    await runOnDatabase('postgres', async (adminPool) => {
      await adminPool.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [dbToDrop]);
      await adminPool.query(`DROP DATABASE "${dbToDrop}"`);
    });
    console.log(chalk.green(`\n✓ Database "${dbToDrop}" dropped successfully!`));
    if (dbToDrop === currentDb && postgresUrl) {
      console.log(chalk.yellow('\nYou were connected to that database. Reconnecting to postgres...'));
      await disconnect();
      await connect({ connectionString: postgresUrl });
      console.log(chalk.green('✓ Reconnected to postgres.'));
    }
  } catch (err: unknown) {
    console.log(chalk.red(`\nFailed to drop database: ${sanitizeErrorMessage(err)}`));
  }
}

async function handleSwitchDatabase() {
  const result = await dbQuery(GET_DATABASES_SQL);
  const databases = result.rows as { Database: string; Size: string }[];
  const currentDb = await getCurrentDatabase();

  if (databases.length === 0) {
    console.log(chalk.yellow('No databases found.'));
    return;
  }

  const dbToSwitch = await select({
    message: 'Select database to connect to:',
    choices: databases.map((r) => ({
      name: `${r.Database} (${r.Size})` + (r.Database === currentDb ? ' [current]' : ''),
      value: r.Database
    }))
  });

  if (dbToSwitch === currentDb) {
    console.log(chalk.gray('\nAlready connected to that database.'));
    return;
  }

  const newUrl = getAdminConnectionString(dbToSwitch);
  const fallbackUrl = getAdminConnectionString(currentDb || 'postgres');
  if (!newUrl) {
    console.log(chalk.red('\nCould not build connection string.'));
    return;
  }

  try {
    await disconnect();
    await connect({ connectionString: newUrl });
    console.log(chalk.green(`\n✓ You're now working with "${dbToSwitch}".`));
  } catch (err: unknown) {
    console.log(chalk.red(`\nFailed to switch: ${sanitizeErrorMessage(err)}`));
    if (fallbackUrl) {
      console.log(chalk.yellow('Attempting to reconnect to previous database...'));
      try {
        await connect({ connectionString: fallbackUrl });
        console.log(chalk.green('✓ Reconnected to previous database.'));
      } catch {
        console.log(chalk.red('Reconnection failed. You may need to reconnect manually.'));
      }
    }
  }
}

async function handleListTables() {
  const sql = `
    SELECT 
      t.table_schema AS "Schema",
      t.table_name AS "Table",
      t.table_type AS "Type",
      COALESCE(pt.tableowner, '-') AS "Owner",
      COALESCE(pst.n_live_tup::text, '-') AS "Est. Rows"
    FROM information_schema.tables t
    LEFT JOIN pg_tables pt ON pt.tablename = t.table_name AND pt.schemaname = t.table_schema
    LEFT JOIN pg_stat_user_tables pst ON pst.relname = t.table_name AND pst.schemaname = t.table_schema
    WHERE t.table_schema = 'public'
    ORDER BY t.table_name;
  `;
  const result = await dbQuery(sql);
  renderTable(result.rows);
}

async function handleDescribeTable() {
  const tables = await getPublicTables();
  if (tables.length === 0) {
    console.log(chalk.yellow('No tables found in public schema.'));
    return;
  }
  const tableName = await select({
    message: 'Select a table to describe:',
    choices: tables.map(r => ({ name: r.table_name, value: r.table_name }))
  });

  const sql = `
    SELECT 
        column_name as "Column", 
        data_type as "Type", 
        is_nullable as "Nullable", 
        column_default as "Default"
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position;
  `;
  
  const result = await dbQuery(sql, [tableName]);
  console.log(chalk.cyan(`\nStructure of table "${tableName}":`));
  renderTable(result.rows);
}

async function handleViewTable() {
  const tables = await getPublicTables();
  if (tables.length === 0) {
    console.log(chalk.yellow('No tables found in public schema.'));
    return;
  }
  const tableName = await select({
    message: 'Select a table to view:',
    choices: tables.map(r => ({ name: r.table_name, value: r.table_name }))
  });

  const limit = await input({
    message: 'How many rows to fetch?',
    default: '10',
    validate: (val) => !isNaN(Number(val)) ? true : 'Please enter a valid number'
  });

  const result = await dbQuery(`SELECT * FROM "${tableName}" LIMIT $1`, [Number(limit)]);
  console.log(chalk.cyan(`\nShowing up to ${limit} rows from "${tableName}":`));
  renderTable(result.rows);
}

function getInsertHint(columnName: string, dataType: string, isAutoInc: boolean, columnDefault: string | null): string {
  if (isAutoInc) return chalk.dim(' [leave blank for auto]');
  const lower = columnName.toLowerCase();
  const type = dataType.toLowerCase();
  const hasDefault = columnDefault && !columnDefault.includes('nextval');

  if (type.includes('timestamp') || type === 'date') return chalk.dim(' [leave blank for NOW()]');
  if (type.includes('boolean') || type === 'bool') return chalk.dim(' [true/false]');
  if (type.includes('int') || type === 'serial' || type === 'bigserial') return chalk.dim(' [e.g. 42]');
  if (type.includes('uuid')) return chalk.dim(' [e.g. 550e8400-e29b-41d4-a716-446655440000]');
  if ((type.includes('varchar') || type === 'text' || type.includes('character')) && lower.includes('email')) return chalk.dim(' [e.g. user@example.com]');
  if ((type.includes('varchar') || type === 'text') && (lower.includes('name') || lower.includes('title'))) return chalk.dim(' [e.g. John Doe]');
  if (hasDefault) return chalk.dim(' [leave blank for default]');
  return chalk.dim(' [leave blank for NULL]');
}

async function handleInsertRow() {
  const tables = await getPublicTables();
  if (tables.length === 0) {
    console.log(chalk.yellow('No tables found to insert data into.'));
    return;
  }
  const tableName = await select({
    message: 'Select a table to insert into:',
    choices: tables.map(r => ({ name: r.table_name, value: r.table_name }))
  });

  // Get column info to prompt user correctly
  const colInfo = await dbQuery(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position;
  `, [tableName]);

  const rowData: Record<string, string> = {};
  console.log(chalk.dim(`\nInserting a new row into "${tableName}". Leave blank to use DEFAULT/NULL.`));

  for (const col of colInfo.rows) {
    const isAutoInc = col.column_default && col.column_default.includes('nextval');
    const hint = getInsertHint(col.column_name, col.data_type, isAutoInc, col.column_default);

    const value = await input({
      message: `${col.column_name} (${col.data_type})${hint}:`,
    });

    if (value.trim() !== '') {
      rowData[col.column_name] = value;
    }
  }

  if (Object.keys(rowData).length === 0) {
    console.log(chalk.yellow('\nNo data provided. Insert cancelled.'));
    return;
  }

  const cols = Object.keys(rowData).map(c => `"${c}"`).join(', ');
  const placeholders = Object.keys(rowData).map((_, i) => `$${i + 1}`).join(', ');
  const values = Object.values(rowData);

  const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) RETURNING *;`;
  
  try {
    const result = await dbQuery(sql, values);
    console.log(chalk.green(`\n✓ Your new record was added!`));
    renderTable(result.rows);
  } catch (err: unknown) {
    console.log(chalk.red(`\nFailed to insert row: ${sanitizeErrorMessage(err)}`));
  }
}

function validateTableName(val: string): true | string {
  const trimmed = val.trim();
  if (trimmed.length === 0) return 'Table name cannot be empty';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return 'Use only letters, numbers, underscores (e.g. my_table)';
  return true;
}

function validateColumnsDef(val: string): true | string {
  const trimmed = val.trim();
  if (trimmed.length === 0) return 'Columns definition cannot be empty';
  if (trimmed.includes(';')) return 'Semicolons are not allowed (security)';
  if (trimmed.includes('--')) return 'SQL comments (--) are not allowed (security)';
  if (trimmed.includes('/*') || trimmed.includes('*/')) return 'Block comments are not allowed (security)';
  const dangerous = /\b(DROP|DELETE|TRUNCATE|ALTER|EXEC|EXECUTE)\s+/i;
  if (dangerous.test(trimmed)) return 'Dangerous SQL keywords are not allowed in column definition';
  return true;
}

async function handleCreateTable() {
  const tableName = await input({ 
    message: 'Enter new table name:',
    validate: validateTableName
  });
  
  const columns = await input({
    message: 'Enter columns definition (e.g. id SERIAL PRIMARY KEY, name VARCHAR(50)):',
    validate: validateColumnsDef
  });

  const sql = `CREATE TABLE "${tableName}" (${columns});`;
  
  try {
    await dbQuery(sql);
    console.log(chalk.green(`\n✓ Table "${tableName}" is ready! Use "View table data" or "Add new row" to start using it.`));
  } catch (err: unknown) {
    console.log(chalk.red(`\nFailed to create table: ${sanitizeErrorMessage(err)}`));
  }
}

async function handleDropSpecificTable() {
  const tables = await getPublicTables();
  if (tables.length === 0) {
    console.log(chalk.yellow('No tables found in public schema.'));
    return;
  }
  const tableName = await select({
    message: 'Select a table to DROP:',
    choices: tables.map(r => ({ name: r.table_name, value: r.table_name }))
  });

  const isSure = await confirm({ 
    message: `Are you sure you want to drop table "${tableName}"? (This will also drop dependent objects)`, 
    default: false 
  });

  if (isSure) {
    await dbQuery(`DROP TABLE "${tableName}" CASCADE;`);
    console.log(chalk.green(`\n✓ Table "${tableName}" dropped successfully!`));
  } else {
    console.log(chalk.gray('\nOperation cancelled.'));
  }
}

async function handleDropAllTables() {
  const tables = await getPublicTables();
  if (tables.length === 0) {
    console.log(chalk.yellow('No tables found in the database.'));
    return;
  }
  console.log(chalk.red.bold(`\n⚠️  WARNING: You are about to drop ALL ${tables.length} tables in the public schema!`));
  
  const isSure = await confirm({ 
    message: 'Are you absolutely sure you want to proceed? THIS CANNOT BE UNDONE!', 
    default: false 
  });

  if (isSure) {
    const tableNames = tables.map(r => `"${r.table_name}"`).join(', ');
    await dbQuery(`DROP TABLE ${tableNames} CASCADE;`);
    console.log(chalk.green(`\n✓ All tables dropped successfully!`));
  } else {
    console.log(chalk.gray('\nOperation cancelled.'));
  }
}

async function handleRunQuery() {
  const sql = await input({
    message: 'Enter your SQL query:'
  });

  if (!sql.trim()) return;

  try {
    const result = await dbQuery(sql);
    const commandLabel = result.command || 'query';
    const rowCount = result.rowCount !== null ? `(${result.rowCount} rows)` : '';
    console.log(chalk.green(`\n✓ Done! ${chalk.bold(commandLabel)} ${rowCount}`));
    if (result.rows && result.rows.length > 0) {
      renderTable(result.rows);
    }
  } catch (err: unknown) {
    console.log(chalk.red(`\nQuery failed: ${sanitizeErrorMessage(err)}`));
  }
}

async function handleMonitor() {
  const sql = `
    SELECT pid, usename, state, query_start, query
    FROM pg_stat_activity
    WHERE state != 'idle' AND pid != pg_backend_pid()
    ORDER BY query_start DESC;
  `;
  const result = await dbQuery(sql);
  
  if (result.rows.length === 0) {
    console.log(chalk.green('No active queries right now.'));
  } else {
    console.log(chalk.cyan('\nActive Queries:'));
    renderTable(result.rows);
  }
}
