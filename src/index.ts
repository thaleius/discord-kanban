import { Client, Events, GatewayIntentBits, MessageFlags, Partials } from "discord.js";
import { DISCORD } from '../config.json';
import { getCard, getList } from "./helpers/db";
import { checkPermission, createCardReply, createListReply } from "./helpers/utils";
import { prisma } from "./lib/prisma";
import { deployGlobalCommands } from "./utils/deployGlobalCommands";
import { loadInteractions } from "./utils/interactions";

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
      interactions: await loadInteractions()
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
            flags: [MessageFlags.Ephemeral]
          });
        else
          await interaction.reply({
            content: "There was an error while executing this command!",
            flags: [MessageFlags.Ephemeral]
          });
      }
    } else if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      
      if (!command || !command.autocomplete) {
        console.error(`No autocomplete handler found for ${interaction.commandName}.`);
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error('Autocomplete Error:', error);
      }
    } else if (interaction.isButton()) {
      client.interactions.get(interaction.customId.split('_')[0])?.button(interaction);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'list') {
        const listId = parseInt(interaction.values[0]);
        const list = await getList(listId);
        if (!list) return await interaction.reply({
          content: 'The List does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('view-board', interaction.user, list.board)) {
          return await interaction.reply({
            content: 'You do not have permission to view Lists on this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        await interaction.update(createListReply(list, null, true))
      } else if (interaction.customId === 'card') {
        const cardId = parseInt(interaction.values[0]);
        const card = await getCard(cardId);
        if (!card) return await interaction.reply({
          content: 'The Card does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('view-board', interaction.user, card.board)) {
          return await interaction.reply({
            content: 'You do not have permission to view Cards on this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        await interaction.update(createCardReply(card, null, true))
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.isFromMessage()) {
        client.interactions.get(interaction.customId.split('_')[0])?.modal(interaction, client.interactions);
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