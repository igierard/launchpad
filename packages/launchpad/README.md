# 🚀 Launchpad

Launchpad is a highly configurable suite of tools to manage media installations. It can:

- Launch, control and monitor muiltiple processes (via [PM2](https://pm2.keymetrics.io/))
- Download and locally cache content from various common web APIs
- Bootstrap Windows PCs with common exhibit settings
- Consolidate and route application logs

[...and many more things](#documentation)

![Screen Recording of Launchpad on Windows 11](https://user-images.githubusercontent.com/295789/197365153-d62d9218-2ffa-4611-ac61-fa5bf786766a.gif)

## Getting Started

A typical setup will use launchpad as a node dependency, configure it via a `launchpad.json` file and run `npx launchpad` via a startup task (e.g. Windows Task Scheduler):

1. Install launchpad: **`npm i @bluecadet/launchpad`**
2. Create a **`launchpad.json`** config (see [configuration](#configuration))
3. *Optional: Bootstrap your PC with `npx launchpad scaffold`*
4. Run **`npx launchpad`**

Type `npx launchpad --help` for all available commands.

*Launchpad can also be installed globally via `npm i -g @bluecadet/launchpad` and called via `launchpad` instead of `npx launchpad`.*

## Configuration

Each [launchpad package](#packages) is configured via its own section in `launchpad.json`. Below is a simple example that uses the [`content`](/packages/content) package to download JSON and images from Flickr and the [`monitor`](/packages/monitor) to launch a single app:

```json
{
  "content": {
    "sources": [
      {
        "id": "flickr-images",
        "files": {
            "spaceships.json": "https://api.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=spaceship",
            "rockets.json": "https://api.flickr.com/services/feeds/photos_public.gne?format=json&nojsoncallback=1&tags=rocket"
        }
      }
    ]
  },
  "monitor": {
    "apps": [
      {
        "pm2": {
          "name": "my-app",
          "script": "my-app.exe",
          "cwd": "./builds/"
        }
      }
    ]
  }
}
```

### Documentation

All available config settings across packages can be found in the links below:

- [**`monitor`**](/packages/monitor/README.md): Run and monitor apps
- [**`content`**](/packages/content/README.md): Download and cache remote content
  - `sources`: An array containing one or more of the following content source options:
    - [`airtable`](/packages/content/docs/airtable-source.md): Download content from Airtable
    - [`contentful`](/packages/content/docs/contentful-source.md): Download content from Contentful
    - [`json`](/packages/content/docs/json-source.md): Download content from JSON endpoints
    - [`strapi`](/packages/content/docs/strapi-source.md): Download content from Strapi
    - [`sanity`](/packages/content/docs/sanity-source.md): Download content from Sanity
- [**`logging`**](/packages/launchpad/docs/logging.md): Route logs to the console and to files
- [**`hooks`**](/packages/launchpad/docs/hooks.md): Execute scripts before or after common events (e.g. after content has been updated)

### Config Loading

- By default, Launchpad looks for `launchpad.json` or `config.json` at the cwd (where you ran `npx launchpad`/`launchpad` from)
- You can change the default path with `--config=<YOUR_FILE_PATH>` (e.g. `npx launchpad --config=../settings/my-config.json`)
- If no config is found, Launchpad will traverse up directories (up to 64) to find one
- All config values can be overridden via `--foo=bar` (e.g. `--logging.level=debug`)

## Packages

This repo is a monorepo that includes the following packages:

* [`@bluecadet/launchpad`](/packages/launchpad)
* [`@bluecadet/launchpad-content`](/packages/content)
* [`@bluecadet/launchpad-monitor`](/packages/monitor)
* [`@bluecadet/launchpad-scaffold`](/packages/scaffold)
* [`@bluecadet/launchpad-utils`](/packages/utils)

Each of these packages can be launched and configured independently (except for utils), so if you only need app-monitoring or content updates, you can install only `@bluecadet/launchpad-monitor` or `@bluecadet/launchpad-content`.

## Requirements

Launchpad requires Node `>=17.5.0` and NPM `>=8.5.1` for Windows API integration and workspaces support.

We recommend installing the latest version of NodeJS and NPM via [nvm-windows](https://github.com/coreybutler/nvm-windows):

```
nvm install latest
nvm use latest
npm i -g npm@latest
```
