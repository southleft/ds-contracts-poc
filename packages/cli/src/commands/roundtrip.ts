import { CliUsageError } from '../lib.js';

export async function roundtripCommand(argv: string[]): Promise<number> {
  try {
    const moduleUrl = new URL('./roundtrip.js', import.meta.url).href;
    const { runRoundtrip } = await import(moduleUrl);
    return await runRoundtrip(argv);
  } catch (error) {
    throw new CliUsageError(`roundtrip refused: ${error instanceof Error ? error.message : String(error)}`);
  }
}
