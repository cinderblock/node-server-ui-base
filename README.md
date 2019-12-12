# Node Server UI base

Skeleton for a sever/client TypeScript pair.

## Details

This skeleton has 3 parts.

1. A super simple node.js daemon skeleton with socket.io and colorful logging facilities.
2. Basic React app skeleton with webpack, TypeScript, and socket.io client (with fancy state synchronization).
3. Deployment scripts

## create-node-server-ui-app

Simple steps to make a new project/app based on this skeleton.

1. clone
1. Update `README.md` and `package.json`
1. `git commit -am 'Initial commit'`

## Development

The development environment is intended to be a first class and modern.

- Reload on save for client ui and server daemon running locally or remotely.
- Full color easy console logging.
- Easy debugging with source maps everywhere.
- ESLint configured and integrated with editor
- Dependency changes automatically maintained with git hooks.

### Prerequisites

[**Node 10+**](https://nodejs.org/en/download) must be installed on your development system.
[**Yarn**](https://yarnpkg.com/lang/en/docs/install) is nice to have but **optional**.

### Setup

Install dependencies and setup development environment.

```bash
yarn setup
```

#### Non-global Yarn?

While easier if Yarn is installed globally, this works fine without it.

```bash
# Installs yarn locally
npm install
# Setup development environment
npm run setup
```

> You can run any command from the cheat sheet by replacing `yarn` with `npm run`.

### Running

To run this full system, **two** separate programs need to be run.
One for the web **UI** and one to actually do something persistent, the **daemon**.

### Remote Execution

Configs for daemons often need to be slightly different than when running locally.
The deploy script will pick a config file from [`daemon/configs/`](daemon/configs).

### Suggested Environment

Use Visual Studio Code.

## Cheat sheet

All of these are run from the top level directory.

| Command                        | Description                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `yarn setup`                   | Setup your local machine for development                                              |
| `yarn ui dev`                  | Run the web **ui** on your local machine (_dev mode_)                                 |
| `yarn daemon dev`              | Run **daemon** locally in watch mode with most recent local code                      |
| `yarn deploy daemon-dev`       | Run local compiler in watch mode and **daemon** on remote with most recent local code |
| `yarn ui add some-package`     | Add `some-package` to the ui                                                          |
| `yarn ui upgrade`              | Upgrade ui packages to latest versions                                                |
| `yarn upgrade-all`             | Upgrade all packages to latest versions                                               |
| `yarn remote add some-package` | Add `some-package` to the daemon using the remote's yarn                              |
| `yarn remote upgrade`          | Upgrade daemon packages to latest version using the remote's yarn                     |
| `yarn remote kill`             | Kill the daemon on remote                                                             |
| `yarn remote shutdown`         | Shutdown the remote system                                                            |
| `yarn remote reboot`           | Reboot the remote system                                                              |
