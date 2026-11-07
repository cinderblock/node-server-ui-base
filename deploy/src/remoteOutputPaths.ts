import type { Sources } from './Sources.ts';

/**
 * Re-root compiler output from the local (virtual) `outDir` to the remote directory.
 *
 * @param data Compiled sources, as emitted by TypeScript
 * @param outDir The `outDir` the compiler was given
 * @param remotePath Remote directory, empty or ending in `/`
 */
export function remoteOutputPaths(data: Sources, outDir: string, remotePath: string): Sources {
  const prefix = outDir.replaceAll('\\', '/').replace(/\/?$/, '/');

  return data.map(({ filename, source }) => {
    const normalized = filename.replaceAll('\\', '/');
    if (!normalized.startsWith(prefix)) throw new Error(`Compiled file outside of outDir: ${filename}`);
    return { filename: remotePath + normalized.slice(prefix.length), source };
  });
}
