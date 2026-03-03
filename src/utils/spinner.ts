import ora, { type Ora } from 'ora';

/**
 * Run async work with an agent-style spinner. Shows loading state, then success/fail.
 */
export async function withSpinner<T>(
  message: string,
  fn: (spinner: Ora) => Promise<T>,
  options?: { successMessage?: string | ((result: T) => string); failMessage?: string | ((err: Error) => string) }
): Promise<T> {
  const spinner = ora({ text: message, color: 'cyan' }).start();

  try {
    const result = await fn(spinner);
    const successText =
      typeof options?.successMessage === 'function'
        ? options.successMessage(result)
        : options?.successMessage ?? message;
    spinner.succeed(successText);
    return result;
  } catch (err) {
    const failText =
      typeof options?.failMessage === 'function'
        ? options.failMessage(err as Error)
        : options?.failMessage ?? (err as Error).message;
    spinner.fail(failText);
    throw err;
  }
}
