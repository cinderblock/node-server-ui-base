# Node Server UI base

Skeleton for a server/client TypeScript pair: a daemon that does something persistent, a web UI that shows and controls
it, and scripts to deploy the daemon to a remote machine (a Raspberry Pi, say) while you develop.

## Details

This skeleton has 4 parts, as [Bun workspaces](https://bun.sh/docs/install/workspaces).

1. [`daemon/`](daemon): a super simple daemon with [socket.io](https://socket.io) and colorful logging facilities. It
   sends its whole `State` to every connected UI ten times a second and accepts sanitized "user controls" back.
2. [`ui/`](ui): a basic [React](https://react.dev) app built with [Vite](https://vite.dev) and TypeScript, with a
   socket.io client (with fancy state synchronization hooks).
3. [`shared/`](shared): the types both sides agree on (`State`, `UserControls`).
4. [`deploy/`](deploy): deployment scripts that compile the daemon, push it over SSH, and restart it on every save.

The daemon runs with Bun while developing locally. On a deployed system it runs the compiled JavaScript with Node.

## create-node-server-ui-app

Simple steps to make a new project/app based on this skeleton.

1. Clone (or use this repository as a template)
1. Update `README.md` and `package.json`
1. `git commit -am 'Initial commit'`

## WIP

This is a working WIP.
There may be some dangling broken things.
Open a ticket.

## Development

The development environment is intended to be first class and modern.

- Reload on save for client ui and server daemon running locally or remotely.
- Full color easy console logging.
- Easy debugging with source maps everywhere.
- Prettier configured and integrated with the editor.
- Type checking, formatting and tests run in CI on every push and pull request.

### Prerequisites

[**Bun 1.3+**](https://bun.sh) must be installed on your development system.

The remote system (if you deploy to one) needs [**Node 22+**](https://nodejs.org/en/download), which includes `npm`.

### Setup

Install dependencies and setup development environment.

```bash
bun install
```

This also creates `daemon/src/configs/config.ts` from [`config.example.ts`](daemon/src/configs/config.example.ts).
See [`daemon/src/configs/`](daemon/src/configs).

### Running

To run this full system, **two** separate programs need to be run.
One for the web **UI** and one to actually do something persistent, the **daemon**.

```bash
bun run dev
```

runs both, with the UI on <http://localhost:9001> and the daemon on port 8000. The UI dev server proxies `/socket.io`
to the daemon. It also prints a QR code, so you can open the UI on your phone.

Set `PORT` to move the daemon, and `DAEMON_URL` to point the UI's proxy somewhere else:

```bash
PORT=8100 bun run --cwd daemon dev
DAEMON_URL=http://localhost:8100 bun run --cwd ui dev
```

### Remote Execution

`bun run --cwd deploy dev:daemon` watches the daemon's sources, compiles them, copies the output to the remote over SSH,
installs the daemon's dependencies there with the remote's `npm`, and restarts the daemon's systemd service. Run the UI
locally at the same time: `dev:daemon` forwards local port 8000 to the remote daemon, so the UI works unchanged.

Edit [`deploy/config.ts`](deploy/config.ts) for your remote: host, user, service name, remote directory, and which daemon
config to use. SSH authentication uses your SSH agent (Pageant on Windows), or `~/.ssh/id_ed25519` / `id_ecdsa` /
`id_rsa`, unless you set a password or key there.

Configs for daemons often need to be slightly different than when running locally.
The deploy script will pick a config file from [`daemon/src/configs/`](daemon/src/configs).

### Suggested Environment

Use Visual Studio Code.

### Cheat sheet

All of these are run from the top level directory.

| Command                                  | Description                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `bun install`                            | Setup your local machine for development. Do this again to fix problems in dev env    |
| `bun run dev`                            | Run the web **ui** and the **daemon** on your local machine (_dev mode_)              |
| `bun run --cwd ui dev`                   | Run the web **ui** on your local machine (_dev mode_)                                 |
| `bun run --cwd daemon dev`               | Run **daemon** locally in watch mode with most recent local code                      |
| `bun run --cwd deploy dev:daemon`        | Run local compiler in watch mode and **daemon** on remote with most recent local code |
| `bun run lint`                           | Type check everything and check formatting                                            |
| `bun run format`                         | Format everything with Prettier                                                       |
| `bun test`                               | Run all the tests                                                                     |
| `bun run build`                          | Build the ui (`ui/dist`) and the daemon (`daemon/build`)                              |
| `bun add --cwd ui some-package`          | Add `some-package` to the ui                                                          |
| `bun update --latest`                    | Upgrade all packages to latest versions                                               |
| `bun run remote -- install some-package` | Add `some-package` to the daemon using the remote's npm                               |
| `bun run remote -- update`               | Upgrade daemon packages using the remote's npm                                        |
| `bun run remote -- run kill`             | Kill the daemon on remote                                                             |
| `bun run remote -- run shutdown`         | Shutdown the remote system                                                            |
| `bun run remote -- run reboot`           | Reboot the remote system                                                              |

### Remote Host Setup

Some commands probably need to be run on the target manually once:

```bash
# Setup package sources
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt -y update
sudo apt -y upgrade

# Install needed dependencies
sudo apt install -y build-essential libudev-dev libcurl4-gnutls-dev nodejs

# Add Cameron's SSH keys
mkdir ~/.ssh
curl https://github.com/cinderblock.keys > ~/.ssh/authorized_keys
```

Then install the daemon's service. [`deploy/my-daemon.service`](deploy/my-daemon.service) is an example unit; copy it
over, adjust the user and paths, and enable it:

```bash
sudo cp my-daemon.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-daemon
```

`dev:daemon` runs `sudo systemctl stop`/`start` on every deploy, so the remote user needs passwordless `sudo` for that.

### Auto Formatting

We're using [Prettier](https://prettier.io/) to enforce consistent style. Your editor should format on save (see
[`.vscode/`](.vscode)). `bun run format` formats everything, and `bun run lint` (which CI runs) fails on anything that
isn't formatted.
