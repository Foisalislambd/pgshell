import chalk from 'chalk';
import { connect, disconnect, query } from '../db/client.js';
import { renderTable } from '../ui/tableRenderer.js';
import { getDbUrlFromEnv, printEnvHint } from '../db/env.js';
import { sanitizeErrorMessage } from '../utils/sanitizeError.js';
import { withSpinner } from '../utils/spinner.js';
import { highlightSql } from '../utils/sqlHighlight.js';

export async function executeQueryCommand(sql: string) {
  const connectionString = getDbUrlFromEnv();

  if (!connectionString) {
    console.error(chalk.red('\nError: Missing database credentials.\n'));
    printEnvHint();
    process.exit(1);
  }

  try {
    await connect({ connectionString });
    const result = await withSpinner('Running query...', () => query(sql), {
      failMessage: 'Query failed'
    });
    
    const commandLabel = result.command || 'query';
    const rowCount = result.rowCount !== null ? `(${result.rowCount} rows affected)` : '';
    
    console.log(chalk.dim('\nQuery: ') + highlightSql(sql));
    console.log(chalk.green(`\n✓ ${chalk.bold(commandLabel)} ${rowCount}`));
    
    if (result.rows && result.rows.length > 0) {
      renderTable(result.rows);
    } else {
      console.log(chalk.dim('No rows returned.'));
    }
  } catch (error: unknown) {
    console.error(chalk.red(`\nQuery Error: ${sanitizeErrorMessage(error)}`));
    process.exit(1);
  } finally {
    await disconnect();
  }
}
