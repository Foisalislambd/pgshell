#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { runInteractiveUI } from './ui/mainMenu.js';
import { executeQueryCommand } from './commands/query.js';
import { executeDbListCommand, executeDbCreateCommand, executeDbDropCommand } from './commands/database.js';
import chalk from 'chalk';
import { sanitizeErrorMessage } from './utils/sanitizeError.js';

config(); // Load .env file automatically

const program = new Command();

program
  .name('pgshell')
  .description('All-in-one powerful and human-friendly PostgreSQL CLI Manager')
  .version('1.0.3');

// Helper to handle any top-level graceful exits
const handleExit = (error: unknown) => {
  const e = error as Error & { name?: string };
  if (e?.name === 'ExitPromptError' || e?.message?.includes('SIGINT')) {
    console.log(chalk.gray('\nGoodbye! 👋\n'));
    process.exit(0);
  } else {
    console.error(chalk.red(`\nFatal Error: ${sanitizeErrorMessage(error)}\n`));
    process.exit(1);
  }
};

// Interactive Mode (Default if no args)
program
  .command('ui', { isDefault: true })
  .description('Launch the interactive UI')
  .action(async () => {
    try {
      await runInteractiveUI();
    } catch (error) {
      handleExit(error);
    }
  });

// Direct Query Execution
program
  .command('query <sql>')
  .description('Execute a raw SQL query directly')
  .action(async (sql) => {
    try {
      await executeQueryCommand(sql);
    } catch (error) {
      handleExit(error);
    }
  });

// Database commands
program
  .command('list')
  .description('List all databases on the server')
  .action(async () => {
    try {
      await executeDbListCommand();
    } catch (error) {
      handleExit(error);
    }
  });

program
  .command('create <name>')
  .description('Create a new database')
  .action(async (name) => {
    try {
      await executeDbCreateCommand(name);
    } catch (error) {
      handleExit(error);
    }
  });

program
  .command('drop <name>')
  .description('Drop a database')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (name, opts: { yes?: boolean }) => {
    try {
      await executeDbDropCommand(name, opts?.yes ?? false);
    } catch (error) {
      handleExit(error);
    }
  });

// Catch unhandled rejections globally from Commander
program.parseAsync(process.argv).catch(handleExit);
