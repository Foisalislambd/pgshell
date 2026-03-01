import chalk from 'chalk';

export function getDbUrlFromEnv(): string | null {
  // 1. Check for direct DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // 2. Check for your specific DB_* keys
  if (process.env.DB_USER && process.env.DB_NAME) {
    const user = process.env.DB_USER;
    const pass = process.env.DB_PASSWORD ? encodeURIComponent(process.env.DB_PASSWORD) : '';
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || '5432';
    const db = process.env.DB_NAME;
    
    // Construct URI: postgresql://user:pass@host:port/db
    // If password is empty, it still works for local connections that don't require it
    const auth = pass ? `${user}:${pass}` : user;
    return `postgresql://${auth}@${host}:${port}/${db}`;
  }

  // 3. Check for standard PostgreSQL environment variables (PGUSER, etc.)
  if (process.env.PGUSER && process.env.PGDATABASE) {
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD ? encodeURIComponent(process.env.PGPASSWORD) : '';
    const host = process.env.PGHOST || 'localhost';
    const port = process.env.PGPORT || '5432';
    const db = process.env.PGDATABASE;
    
    const auth = pass ? `${user}:${pass}` : user;
    return `postgresql://${auth}@${host}:${port}/${db}`;
  }
  
  return null;
}

export function printEnvHint(): void {
  console.log(chalk.yellow(`💡 Hint: No database credentials found in the current directory's .env file.`));
  console.log(chalk.dim(`For automatic connection next time, create a .env file and add:\n`));
  
  console.log(chalk.cyan(`  DB_HOST=localhost`));
  console.log(chalk.cyan(`  DB_PORT=5432`));
  console.log(chalk.cyan(`  DB_USER=postgres`));
  console.log(chalk.cyan(`  DB_PASSWORD=yourpassword`));
  console.log(chalk.cyan(`  DB_NAME=yourdatabase\n`));

  console.log(chalk.dim(`  --- OR use a single URL ---\n`));
  console.log(chalk.cyan(`  DATABASE_URL="postgresql://user:password@localhost:5432/dbname"\n`));
}
