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

## WIP

This is a working WIP.
There are some dangling broken things.
Open a ticket.

## Development

The development environment is intended to be a first class and modern.

- Reload on save for client ui and server daemon running locally or remotely.
- Full color easy console logging.
- Easy debugging with source maps everywhere.
- ESLint configured and integrated with editor
- Dependency changes automatically maintained with git hooks.

### Prerequisites

[**Node 10+**](https://nodejs.org/en/download) must be installed on your development system.
Node.js includes the `npm` binary.

### Setup

Install dependencies and setup development environment.

```bash
npm i
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

Configs for daemons often need to be slightly different than when running locally.
The deploy script will replace `daemon/config.ts` with `daemon/config.remote.ts` on the remote system before execution.

### Suggested Environment

Use Visual Studio Code.

### Cheat sheet

All of these are run from the top level directory.

| Command                                         | Description                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm i`                                         | Setup your local machine for development. Do this again to fix problems in dev env    |
| `npm run dev -w ui`                             | Run the web **ui** on your local machine (_dev mode_)                                 |
| `npm run dev -w daemon`                         | Run **daemon** locally in watch mode with most recent local code                      |
| `npm run dev:daemon -w deploy`                  | Run local compiler in watch mode and **daemon** on remote with most recent local code |
| `npm -w ui i some-package`                      | Add `some-package` to the ui                                                          |
| `npx -w ui ncu -u`                              | Upgrade ui packages to latest versions                                                |
| `npm upgrade-all`                               | Upgrade all packages to latest versions                                               |
| `npm run remote -- install --save some-package` | Add `some-package` to the daemon using the remote's npm                               |
| `npm run remote -- upgrade`                     | Upgrade daemon packages to latest version using the remote's npm                      |
| `npm run remote -- kill`                        | Kill the daemon on remote                                                             |
| `npm run remote -- shutdown`                    | Shutdown the remote system                                                            |
| `npm run remote -- reboot`                      | Reboot the remote system                                                              |

### Remote Host Setup

Some commands probably need to be run on the target manually once:

```bash
# Setup package sources
curl -sL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt -y update
sudo apt -y upgrade

# Install needed dependencies
sudo apt install -y build-essential libudev-dev libcurl4-gnutls-dev nodejs

# Add Cameron's SSH keys
mkdir ~/.ssh
curl https://github.com/cinderblock.keys > ~/.ssh/authorized_keys
```

### Auto Lint/Formatting

We're using [ESLint](https://eslint.org/) (with [Prettier](https://prettier.io/)) to check and enforce consistent style.

For consistency and simplicity, we use `eslint` to run `prettier` using the [`eslint-plugin-prettier`](https://github.com/prettier/eslint-plugin-prettier) which "Runs Prettier as an ESLint rule and reports differences as individual ESLint issues."

While running `prettier` manually will work, it should always be preferred to run `eslint`, which is a `package.json#script`: `"lint"`, runnable with: `npm run lint`.

### Code Spellcheck

We use `cspell` to check our code's spelling.

For rarer internal words, using a per-file local word ignore is recommended.
For more common words, especially ones that are exposed in a public interface should be in a reusable [`dictionary.txt`](dictionary.txt).
