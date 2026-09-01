import { Collection, REST, Routes } from "discord.js";
import 'dotenv/config';
import { readdir } from "fs/promises";
import { DISCORD } from "../../config.json";
import { CommandConfig } from "./command";

/** Deploys all commands to all permitted guilds. Returns the collection of deployed commands. */
export async function deployGlobalCommands() {
  if (!DISCORD.BOT_TOKEN || !DISCORD.CLIENT_ID) {
    throw Error('Please define BOT_TOKEN and CLIENT_ID in .env');
  }

  const commandFiles = (await readdir("src/commands")).filter((file) =>
    file.endsWith(".ts")
  );

  console.log(`Commands to deploy: ${commandFiles.toString()}`);

  const commands: CommandConfig[] = await Promise.all(
    commandFiles.map(
      async (file) => (await import(`../commands/${file}`)).default
    )
  );

  const rest = new REST().setToken(DISCORD.BOT_TOKEN);

  try {
    console.log(`Started reloading ${commands.length} application commands.`);

    await rest.put(Routes.applicationCommands(DISCORD.CLIENT_ID), {
      body: commands.map((command) => command.data.toJSON()),
    });

    console.log(
      `Successfully reloaded ${commands.length} application commands.`
    );

    return new Collection<string, CommandConfig>(
      commands.map((command) => [command.data.name, command])
    );
  } catch (error) {
    console.error(`Error reloading application commands:`, error);
    throw error;
  }
}