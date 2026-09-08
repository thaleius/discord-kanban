import { Client, Events, GatewayIntentBits, LabelBuilder, MessageFlags, ModalBuilder, Partials, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from "discord.js";
import { DISCORD } from '../config.json';
import { boardPerms, deleteCard, deleteList, editBoard, editCard, getBoard, getCard, getCardHistory, getList, moveCard, newCard, newList } from "./helpers/db";
import { checkPermission, createBoardReply, createCardReply, createListReply, sortCardContentHistory } from "./helpers/utils";
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
      if (interaction.customId.startsWith('board-settings_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await getBoard(boardId);
        if (!board) return await interaction.reply({
          content: 'The Board does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('board', interaction.user, board)) {
          return await interaction.reply({
            content: 'You do not have permission to change the settings of this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Settings')

        const nameInput = new TextInputBuilder()
          .setCustomId('name')
          .setPlaceholder('Name')
          .setValue(board.name)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const iconInput = new TextInputBuilder()
          .setCustomId('icon')
          .setPlaceholder('Icon')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        const nameInputLabel = new LabelBuilder()
          .setLabel('Name:')
          .setTextInputComponent(nameInput);

        const iconInputLabel = new LabelBuilder()
          .setLabel('Icon:')
          .setTextInputComponent(iconInput);

        modal.addLabelComponents(nameInputLabel, iconInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('board-permissions_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await getBoard(boardId);
        if (!board) return await interaction.reply({
          content: 'The Board does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('board', interaction.user, board)) {
          return await interaction.reply({
            content: 'You do not have permission to change the settings of this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Permissions')

        const boardViewerInput = new UserSelectMenuBuilder()
          .setCustomId('boardviewer')
          .setPlaceholder('Board Viewer')
          .setDefaultUsers(board.boardViewer.map(viewer => viewer.discordId))
          .setMinValues(1)
          .setMaxValues(25)
          .setRequired(false);

        const boardViewerInputLabel = new LabelBuilder()
          .setLabel('Board Viewer:')
          .setUserSelectMenuComponent(boardViewerInput);

        const boardManagerInput = new UserSelectMenuBuilder()
          .setCustomId('boardmanager')
          .setPlaceholder('Board Manager')
          .setDefaultUsers(board.boardManager.map(manager => manager.discordId))
          .setMinValues(1)
          .setMaxValues(25)
          .setRequired(false);

        const boardManagerInputLabel = new LabelBuilder()
          .setLabel('Board Manager:')
          .setUserSelectMenuComponent(boardManagerInput);

        const listManagerInput = new UserSelectMenuBuilder()
          .setCustomId('listmanager')
          .setPlaceholder('List Manager')
          .setDefaultUsers(board.listManager.map(manager => manager.discordId))
          .setMinValues(1)
          .setMaxValues(25)
          .setRequired(false);

        const listManagerInputLabel = new LabelBuilder()
          .setLabel('List Manager:')
          .setUserSelectMenuComponent(listManagerInput);

        const cardManagerInput = new UserSelectMenuBuilder()
          .setCustomId('cardmanager')
          .setPlaceholder('Card Manager')
          .setDefaultUsers(board.cardManager.map(manager => manager.discordId))
          .setMinValues(1)
          .setMaxValues(25)
          .setRequired(false);

        const cardManagerInputLabel = new LabelBuilder()
          .setLabel('Card Manager:')
          .setUserSelectMenuComponent(cardManagerInput);

        modal.addLabelComponents(boardViewerInputLabel, boardManagerInputLabel, listManagerInputLabel, cardManagerInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('board_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await getBoard(boardId);
        if (!board) return await interaction.reply({
          content: 'The Board does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('view-board', interaction.user, board)) {
          return await interaction.reply({
            content: 'You do not have permission to view this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        await interaction.update(createBoardReply(board, null, true));
      } else if (interaction.customId.startsWith('list_')) {
        const listId = parseInt(interaction.customId.split('_')[1]);
        const list = await getList(listId);
        if (!list) return await interaction.reply({
          content: 'The List does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('view-board', interaction.user, list.board)) {
          return await interaction.reply({
            content: 'You do not have permission to view Lists of this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        await interaction.update(createListReply(list, null, true));
      } else if (interaction.customId.startsWith('list-new_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await getBoard(boardId);
        if (!board) return await interaction.reply({
          content: 'The Board does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('list', interaction.user, board)) {
          return await interaction.reply({
            content: 'You do not have permission to create Lists on this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('New List')

        const nameInput = new TextInputBuilder()
          .setCustomId('name')
          .setPlaceholder('Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setPlaceholder('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);

        const nameInputLabel = new LabelBuilder()
          .setLabel('Title:')
          .setTextInputComponent(nameInput);

        const descriptionInputLabel = new LabelBuilder()
          .setLabel('Description:')
          .setTextInputComponent(descriptionInput);

        modal.addLabelComponents(nameInputLabel, descriptionInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('board-list-delete_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await getBoard(boardId);
        if (!board) return await interaction.reply({
          content: 'The Board does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('list', interaction.user, board)) {
          return await interaction.reply({
            content: 'You do not have permission to delete Lists of this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Delete List')

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

        const nameInput = new TextInputBuilder()
          .setCustomId('name')
          .setPlaceholder('Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const listSelectLabel = new LabelBuilder()
          .setLabel('Select a List to delete:')
          .setStringSelectMenuComponent(listSelect);

        const nameInputLabel = new LabelBuilder()
          .setLabel('Type the name of the List to confirm:')
          .setTextInputComponent(nameInput);

        modal.addLabelComponents(listSelectLabel, nameInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('list-card-delete_')) {
        const listId = parseInt(interaction.customId.split('_')[1]);
        const list = await getList(listId);
        if (!list) return await interaction.reply({
          content: 'The List does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('card', interaction.user, list.board)) {
          return await interaction.reply({
            content: 'You do not have permission to delete this Card.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Delete Card')

        const cardSelect = new StringSelectMenuBuilder()
          .setCustomId('card')
          .setPlaceholder('Select a Card.')
          .addOptions(
            ...list.cards.map(card => 
              new StringSelectMenuOptionBuilder()
                .setLabel(card.title)
                .setValue(card.id.toString())
            )
          );

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setPlaceholder('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const cardSelectLabel = new LabelBuilder()
          .setLabel('Select a Card to delete:')
          .setStringSelectMenuComponent(cardSelect);

        const titleInputLabel = new LabelBuilder()
          .setLabel('Type the title of the Card to confirm:')
          .setTextInputComponent(titleInput);

        modal.addLabelComponents(cardSelectLabel, titleInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('list-delete_')) {
        const listId = parseInt(interaction.customId.split('_')[1]);
        const list = await getList(listId);
        if (!list) return await interaction.reply({
          content: 'The List does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('list', interaction.user, list.board)) {
          return await interaction.reply({
            content: 'You do not have permission to delete Lists of this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Delete List')

        const nameInput = new TextInputBuilder()
          .setCustomId('name')
          .setPlaceholder('Name')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const nameInputLabel = new LabelBuilder()
          .setLabel('Type the name of the List to confirm:')
          .setTextInputComponent(nameInput);

        modal.addLabelComponents(nameInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-edit_')) {
        const [_, __, cardIdStr, property] = interaction.customId.split('_');
        const cardId = parseInt(cardIdStr);
        const card = await getCard(cardId)
        if (!card) return await interaction.reply({
          content: 'The Card does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('card', interaction.user, card.board, card)) {
          return await interaction.reply({
            content: 'You do not have permission to edit this Card.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        if (property !== 'title' && property !== 'content' && property !== 'url') {
          return await interaction.reply({
            content: 'Please define the property you want to edit.',
            flags: [MessageFlags.Ephemeral]
          });
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
          .setLabel('Edit ' + (property === 'url' ? 'URL' : property) + ':')
          .setTextInputComponent(textInput)

        modal.addLabelComponents(inputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('list-card-new_')) {
        const [_, listIdStr] = interaction.customId.split('_');
        const listId = parseInt(listIdStr);
        const list = await getList(listId);
        if (!list) return await interaction.reply({
          content: 'The List does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        if (!checkPermission('card', interaction.user, list.board)) {
          return await interaction.reply({
            content: 'You do not have permission to create Cards on this Board.',
            flags: [MessageFlags.Ephemeral]
          });
        }

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

        const card = await getCard(cardId);
        if (!card) {
          await interaction.reply({
            content: 'Card does not exist.',
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        if (!checkPermission('card', interaction.user, card.board, card)) {
          return await interaction.reply({
            content: 'You do not have permission to move this Card.',
            flags: [MessageFlags.Ephemeral]
          });
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

        const board = await getBoard(boardId);
        if (!board) {
          await interaction.reply({
            content: 'Board does not exist.',
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        if (board.cards.length === 0) {
          await interaction.reply({
            content: "No cards to move.",
            flags: [MessageFlags.Ephemeral]
          });
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

        const board = await getBoard(boardId);
        if (!board) {
          await interaction.reply({
            content: 'Board does not exist.',
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        if (board.cards.length === 0) {
          await interaction.reply({
            content: 'Board does not have any cards.',
            flags: [MessageFlags.Ephemeral]
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

        const assigneeSelect = new UserSelectMenuBuilder()
          .setCustomId('assignee')
          .setPlaceholder('Assignees')
          .setRequired(false);

        const cardSelectLabel = new LabelBuilder()
          .setLabel('Select a Card:')
          .setStringSelectMenuComponent(cardSelect);

        const assigneeSelectLabel = new LabelBuilder()
          .setLabel('Assignees')
          .setUserSelectMenuComponent(assigneeSelect);

        modal.addLabelComponents(cardSelectLabel, assigneeSelectLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('board-card-delete_')) {
        const boardId = parseInt(interaction.customId.split('_')[1]);
        const board = await getBoard(boardId);
        if (!board) return await interaction.reply({
          content: 'The Board does not exist.',
          flags: [MessageFlags.Ephemeral]
        });

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Delete Card')

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

        const title = new TextInputBuilder()
          .setCustomId('title')
          .setPlaceholder('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const cardSelectLabel = new LabelBuilder()
          .setLabel('Select a Card to delete:')
          .setStringSelectMenuComponent(cardSelect);

        const nameInputLabel = new LabelBuilder()
          .setLabel('Type the title of the Card to confirm:')
          .setTextInputComponent(title);

        modal.addLabelComponents(cardSelectLabel, nameInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-delete_')) {
        const cardId = parseInt(interaction.customId.split('_')[1]);
        const card = await getCard(cardId);
        if (!card) return await interaction.reply({
          content: 'The Card does not exist.',
          flags: [MessageFlags.Ephemeral]
        });
        
        if (!checkPermission('card', interaction.user, card.board, card)) {
          return await interaction.reply({
            content: 'You do not have permission to delete this Card.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Delete Card')

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setPlaceholder('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const titleInputLabel = new LabelBuilder()
          .setLabel('Type the title of the Card to confirm:')
          .setTextInputComponent(titleInput);

        modal.addLabelComponents(titleInputLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-settings_')) {
        const [_, cardIdStr] = interaction.customId.split('_');
        const cardId = parseInt(cardIdStr);

        const card = await getCard(cardId);
        if (!card) {
          await interaction.reply({
            content: 'Card does not exist.',
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        if (!checkPermission('card', interaction.user, card.board, card)) {
          return await interaction.reply({
            content: 'You do not have permission to change the settings of this Card.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const modal = new ModalBuilder()
          .setCustomId(interaction.customId)
          .setTitle('Card settings')

        const titleInput = new TextInputBuilder()
          .setCustomId('title')
          .setPlaceholder('Title')
          .setValue(card.title)
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const titleInputLabel = new LabelBuilder()
          .setLabel('Title:')
          .setTextInputComponent(titleInput);

        const contentInput = new TextInputBuilder()
          .setCustomId('content')
          .setPlaceholder('Content')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false);
        const cardContent = sortCardContentHistory(card.content)[0].value;
        if (cardContent) contentInput.setValue(cardContent);

        const contentInputLabel = new LabelBuilder()
          .setLabel('Content:')
          .setTextInputComponent(contentInput);

        const urlInput = new TextInputBuilder()
          .setCustomId('url')
          .setPlaceholder('URL')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);
        if (card.url) urlInput.setValue(card.url);

        const urlInputLabel = new LabelBuilder()
          .setLabel('URL:')
          .setTextInputComponent(urlInput);

        const assigneeSelect = new UserSelectMenuBuilder()
          .setCustomId('assignees')
          .setPlaceholder('Assignees')
          .setDefaultUsers(card.assignments.map(assignment => assignment.assignee.discordId))
          .setMinValues(1)
          .setMaxValues(25)
          .setRequired(false);

        const assigneeSelectLabel = new LabelBuilder()
          .setLabel('Assignees:')
          .setUserSelectMenuComponent(assigneeSelect);

        const cardManagerSelect = new UserSelectMenuBuilder()
          .setCustomId('cardmanager')
          .setPlaceholder('Card Manager')
          .setDefaultUsers(card.permittedUsers.map(user => user.discordId))
          .setMinValues(1)
          .setMaxValues(25)
          .setRequired(false);

        const cardManagerSelectLabel = new LabelBuilder()
          .setLabel('Select Managers for this Card:')
          .setUserSelectMenuComponent(cardManagerSelect);

        modal.addLabelComponents(titleInputLabel, contentInputLabel, urlInputLabel, assigneeSelectLabel, cardManagerSelectLabel);
        await interaction.showModal(modal);
      } else if (interaction.customId.startsWith('card-history_')) {
        const [_, cardIdStr] = interaction.customId.split('_');
        const cardId = parseInt(cardIdStr);

        const card = await getCard(cardId);
        if (!card) {
          await interaction.reply({
            content: 'Card does not exist.',
            flags: [MessageFlags.Ephemeral]
          });
          return;
        }

        if (!checkPermission('view-board', interaction.user, card.board)) {
          return await interaction.reply({
            content: 'You do not have permission to view the history of this Card.',
            flags: [MessageFlags.Ephemeral]
          });
        }

        const result = await getCardHistory(cardId);
        
        if (!result.card || result.error) {
          await interaction.reply({
            content: result.error ?? `An error occured while fetching the content history of the Card with ID \`${cardId}\`.`,
            flags: [MessageFlags.Ephemeral]
          });
        } else {
          await interaction.update(createCardReply(result.card, null, false, true));
        }
      }
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
        if (interaction.customId.startsWith('board-settings_')) {
          const [_, boardIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);
          const name = interaction.fields.getTextInputValue('name');
          const icon = interaction.fields.getTextInputValue('icon');

          const result = await editBoard(interaction.user, boardId, { name, icon });
          if (result.error || !result.board) {
            await interaction.reply({
              content: result.error,
              flags: [MessageFlags.Ephemeral]
            });
            return;
          }

          await interaction.update(createBoardReply(result.board, null, false));
        } else if (interaction.customId.startsWith('board-permissions_')) {
          const [_, boardIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);
          const boardViewer = interaction.fields.getSelectedUsers('boardviewer');
          const boardManager = interaction.fields.getSelectedUsers('boardmanager');
          const listManager = interaction.fields.getSelectedUsers('listmanager');
          const cardManager = interaction.fields.getSelectedUsers('cardmanager');

          const result = await boardPerms(interaction.user, boardId, { boardViewer, boardManager, listManager, cardManager });
          if (result && result.error) {
            await interaction.reply({
              content: result.error,
              flags: [MessageFlags.Ephemeral]
            });
            return;
          }

          await interaction.reply({
            content: 'Permissions changed.',
            flags: [MessageFlags.Ephemeral]
          });
        } else if (interaction.customId.startsWith('list-new_')) {
          const [_, boardIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);

          const listName = interaction.fields.getTextInputValue('name');
          const listDescription = interaction.fields.getTextInputValue('description');

          if (!listName) {
            return interaction.reply({
              content: "Missing List name.",
              flags: [MessageFlags.Ephemeral]
            });
          }

          const result = await newList(interaction.user, boardId, listName, listDescription);
          if (result.error || !result.list) return interaction.reply({
            content: result.error ?? "An error occured while creating the List.",
            flags: [MessageFlags.Ephemeral]
          })

          await interaction.update(createBoardReply(result.list.board, null, false));
        } else if (interaction.customId.startsWith('list-card-new_')) {
          const [_, boardIdStr, listIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);
          const listId = parseInt(listIdStr);

          const cardTitle = interaction.fields.getTextInputValue('title');
          const cardContent = interaction.fields.getTextInputValue('content');
          const cardUrl = interaction.fields.getTextInputValue('url');

          if (!cardTitle) {
            return interaction.reply({
              content: "Missing Card title.",
              flags: [MessageFlags.Ephemeral]
            });
          }

          const result = await newCard(interaction.user, boardId, listId, cardTitle, cardContent, cardUrl);
          if (result.error || !result.card) return interaction.reply({
            content: result.error ?? "An error occured while creating the Card.",
            flags: [MessageFlags.Ephemeral]
          })

          await interaction.update(createListReply(result.card.list, null, false));
        } else if (interaction.customId.startsWith('card-move_')) {
          const [_, cardIdStr] = interaction.customId.split('_');
          const cardId = parseInt(cardIdStr);
          const listId = parseInt(interaction.fields.getStringSelectValues('list')[0]);
          
          const result = await moveCard(interaction.user, cardId, listId);
          if (!result.card || result.error) {
            return interaction.reply({
              content: result.error ?? "An error occured while moving the Card.",
              flags: [MessageFlags.Ephemeral]
            });
          }

          await interaction.update(createCardReply(result.card, null, false));
        } else if (interaction.customId.startsWith('board-card-move_')) {
          const cardId = parseInt(interaction.fields.getStringSelectValues('card')[0]);
          const listId = parseInt(interaction.fields.getStringSelectValues('list')[0]);

          const card = await getCard(cardId);
          if (!card) {
            await interaction.reply({
              content: 'Card does not exist.',
              flags: [MessageFlags.Ephemeral]
            });
            return;
          }

          if (!checkPermission('card', interaction.user, card.board, card)) {
            return await interaction.reply({
              content: 'You do not have permission to move this Card.',
              flags: [MessageFlags.Ephemeral]
            });
          }

          const result = await moveCard(interaction.user, cardId, listId);
          if (!result.card || result.error) {
            return interaction.reply({
              content: result.error ?? "An error occured while moving the Card.",
              flags: [MessageFlags.Ephemeral]
            });
          }
          
          await interaction.update(createBoardReply(result.card.board, null, false));
        } else if (interaction.customId.startsWith('board-card-assign_')) {
          const [_, boardIdStr] = interaction.customId.split('_');
          const boardId = parseInt(boardIdStr);
          const cardId = parseInt(interaction.fields.getStringSelectValues('card')[0]);
          const assignees = interaction.fields.getSelectedUsers('assignee');

          const card = await editCard(interaction.user, cardId, { assignees });
          if (!card) {
            await interaction.reply({
              content: 'Card does not exist.',
              flags: [MessageFlags.Ephemeral]
            });
            return;
          }

          const board = await getBoard(boardId);
          if (!board) {
            await interaction.reply({
              content: 'Board does not exist.',
              flags: [MessageFlags.Ephemeral]
            });
            return;
          }

          await interaction.update(createBoardReply(board, null, false));
        } else if (interaction.customId.startsWith('card-settings_')) {
          const [_, cardIdStr] = interaction.customId.split('_');
          const cardId = parseInt(cardIdStr);
          const title = interaction.fields.getTextInputValue('title');
          const content = interaction.fields.getTextInputValue('content');
          const url = interaction.fields.getTextInputValue('url');
          const assignees = interaction.fields.getSelectedUsers('assignees');
          const cardManager = interaction.fields.getSelectedUsers('cardmanager');

          const result = await editCard(interaction.user, cardId, { title, content, url, assignees, cardManager });
          if (result.error || !result.card) {
            await interaction.reply({
              content: result.error,
              flags: [MessageFlags.Ephemeral]
            });
            return;
          }

          await interaction.update(createCardReply(result.card, null, false));
        } else if (interaction.customId.startsWith('board-card-delete_') || interaction.customId.startsWith('list-card-delete_') || interaction.customId.startsWith('card-delete_')) {
          const cardId = parseInt(interaction.customId.startsWith('card-delete_') ? interaction.customId.split('_')[1] : interaction.fields.getStringSelectValues('card')[0]);
          const cardTitle = interaction.fields.getTextInputValue('title');

          const card = await deleteCard(interaction.user, cardId, cardTitle);
          if (!card) {
            return interaction.reply({
              content: "An error occured while deleting the Card.",
              flags: [MessageFlags.Ephemeral]
            });
          }
          
          await interaction.update(interaction.customId.startsWith('list-card-delete_') ? createListReply(card.list, null, false) : createBoardReply(card.board, null, false));
        } else if (interaction.customId.startsWith('board-list-delete_') || interaction.customId.startsWith('list-delete_')) {
          const listId = parseInt(interaction.customId.startsWith('list-delete_') ? interaction.customId.split('_')[1] : interaction.fields.getStringSelectValues('list')[0]);
          const listName = interaction.fields.getTextInputValue('name');

          const list = await deleteList(interaction.user, listId, listName);
          if (!list) {
            return interaction.reply({
              content: "An error occured while deleting the List.",
              flags: [MessageFlags.Ephemeral]
            });
          }
          
          await interaction.update(createBoardReply(list.board, null, false));
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