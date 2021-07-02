/// <reference types="./types" />

import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import { Configuration } from 'webpack';
import FaviconsWebpackPlugin from 'favicons-webpack-plugin';
// import ErrorOverlayPlugin from 'error-overlay-webpack-plugin';
import WatchExternalFilesPlugin from 'webpack-watch-files-plugin';
import WebpackDevServer from 'webpack-dev-server';

const config: Configuration = {
  entry: {
    main: './main.tsx',
  },
  output: {
    path: path.resolve(__dirname, '..', 'build'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  devtool: 'inline-source-map',
  mode: 'development',
  plugins: [
    new HtmlWebpackPlugin({
      title: 'My Awesome App',
      meta: { viewport: 'width=device-width, initial-scale=1, shrink-to-fit=no' },
    }),
    new CleanWebpackPlugin(),
    new FaviconsWebpackPlugin('./assets/icons8-confetti-96.png'),
    // new ErrorOverlayPlugin(),
    new WatchExternalFilesPlugin({
      files: ['../shared/**/*.ts'],
    }),
    // new webpack.HotModuleReplacementPlugin(),
  ],
  stats: 'minimal',
  devServer: {
    port: 9001,
    host: '0.0.0.0',
    overlay: {
      warnings: true,
      errors: true,
    },
    proxy: {
      '/socket.io': {
        target: 'http://localhost:8000',
        ws: true,
        // changeOrigin: true,
        xfwd: true,
        logLevel: 'silent',
      },
      '/dataFiles': {
        target: 'http://raspberrypi',
        // changeOrigin: true,
        xfwd: true,
        logLevel: 'silent',
      },
    },
    async onListening(server) {
      const qrcode = await import('qrcode-terminal');
      const { default: chalk } = await import('chalk');

      const hostname = (await import('os')).hostname();

      const port = server.listeningApp.address().port;

      if (port === undefined) throw new Error('Port undefined');

      const localURL = `http://localhost:${port}`;
      const remoteURL = `http://${hostname}:${port}`;

      console.log();
      console.log(chalk.yellow('Ctrl + click here:'), chalk.underline.blue(localURL));
      console.log();
      console.log(chalk.yellow('On your phone:'), chalk.underline.blue(remoteURL));
      console.log();
      qrcode.generate(remoteURL);
      console.log();
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.json',
        },
        exclude: /node_modules/,
      },
      {
        test: /\.less$/,
        use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'less-loader' }],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        // Images
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
      {
        // Fonts
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  node: false,
};

export default config;
