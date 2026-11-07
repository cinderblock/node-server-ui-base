/**
 * Device specific configurations
 */
export type Config = {
  /**
   * Where our log files should be stored
   */
  logs: string;
};

// Created from `config.example.ts` by `bun install`. On a deployed system, `deploy` points this at the selected config.
import localConfig from './configs/config.js';
// Help with types in case the above import fails
const typedConfig: Config = localConfig;
export default typedConfig;
