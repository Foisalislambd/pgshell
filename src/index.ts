#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { runInteractiveUI } from './ui/mainMenu.js';
import { executeQueryCommand } from './commands/query.js';
import chalk from 'chalk';

config(); // Load .env file automatically

const program = new Command();

program
  .name('pgshell')
  .description('All-in-one powerful and human-friendly PostgreSQL CLI Manager')
  .version('1.0.0');

// Helper to handle any top-level graceful exits
const handleExit = (error: any) => {
  if (error.name === 'ExitPromptError' || error.message?.includes('SIGINT')) {
    console.log(chalk.gray('\nGoodbye! 👋\n'));
    process.exit(0);
  } else {
    console.error(chalk.red(`\nFatal Error: ${error.message}\n`));
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

// Catch unhandled rejections globally from Commander
program.parseAsync(process.argv).catch(handleExit);
