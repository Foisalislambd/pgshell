import chalk from 'chalk';
import readline from 'readline';
import { connect, disconnect, query, runOnDatabase } from '../db/client.js';
import { renderTable } from '../ui/tableRenderer.js';
import { getDbUrlFromEnv, printEnvHint } from '../db/env.js';
import { sanitizeErrorMessage } from '../utils/sanitizeError.js';

function validateDatabaseName(val: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val.trim());
}

export async function executeDbListCommand() {
  const connectionString = getDbUrlFromEnv();

  if (!connectionString) {
    console.error(chalk.red('\nError: Missing database credentials.\n'));
    printEnvHint();
    process.exit(1);
  }

  try {
    await connect({ connectionString });
    const result = await query(`
      SELECT datname as "Database", pg_size_pretty(pg_database_size(datname)) as "Size"
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);
    console.log(chalk.cyan('\nDatabases on server:'));
    renderTable(result.rows);
  } catch (error: unknown) {
    console.error(chalk.red(`\nError: ${sanitizeErrorMessage(error)}`));
    process.exit(1);
  } finally {
    await disconnect();
  }
}

export async function executeDbCreateCommand(name: string) {
  const connectionString = getDbUrlFromEnv();

  if (!connectionString) {
    console.error(chalk.red('\nError: Missing database credentials.\n'));
    printEnvHint();
    process.exit(1);
  }

  const dbName = name.trim();
  if (!dbName) {
    console.error(chalk.red('\nError: Database name cannot be empty.\n'));
    process.exit(1);
  }
  if (!validateDatabaseName(dbName)) {
    console.error(chalk.red('\nError: Database name must use only letters, numbers, underscores (e.g. my_database).\n'));
    process.exit(1);
  }

  try {
    await connect({ connectionString });
    await query(`CREATE DATABASE "${dbName}"`);
    console.log(chalk.green(`\n✓ Database "${dbName}" created successfully!`));
  } catch (error: unknown) {
    console.error(chalk.red(`\nError: ${sanitizeErrorMessage(error)}`));
    process.exit(1);
  } finally {
    await disconnect();
  }
}

function promptConfirmation(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y|yes$/i.test(answer.trim()));
    });
  });
}

export async function executeDbDropCommand(name: string, force = false) {
  const connectionString = getDbUrlFromEnv();

  if (!connectionString) {
    console.error(chalk.red('\nError: Missing database credentials.\n'));
    printEnvHint();
    process.exit(1);
  }

  const dbName = name.trim();
  if (!dbName) {
    console.error(chalk.red('\nError: Database name cannot be empty.\n'));
    process.exit(1);
  }
  if (!validateDatabaseName(dbName)) {
    console.error(chalk.red('\nError: Database name must use only letters, numbers, underscores.\n'));
    process.exit(1);
  }

  if (!force) {
    const confirmed = await promptConfirmation(
      chalk.yellow(`\nAre you sure you want to DROP database "${dbName}"? All data will be lost. (y/N): `)
    );
    if (!confirmed) {
      console.log(chalk.gray('Cancelled.'));
      process.exit(0);
    }
  }

  try {
    await connect({ connectionString });
    await runOnDatabase('postgres', async (adminPool) => {
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      );
      await adminPool.query(`DROP DATABASE "${dbName}"`);
    });
    console.log(chalk.green(`\n✓ Database "${dbName}" dropped successfully!`));
  } catch (error: unknown) {
    console.error(chalk.red(`\nError: ${sanitizeErrorMessage(error)}`));
    process.exit(1);
  } finally {
    await disconnect();
  }
}
