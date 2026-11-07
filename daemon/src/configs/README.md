# How to use multiple configs

Each `.ts` file in here is one configuration for the daemon. `config.ts` is the one used when running locally. It is
git-ignored, and `bun install` creates it from `config.example.ts` if it is missing.

The deploy code (`bun run --cwd deploy dev:daemon`) uses `selectedConfig` from [`deploy/config.ts`](../../../deploy/config.ts)
to pick which file in here the deployed system uses.

## New config

Just copy one of the `.ts` files in this directory and give it a new name.
Point `selectedConfig` in `deploy/config.ts` at it.

## Include

### Using Configurations

Include [`Config`](../Config.ts):

```TypeScript
import config from './Config.js';
```

## How it works

The [`deploy`](../../../deploy) system replaces the compiled `config.js` with one that has the following contents:

```TypeScript
export { default } from './${selectedConfig}.js';
```
