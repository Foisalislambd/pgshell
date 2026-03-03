import chalk from 'chalk';

/**
 * Highlight SQL for terminal display - agent-style readable output.
 * No external deps, uses chalk for colors.
 */
export function highlightSql(sqlText: string): string {
  if (!sqlText.trim()) return sqlText;

  return sqlText
    .replace(
      /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|JOIN|LEFT|RIGHT|INNER|OUTER|ON|ORDER BY|GROUP BY|LIMIT|OFFSET|AND|OR|AS|IN|NOT|NULL)\b/gi,
      (m) => chalk.cyan(m)
    )
    .replace(/\b(NULL|TRUE|FALSE)\b/g, chalk.magenta('$1'))
    .replace(/'([^']*)'/g, chalk.green("'$1'"))
    .replace(/\b\d+\b/g, chalk.yellow('$&'))
    .replace(/--.*$/gm, chalk.gray('$&'));
}
