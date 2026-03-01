import { input, select, password, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { connect, disconnect, query as dbQuery } from '../db/client.js';
import { renderTable } from './tableRenderer.js';
import { getDbUrlFromEnv, printEnvHint } from '../db/env.js';

export async function runInteractiveUI() {
  console.clear();
  console.log(chalk.blue.bold(`\n🚀 Welcome to pgshell - The All-In-One PostgreSQL Manager\n`));

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
      await connect({ connectionString });
      connected = true;
      console.log(chalk.green('✓ Connected successfully!\n'));
    } catch (error: any) {
      if (error.name === 'ExitPromptError' || error.message?.includes('SIGINT')) {
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        process.exit(0);
      }
      console.log(chalk.red(`\nConnection failed: ${error.message}\n`));
      connectionString = ''; // Reset so they can type it again
    }
  }

  // Main Loop
  let exit = false;
  while (!exit) {
    try {
      const action = await select({
        message: 'What would you like to do?',
        choices: [
          { name: '📋 List Tables', value: 'list_tables' },
          { name: '🔍 View Table Data', value: 'view_table' },
          { name: '➕ Create Table', value: 'create_table' },
          { name: '🗑️  Drop Specific Table', value: 'drop_table' },
          { name: '🚨 Drop ALL Tables (Danger)', value: 'drop_all_tables' },
          { name: '⚡ Run Custom SQL Query', value: 'run_query' },
          { name: '📊 Monitor Active Queries', value: 'monitor' },
          { name: '❌ Disconnect & Exit', value: 'exit' }
        ]
      });

      switch (action) {
        case 'list_tables':
          await handleListTables();
          break;
        case 'view_table':
          await handleViewTable();
          break;
        case 'create_table':
          await handleCreateTable();
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
    } catch (err: any) {
      // Catch graceful exits from inner prompts
      if (err.name === 'ExitPromptError' || err.message?.includes('SIGINT')) {
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        await disconnect();
        process.exit(0);
      }
      // Any generic database error inside the loop
      console.log(chalk.red(`\nError: ${err.message}`));
    }
    
    if (!exit) {
      console.log('\n'); // Spacing between actions
    }
  }

  await disconnect();
  console.log(chalk.blue('Goodbye! 👋\n'));
}

// ------------------------------------------------------------------
// Sub-routines for Actions
// ------------------------------------------------------------------

async function handleListTables() {
  const sql = `
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  const result = await dbQuery(sql);
  renderTable(result.rows);
}

async function handleViewTable() {
  const tablesResult = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  if (tablesResult.rows.length === 0) {
    console.log(chalk.yellow('No tables found in public schema.'));
    return;
  }

  const tableName = await select({
    message: 'Select a table to view:',
    choices: tablesResult.rows.map(r => ({ name: r.table_name, value: r.table_name }))
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

async function handleCreateTable() {
  const tableName = await input({ 
    message: 'Enter new table name:',
    validate: (val) => val.trim().length > 0 ? true : 'Table name cannot be empty'
  });
  
  const columns = await input({
    message: 'Enter columns definition (e.g. id SERIAL PRIMARY KEY, name VARCHAR(50)):',
    validate: (val) => val.trim().length > 0 ? true : 'Columns definition cannot be empty'
  });

  const sql = `CREATE TABLE "${tableName}" (${columns});`;
  
  try {
    await dbQuery(sql);
    console.log(chalk.green(`\n✓ Table "${tableName}" created successfully!`));
  } catch (err: any) {
    // We catch locally here so the main loop doesn't print generic error
    console.log(chalk.red(`\nFailed to create table: ${err.message}`));
  }
}

async function handleDropSpecificTable() {
  const tablesResult = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  if (tablesResult.rows.length === 0) {
    console.log(chalk.yellow('No tables found in public schema.'));
    return;
  }

  const tableName = await select({
    message: 'Select a table to DROP:',
    choices: tablesResult.rows.map(r => ({ name: r.table_name, value: r.table_name }))
  });

  const isSure = await confirm({ 
    // Kept plain text to avoid Inquirer terminal width bugs with Chalk
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
  const tablesResult = await dbQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);

  if (tablesResult.rows.length === 0) {
    console.log(chalk.yellow('No tables found in the database.'));
    return;
  }

  console.log(chalk.red.bold(`\n⚠️  WARNING: You are about to drop ALL ${tablesResult.rows.length} tables in the public schema!`));
  
  const isSure = await confirm({ 
    // Removed chalk wrapping inside prompt message to prevent rendering bugs
    message: 'Are you absolutely sure you want to proceed? THIS CANNOT BE UNDONE!', 
    default: false 
  });

  if (isSure) {
    const tableNames = tablesResult.rows.map(r => `"${r.table_name}"`).join(', ');
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

  const result = await dbQuery(sql);
  
  const commandLabel = result.command || 'query';
  const rowCount = result.rowCount !== null ? `(${result.rowCount} rows affected)` : '';
  
  console.log(chalk.green(`\nExecuted successfully: ${chalk.bold(commandLabel)} ${rowCount}`));
  
  if (result.rows && result.rows.length > 0) {
    renderTable(result.rows);
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
