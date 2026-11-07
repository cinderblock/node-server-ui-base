import { expect, test } from 'bun:test';
import { Folder } from './ConfigurationsHandler.ts';
import { remoteOutputPaths } from './remoteOutputPaths.ts';

test('remoteOutputPaths re-roots compiler output', () => {
  const data = [
    { filename: 'C:/proj/.deploy-out/daemon/src/main.js', source: 'a' },
    { filename: 'C:\\proj\\.deploy-out\\shared\\State.js', source: 'b' },
  ];
  expect(remoteOutputPaths(data, 'C:\\proj\\.deploy-out', 'my-daemon/')).toEqual([
    { filename: 'my-daemon/daemon/src/main.js', source: 'a' },
    { filename: 'my-daemon/shared/State.js', source: 'b' },
  ]);
  expect(() => remoteOutputPaths([{ filename: '/elsewhere/x.js', source: '' }], '/proj/out', '')).toThrow();
});

test('Folder points the config at the selected one', () => {
  const data = [
    { filename: 'my-daemon/daemon/src/main.js', source: '' },
    { filename: 'my-daemon/daemon/src/configs/config.js', source: 'local' },
    { filename: 'my-daemon/daemon/src/configs/config.js.map', source: '{}' },
  ];

  Folder(data, { remoteModuleDir: 'my-daemon/daemon', selectedConfig: 'test1' });

  expect(data).toEqual([
    { filename: 'my-daemon/daemon/src/main.js', source: '' },
    { filename: 'my-daemon/daemon/src/configs/config.js', source: "export { default } from './test1.js';\n" },
  ]);
});
