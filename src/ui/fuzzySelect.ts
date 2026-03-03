import { search } from '@inquirer/prompts';
import { Fzf } from 'fzf';

export interface FuzzyChoice<T = string> {
  name: string;
  value: T;
  description?: string;
}

/**
 * Agent-style fuzzy search selection - type to filter, like CLI tools (Gemini, etc.)
 */
export async function fuzzySelect<T = string>(
  message: string,
  choices: FuzzyChoice<T>[],
  options?: { pageSize?: number; defaultValue?: T }
): Promise<T> {
  if (choices.length === 0) {
    throw new Error('No choices available.');
  }

  const first = choices[0];
  if (first && choices.length === 1) {
    return first.value;
  }

  const names: string[] = choices.map((c) => c.name);
  const fzf = new Fzf(names, { selector: (item: string) => item });

  const choiceMap = new Map(choices.map((c) => [c.name, c]));

  const defaultName = options?.defaultValue
    ? choices.find((c) => c.value === options?.defaultValue)?.name
    : undefined;

  const selected = await search<string | T>({
    message,
    pageSize: options?.pageSize ?? 10,
    default: defaultName as string | undefined,
    source: async (input: string | undefined) => {
      const filtered =
        !input || input.trim() === ''
          ? names
          : fzf.find(input.trim()).map((entry: { item: string }) => entry.item);
      const toShow = filtered.length > 0 ? filtered : names;

      return toShow.map((name: string) => {
        const choice = choiceMap.get(name);
        if (!choice) {
          throw new Error(`Internal: choice not found for "${name}"`);
        }
        return {
          value: choice.value,
          name: choice.name,
          description: choice.description ?? ''
        };
      });
    }
  });

  // search() returns the selected choice's value
  return selected as T;
}
