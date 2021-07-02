import { watch } from 'fs';
import { Observable } from 'rxjs';
import md5file from 'md5-file';

export default function observeFileChange(file: string, suppressInitial = false): Observable<void> {
  let hash: string;

  return new Observable<void>(observer => {
    const watcher = watch(file);

    watcher.on('change', async (eventType: 'change' | 'rename', filename: string) => {
      if (eventType != 'change') return;
      console.log('Change event:', eventType, filename);

      const newHash = await md5file(file).catch();

      if (newHash !== hash) {
        hash = newHash;
        observer.next();
      }
    });

    watcher.on('error', observer.error);

    watcher.on('close', observer.complete);

    if (!suppressInitial) observer.next();

    return (): void => {
      watcher.close();
    };
  });
}
