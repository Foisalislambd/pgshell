import chalk from 'chalk';

const LINES = [
  '   ██████╗  ██████╗ ███████╗██╗  ██╗███████╗██╗     ██╗     ',
  '   ██╔══██╗██╔════╝ ██╔════╝██║  ██║██╔════╝██║     ██║     ',
  '   ██████╔╝██║  ███╗███████╗███████║█████╗  ██║     ██║     ',
  '   ██╔═══╝ ██║   ██║╚════██║██╔══██║██╔══╝  ██║     ██║     ',
  '   ██║     ╚██████╔╝███████║██║  ██║███████╗███████╗ ██║     ',
  '   ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝ ╚═╝     ',
];

const SEP = '   ─────────────────────────────────────────────────────';

export function printBanner(): void {
  console.log();
  console.log(chalk.cyan(LINES.join('\n')));
  console.log(chalk.gray(SEP));
  console.log(chalk.blue('   All-in-one PostgreSQL CLI Manager'));
  console.log(chalk.gray(SEP));
  console.log();
}
