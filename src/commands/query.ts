import chalk from 'chalk';
import { connect, disconnect, query } from '../db/client.js';
import { renderTable } from '../ui/tableRenderer.js';
import { getDbUrlFromEnv, printEnvHint } from '../db/env.js';

export async function executeQueryCommand(sql: string) {
  const connectionString = getDbUrlFromEnv();
  
  if (!connectionString) {
    console.error(chalk.red('\nError: Missing database credentials.\n'));
    printEnvHint();
    process.exit(1);
  }

  try {
    await connect({ connectionString });
    const result = await query(sql);
    
    const commandLabel = result.command || 'query';
    const rowCount = result.rowCount !== null ? `(${result.rowCount} rows affected)` : '';
    
    console.log(chalk.green(`\nExecuted successfully: ${chalk.bold(commandLabel)} ${rowCount}`));
    
    if (result.rows && result.rows.length > 0) {
      renderTable(result.rows);
    } else {
      console.log(chalk.dim('No rows returned.'));
    }
  } catch (error: any) {
    console.error(chalk.red(`\nQuery Error: ${error.message}`));
  } finally {
    await disconnect();
  }
}
