# Discord Kanban Bot

## Setup

### Docker Compose

First, clone this repository:

```shell
git clone https://github.com/thaleius/discord-kanban
```

Rename `config.example.json` to `config.json` and fill in your Discord App's `CLIENT_ID` and `BOT_TOKEN`.
Also, define the users permitted to create Boards by adding their Discord IDs to `ADMIN_IDs`.
Optionally, an embed color can be defined via `EMBED.COLOR`:

```json
// config.json
{
  "EMBED": {
    "COLOR": ""
  },
  "DISCORD": {
    "CLIENT_ID": "",
    "BOT_TOKEN": "",
    "ADMIN_IDs": []
  }
}
```

To start the bot, run the following command in the same directory as the `Dockerfile` and `docker-compose.yml`:

```shell
docker compose up -d
```

## Commands

- `/board view`
  View an existing Board.

- `/board new [name]`
  Create a new Board named `[name]`.

## Permissions

- **Board Viewer**
  - Can run `/board view` for this specific Board
  - Can navigate within the Board

- **Card Manager**
  - Inherits the permissions of **Board Viewer**
  - Can create, edit, and delete Cards

- **List Manager**
  - Inherits the permissions of **Card Manager**
  - Can create, edit, and delete Lists

- **Board Manager**
  - Inherits the permissions of **List Manager**
  - Can edit the Board and change permissions

Users specified in `ADMIN_IDs` are permitted to create Boards and possess all permissions.

**Board owners** possess the same permissions as **Board Manager**.
