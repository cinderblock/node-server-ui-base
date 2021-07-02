declare module 'webpack-watch-files-plugin' {
  import { Compiler, WebpackPluginInstance } from 'webpack';
  export default class WatchExternalFilesPlugin implements WebpackPluginInstance {
    constructor(options: { files?: string[]; verbose?: boolean });

    apply: (compiler: Compiler) => void;
  }
}
