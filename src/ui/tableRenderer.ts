import Table from 'cli-table3';
import chalk from 'chalk';

export function renderTable(rows: Record<string, unknown>[], headers?: string[]): void {
  if (!rows || rows.length === 0) {
    console.log(chalk.yellow('No results found.'));
    return;
  }
  const keys = headers ?? (() => {
    const keySet = new Set<string>();
    for (const row of rows) {
      for (const k of Object.keys(row)) keySet.add(k);
    }
    return Array.from(keySet);
  })();
  const table = new Table({
    head: keys.map(k => chalk.cyan.bold(k)),
    style: {
      head: [], // Keep default colors off so chalk works
      border: ['gray']
    }
  });

  rows.forEach((row) => {
    const values = keys.map((k) => {
      const val = row[k];
      if (val === null || val === undefined) return chalk.gray(val === null ? 'NULL' : '-');
      if (typeof val === 'object') return JSON.stringify(val);
      if (typeof val === 'number') return chalk.yellow(String(val));
      if (typeof val === 'boolean') return val ? chalk.green('true') : chalk.red('false');

      const strVal = String(val);
      if (strVal.length > 50) return strVal.substring(0, 47) + '...';
      return strVal;
    });
    table.push(values);
  });

  console.log(table.toString());
  console.log(chalk.dim(`Total rows: ${rows.length}`));
}
