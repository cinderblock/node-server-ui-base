import type { Sources } from './Sources.ts';

type Options = { remoteModuleDir: string; selectedConfig: string };

/**
 * Point the compiled `configs/config.js` at the selected config on the remote.
 *
 * @param data Sources to modify
 * @param options Where the daemon's sources go on the remote and which config to use
 */
export function Folder(data: Sources, { remoteModuleDir, selectedConfig }: Options): void {
  const configFilePath = remoteModuleDir + '/src/configs/config.js';

  // Remove the source map for the one we're replacing
  const configFileMap = data.findIndex(({ filename }) => filename == configFilePath + '.map');
  if (configFileMap >= 0) data.splice(configFileMap, 1);

  // Find the local one in the list, if possible
  let configFile = data.find(({ filename }) => filename == configFilePath);
  if (!configFile) {
    configFile = {
      filename: configFilePath,
      source: '', // Temp empty string
    };
    data.push(configFile);
  }

  configFile.source = `export { default } from './${selectedConfig}.js';\n`;
}

/**
 * Replace a single config.js with the sources from config.remote.js
 *
 * @param data Sources to modify
 * @param options Where the daemon's sources go on the remote
 */
export function RemoteFile(data: Sources, { remoteModuleDir }: { remoteModuleDir: string }): void {
  // Special handling for the config file
  const remoteConfig = data.find(({ filename }) => filename == remoteModuleDir + '/config.remote.js');
  const localConfig = data.findIndex(({ filename }) => filename == remoteModuleDir + '/config.js');
  if (remoteConfig) {
    if (localConfig > -1) {
      data.splice(localConfig, 1);
    }
    remoteConfig.filename = remoteModuleDir + '/config.js';
  }
}
