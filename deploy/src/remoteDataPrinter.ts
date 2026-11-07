import chalk from 'chalk';
import type { Debug } from './watchBuildTransferRun.ts';
/**
 * Helper function to print formatted output with useful colors
 * @param process First string to print
 * @param stream Regular or Error
 */
export function remoteDataPrinter(dest: Debug, process: string, stream: 'stderr' | 'stdout'): (data: Buffer) => void {
  const log = dest.makeVariableLog({
    colors: [chalk.grey, stream == 'stderr' ? chalk.magenta : chalk.yellow],
    modulo: 0,
  });
  return (data: Buffer): void => {
    data
      .toString()
      .trimEnd()
      .split('\n')
      .map(line => log(process, stream, line.trimEnd()));
  };
}
