import gradient from 'gradient-string';
import chalk from 'chalk';

const LINES = [
  '   ██████╗  ██████╗ ███████╗██╗  ██╗███████╗██╗     ██╗     ',
  '   ██╔══██╗██╔════╝ ██╔════╝██║  ██║██╔════╝██║     ██║     ',
  '   ██████╔╝██║  ███╗███████╗███████║█████╗  ██║     ██║     ',
  '   ██╔═══╝ ██║   ██║╚════██║██╔══██║██╔══╝  ██║     ██║     ',
  '   ██║     ╚██████╔╝███████║██║  ██║███████╗███████╗ ██║     ',
  '   ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═╝     '
];

const cyanPink = gradient(['#06b6d4', '#ec4899']);

export function printBanner(): void {
  console.log();
  console.log(cyanPink.multiline(LINES.join('\n')));
  console.log(chalk.gray('   ─────────────────────────────────────────────────────'));
  console.log(chalk.dim('   Your PostgreSQL assistant • Type to search, we\'ve got you covered'));
  console.log(chalk.gray('   ─────────────────────────────────────────────────────'));
  console.log();
}
