import { Client, Events, GatewayIntentBits, LabelBuilder, ModalBuilder, Partials, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from "discord.js";
import { DISCORD } from '../config.json';
import { cardAssign, CardInclude, cardUnassign, ContentInclude, editCard, getBoard, getCard, getCardHistory, ListInclude, moveCard, newCard } from "./helpers/db";
import { createBoardReply, createCardReply, createListReply, formatUser, sortCardContentHistory } from "./helpers/utils";
import { prisma } from "./lib/prisma";
import { deployGlobalCommands } from "./utils/deployGlobalCommands";

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
      if (interaction.customId.startsWith('list_')) {
        const listId = parseInt(interaction.customId.split('_')[1]);
        const list = await prisma.list.findUnique({
          where: { id: listId },
          include: ListInclude
        });
        if (!list) return await interaction.update();

        await interaction.update(createListReply(list, null, true));
      } else if (interaction.customId.startsWith('board_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await prisma.board.findUnique({
          where: { id: boardId },
          include: {
            lists: {
              include: ListInclude
            },
            cards: {
              include: CardInclude
            }
          }
        });
        if (!board) return await interaction.update();

        await interaction.update(createBoardReply(board, null, true));
      } else if (interaction.customId.startsWith('card-edit_')) {
        const [_, boardName, cardIdStr, property] = interaction.customId.split('_');
        const cardId = parseInt(cardIdStr);
        const card = await prisma.card.findUnique({
          where: { id: cardId },
          include: {
            content: {
              include: ContentInclude
            }
          }
        })
        if (!card) return interaction.update();

        if (property !== 'title' && property !== 'content' && property !== 'url') {
          return interaction.update();
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Edit Card')

        let value = '';
        switch (property) {
          case 'title':
            value = card.title;
            break;
          
          case 'content':
            value = sortCardContentHistory(card.content)[0].value;
            break;

          case 'url':
            value = card.url || '';
            break;

          default:
            break;
        }

        const textInput = new TextInputBuilder()
          .setCustomId('value')
          .setValue(value)
          .setStyle(property === 'content' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(true);

        const inputLabel = new LabelBuilder()
          .setLabel('New ' + (property === 'url' ? 'URL' : property) + ':')
          .setTextInputComponent(textInput)

        modal.addLabelComponents(inputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-new_')) {
        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('New Card')

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setPlaceholder('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const contentInput = new TextInputBuilder()
          .setCustomId('content')
          .setPlaceholder('Content')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        const urlInput = new TextInputBuilder()
          .setCustomId('url')
          .setPlaceholder('URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        const titleInputLabel = new LabelBuilder()
          .setLabel('Title:')
          .setTextInputComponent(titleInput);

        const contentInputLabel = new LabelBuilder()
          .setLabel('Content:')
          .setTextInputComponent(contentInput);

        const urlInputLabel = new LabelBuilder()
          .setLabel('URL:')
          .setTextInputComponent(urlInput);

        modal.addLabelComponents(titleInputLabel, contentInputLabel, urlInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-move_')) {
        const [_, cardIdStr] = interaction.customId.split('_');
        const cardId = parseInt(cardIdStr);

        const card = await prisma.card.findUnique({
          where: { id: cardId },
          select: {
            board: {
              select: {
                lists: true
              }
            }
          }
        });
        if (!card) {
          await interaction.update({
            content: 'Card does not exist.'
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Move Card to another List')

        const listSelect = new StringSelectMenuBuilder()
          .setCustomId('list')
          .setPlaceholder('Select a List.')
          .addOptions(
            ...card.board.lists.map(list => 
              new StringSelectMenuOptionBuilder()
                .setLabel(list.name)
                .setValue(list.id.toString())
            )
          );

        const listSelectLabel = new LabelBuilder()
          .setLabel('Select a List:')
          .setStringSelectMenuComponent(listSelect);

        modal.addLabelComponents(listSelectLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('board-card-move_')) {
        const [_, boardIdStr] = interaction.customId.split('_');
        const boardId = parseInt(boardIdStr);

        const board = await prisma.board.findUnique({
          where: { id: boardId },
          select: {
            cards: true,
            lists: true
          }
        });
        if (!board) {
          await interaction.update({
            content: 'Board does not exist.'
          });
          return;
        }

        if (board.cards.length === 0) {
          await interaction.update("No cards to move.");
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Move Card to another List')

        const cardSelect = new StringSelectMenuBuilder()
          .setCustomId('card')
          .setPlaceholder('Select a Card.')
          .addOptions(
            ...board.cards.map(card => 
              new StringSelectMenuOptionBuilder()
                .setLabel(card.title)
                .setValue(card.id.toString())
            )
          );

        const listSelect = new StringSelectMenuBuilder()
          .setCustomId('list')
          .setPlaceholder('Select a List.')
          .addOptions(
            ...board.lists.map(list => 
              new StringSelectMenuOptionBuilder()
                .setLabel(list.name)
                .setValue(list.id.toString())
            )
          );

        const cardSelectLabel = new LabelBuilder()
          .setLabel('Select a Card:')
          .setStringSelectMenuComponent(cardSelect);

        const listSelectLabel = new LabelBuilder()
          .setLabel('Select a List:')
          .setStringSelectMenuComponent(listSelect);

        modal.addLabelComponents(cardSelectLabel, listSelectLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('board-card-assign_')) {
        const [_, boardIdStr] = interaction.customId.split('_');
        const boardId = parseInt(boardIdStr);

        const board = await prisma.board.findUnique({
          where: { id: boardId },
          select: {
            cards: true,
            lists: true
          }
        });
        if (!board) {
          await interaction.update({
            content: 'Board does not exist.'
          });
          return;
        }

        if (board.cards.length === 0) {
          await interaction.update({
            content: 'Board does not have any cards.'
          });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Assign a User to a Card')

        const cardSelect = new StringSelectMenuBuilder()
          .setCustomId('card')
          .setPlaceholder('Select a Card.')
          .addOptions(
            ...board.cards.map(card => 
              new StringSelectMenuOptionBuilder()
                .setLabel(card.title)
                .setValue(card.id.toString())
            )
          );

        const optionSelect = new StringSelectMenuBuilder()
          .setCustomId('option')
          .setPlaceholder('assign/unassign')
          .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('assign')
                .setValue('assign')
                .setDefault(true),
            new StringSelectMenuOptionBuilder()
                .setLabel('unassign')
                .setValue('unassign')
          );

        const assigneeSelect = new UserSelectMenuBuilder()
          .setCustomId('assignee')
          .setPlaceholder('Select an Assignee.');

        const cardSelectLabel = new LabelBuilder()
          .setLabel('Select a Card:')
          .setStringSelectMenuComponent(cardSelect);

        const optionSelectLabel = new LabelBuilder()
          .setLabel('Select an option:')
          .setStringSelectMenuComponent(optionSelect);

        const assigneeSelectLabel = new LabelBuilder()
          .setLabel('Select an Assignee:')
          .setUserSelectMenuComponent(assigneeSelect);

        modal.addLabelComponents(cardSelectLabel, optionSelectLabel, assigneeSelectLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-assign_')) {
        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Assign a User to a Card')

        const optionSelect = new StringSelectMenuBuilder()
          .setCustomId('option')
          .setPlaceholder('assign/unassign')
          .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('assign')
                .setValue('assign')
                .setDefault(true),
            new StringSelectMenuOptionBuilder()
                .setLabel('unassign')
                .setValue('unassign')
          );

        const assigneeSelect = new UserSelectMenuBuilder()
          .setCustomId('assignee')
          .setPlaceholder('Select an Assignee.');

        const optionSelectLabel = new LabelBuilder()
          .setLabel('Select an option:')
          .setStringSelectMenuComponent(optionSelect);

        const assigneeSelectLabel = new LabelBuilder()
          .setLabel('Select an Assignee:')
          .setUserSelectMenuComponent(assigneeSelect);

        modal.addLabelComponents(optionSelectLabel, assigneeSelectLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-history_')) {
        const [_, cardIdStr] = interaction.customId.split('_');
        const cardId = parseInt(cardIdStr);

        const card = await prisma.card.findUnique({
          where: { id: cardId },
          select: {
            content: true
          }
        });
        if (!card) {
          await interaction.update({
            content: 'Card does not exist.'
          });
          return;
        }

        const result = await getCardHistory(cardId);
        
        if (!result.card || result.error) {
          await interaction.update({
            content: result.error ?? `An error occured while fetching the content history of the Card with ID \`${cardId}\`.`
          });
        } else {
          await interaction.update(createCardReply(result.card, null, false, true));
        }
      }
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'card') {
        const cardId = parseInt(interaction.values[0]);
        const card = await prisma.card.findUnique({
          where: { id: cardId },
          include: CardInclude
        });
        if (!card) return await interaction.update();

        await interaction.update(createCardReply(card, null, true))
      }
    } else if (interaction.isModalSubmit()) {
      if (interaction.isFromMessage()) {
        if (interaction.customId.startsWith('card-edit_')) {
          const [_, __, cardIdStr, property] = interaction.customId.split('_');
          const newValue = interaction.fields.getTextInputValue('value');
          const cardId = parseInt(cardIdStr);

          if (property !== 'title' && property !== 'content' && property !== 'url') {
            return interaction.update({
              content: "Invalid property."
            });
          }
          
          const result = await editCard(interaction.user, cardId, property, newValue);
          if (!result.card) return interaction.update({
            content: `An error occured while editing the Card with ID \`${cardIdStr}\`.`
          });

          await interaction.update(createCardReply(result.card, null, true));
        } else if (interaction.customId.startsWith('card-new_')) {
          const [_, boardIdStr, listIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);
          const listId = parseInt(listIdStr);

          const cardTitle = interaction.fields.getTextInputValue('title');
          const cardContent = interaction.fields.getTextInputValue('content');
          const cardUrl = interaction.fields.getTextInputValue('url');

          if (!cardTitle) {
            return interaction.update({
              content: "Missing Card name."
            });
          }

          const result = await newCard(interaction.user, boardId, listId, cardTitle, cardContent, cardUrl);
          if (!result.card) return interaction.update({
            content: "An error occured while creating the Card. Error: " + (!result.boardExists ? "The Board does not exist." : !result.listExists ? "The List does not exist." : result.cardExists ? "The Card already exits." : '')
          })

          await interaction.update(createListReply(result.card.list, null, false));
        } else if (interaction.customId.startsWith('card-move_')) {
          const [_, cardIdStr] = interaction.customId.split('_');
          const cardId = parseInt(cardIdStr);
          const listId = parseInt(interaction.fields.getStringSelectValues('list')[0]);
          
          const result = await moveCard(interaction.user, cardId, listId);
          if (!result.card || result.error) {
            return interaction.update({
              content: result.error ?? "An error occured while moving the Card."
            });
          }

          await interaction.update(createCardReply(result.card, null, false));
        } else if (interaction.customId.startsWith('board-card-move_')) {
          const cardId = parseInt(interaction.fields.getStringSelectValues('card')[0]);
          const listId = parseInt(interaction.fields.getStringSelectValues('list')[0]);

          const result = await moveCard(interaction.user, cardId, listId);
          if (!result.card || result.error) {
            return interaction.update({
              content: result.error ?? "An error occured while moving the Card."
            });
          }
          
          await interaction.update(createBoardReply(result.card.board, null, false));
        } else if (interaction.customId.startsWith('board-card-assign_')) {
          const [_, boardIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);
          const cardId = parseInt(interaction.fields.getStringSelectValues('card')[0]);
          const option = interaction.fields.getStringSelectValues('option')[0];
          const assignees = interaction.fields.getSelectedUsers('assignee');

          if (!assignees || assignees.size === 0) return interaction.update({
            content: "No Assignees selected."
          });

          const alreadyAssigned: string[] = [];

          if (option === 'unassign') {
            for (const [id, assignee] of assignees) {
              await cardUnassign(cardId, formatUser(assignee));
            };
          } else {
            for (const [id, assignee] of assignees) {
              const result = await cardAssign(formatUser(interaction.user), cardId, formatUser(assignee));
              if (result.error && result.assignment) {
                console.log(result.error)
                alreadyAssigned.push(result.assignment.assignee.discordId);
              }
            };
          }

          const board = await getBoard(boardId);
          if (!board) {
            await interaction.update({
              content: 'Board does not exist.'
            });
            return;
          }

          await interaction.update(createBoardReply(board, alreadyAssigned.length > 0 ? `Already assigned: ${alreadyAssigned.map(a => `<@${a}>`).join(', ')}` : null, false));
        } else if (interaction.customId.startsWith('card-assign_')) {
          const [_, cardIdStr] = interaction.customId.split('_');
          const cardId = parseInt(cardIdStr);
          const option = interaction.fields.getStringSelectValues('option')[0];
          const assignees = interaction.fields.getSelectedUsers('assignee');

          if (!assignees || assignees.size === 0) return interaction.update({
            content: "No Assignees selected."
          });

          const alreadyAssigned: string[] = [];

          if (option === 'unassign') {
            assignees.each(async assignee => {
              await cardUnassign(cardId, formatUser(assignee));
            });
          } else {
            assignees.each(async assignee => {
              const result = await cardAssign(formatUser(interaction.user), cardId, formatUser(assignee));
              if (result.error && result.assignment) {
                alreadyAssigned.push(result.assignment.assignee.discordId);
              }
            });
          }

          const card = await getCard(cardId);
          if (!card) {
            await interaction.update({
              content: 'Card does not exist.'
            });
            return;
          }

          await interaction.update(createCardReply(card, alreadyAssigned.length > 0 ? `Already assigned: ${alreadyAssigned.map(a => `<@${a}>`).join(', ')}` : null, false));
        }
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