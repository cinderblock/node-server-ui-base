import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { Observable } from 'rxjs';

async function md5file(file: string): Promise<string | undefined> {
  try {
    return createHash('md5')
      .update(await readFile(file))
      .digest('hex');
  } catch {
    return undefined;
  }
}

export default function observeFileChange(file: string, suppressInitial = false): Observable<void> {
  let hash: string | undefined;

  return new Observable<void>(observer => {
    const watcher = watch(file);

    watcher.on('change', async eventType => {
      if (eventType != 'change') return;

      const newHash = await md5file(file);

      if (newHash !== hash) {
        hash = newHash;
        observer.next();
      }
    });

    watcher.on('error', e => observer.error(e));

    watcher.on('close', () => observer.complete());

    if (!suppressInitial) {
      md5file(file).then(h => (hash = h));
      observer.next();
    }

    return (): void => {
      watcher.close();
    };
  });
}
