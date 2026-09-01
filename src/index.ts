import { Client, Events, GatewayIntentBits, Partials } from "discord.js";
import { prisma } from "./lib/prisma";
import { deployGlobalCommands } from "./utils/deployGlobalCommands";
import { DISCORD } from '../config.json'

async function main() {
  const client = Object.assign(
    new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
      ]
    }),
    {
      commands: await deployGlobalCommands(),
    }
  );

  client.once(Events.ClientReady, (readyClient) =>
    console.log(`Ready! Logged in as ${readyClient.user.tag}`)
  );

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred)
          await interaction.followUp({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        else
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
      }
    }

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command || !command.autocomplete) {
        console.error(`Kein Autocomplete-Handler für ${interaction.commandName} gefunden.`);
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error('Autocomplete Error:', error);
      }
    } 
  });

  client.login(DISCORD.BOT_TOKEN);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });