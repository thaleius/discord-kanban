import { MessageFlags } from "discord.js";
import { DISCORD } from "../../config.json";
import { cardAssign, cardUnassign, editCard, getBoard, getBoardList, getBoards, getCard, getCardHistory, moveCard, newCard } from "../helpers/db";
import { SlashCommandBuilder, createCardReply } from "../helpers/utils";
import { createCommand } from "../utils/command";

export default createCommand({
  data: SlashCommandBuilder()
    .setName("card")
    .setDescription("View or manage a Card of a Board.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription("View a Card of a Board.")
        .addIntegerOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('ID of the Card.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('new')
        .setDescription('Create a new Card.')
        .addIntegerOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('list')
            .setDescription('Name of the List')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the new Card')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('content')
            .setDescription('Content of the new Card')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('URL')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Edit a Card of a Board.')
        .addIntegerOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('Card to edit.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('property')
            .setDescription('The property to edit.')
            .setRequired(true)
            .addChoices(
              { name: 'title', value: 'title' },
              { name: 'content', value: 'content' },
              { name: 'url', value: 'url' },
            )
        )
        .addStringOption((option) =>
          option
            .setName('value')
            .setDescription('The new value')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('assign')
        .setDescription('Assign a user to a Card.')
        .addIntegerOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('Card to assign a user to.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addUserOption((option) =>
          option
            .setName('assignee')
            .setDescription('User to assign to the Card.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unassign')
        .setDescription('Unassign a user to from Card.')
        .addIntegerOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('Card to assign a user to.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addUserOption((option) =>
          option
            .setName('assignee')
            .setDescription('User to unassign from the Card.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('move')
        .setDescription('Move a Card to another List.')
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('Card to move to another List.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('targetlist')
            .setDescription('List to move the Card to.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('history')
        .setDescription('View the content history of a Card.')
        .addIntegerOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('Name of the Card')
            .setRequired(true)
            .setAutocomplete(true)
        )
      ),
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    if (focusedOption.name === 'board') {
      const boards = await getBoards();
      const filtered = boards.filter(choice => 
        choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())
      );
      await interaction.respond(
        filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.id }))
      );
    } else if (focusedOption.name === 'list' || focusedOption.name === 'targetlist') {
      const boardId = interaction.options.getInteger('board');
      if (!boardId) return;

      const board = await getBoard(boardId);
      if (!board) return;

      const filtered = board.lists.filter(choice => 
        choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())
      );
      await interaction.respond(
        filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.id }))
      );
    } else if (focusedOption.name === 'card') {
      const boardId = interaction.options.getInteger('board');
      if (!boardId) return;
      const board = await getBoard(boardId);
      if (!board) return;

      const filtered = board.cards.filter(choice => 
        choice.title.toLowerCase().startsWith(focusedOption.value.toLowerCase())
      )
      await interaction.respond(
        filtered.slice(0, 25).map(choice => ({ name: choice.title, value: choice.id }))
      );
    }
  },
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'view') {
      const cardId = interaction.options.getInteger('card');
      if (!cardId) {
        await interaction.reply({
          content: 'You didn\'t select any Card.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const card = await getCard(cardId);

      if (!card) {
        await interaction.reply({
          content: 'The selected Card doesn\'t exist.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply(createCardReply(card));
    } else if (subcommand === 'new') {
      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'You\'re not permitted to create a new Card.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const boardName = interaction.options.getString('board');
      const listName = interaction.options.getString('list');
      const cardTitle = interaction.options.getString('name');
      const cardContent = interaction.options.getString('content');
      const cardUrl = interaction.options.getString('url');

      if (!boardName || !listName || !cardTitle) {
        const errorMsg = [];
        if (!cardTitle) {
          errorMsg.push('a name for the new Card');
        }
        if (!boardName) {
          errorMsg.push('a Board to add the new Card to');
        }
        if (!listName) {
          errorMsg.push('a List to add the new Card to');
        }
        const last = errorMsg.pop();
        await interaction.reply({
          content: `You must specify ${errorMsg.join(', ') + ' and ' + last}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const list = await getBoardList(boardName, listName);
      if (!list) {
        await interaction.reply({
          content: `List or Board does not exist.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await newCard(interaction.user, list.boardId, list.id, cardTitle, cardContent, cardUrl)

      if (!result.boardExists) {
        await interaction.reply({
          content: `A Board with the name \`${boardName}\` does not exist.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (result.cardExists) {
        await interaction.reply({
          content: `A Card with the name \`${cardTitle}\` already exists on the Board \`${boardName}\`.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (!result.listExists) {
        await interaction.reply({
          content: `A List with the name \`${listName}\` does not exist on the Board \`${boardName}\`.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (!result.card) {
        await interaction.reply({
          content: `An error occured while creating the Card \`${cardTitle}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply(createCardReply(result.card, `The Card \`${result.card!.title}\` has been created successfully in the List \`${listName}\`.`));
      }
    } else if (subcommand === 'edit') {
      const cardId = interaction.options.getInteger('card');

      if (!cardId) {
        const errorMsg = [];
        if (!cardId) {
          errorMsg.push('a Card to edit');
        }
        const last = errorMsg.pop();
        await interaction.reply({
          content: `You must specify ${errorMsg.join(', ') + ' and ' + last}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const card = await getCard(cardId);

      if (!card) {
        await interaction.reply({
          content: 'The Card does not exist.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id) || interaction.user.id !== card.createdBy.discordId) {
        await interaction.reply({
          content: 'You\'re not permitted to edit Card you didn\'t create.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const property = interaction.options.getString('property');
      if (!property) {
        await interaction.reply({
          content: 'You must specify a property to edit.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      if (property !== "title" && property !== "content" && property !== "url") {
        await interaction.reply({
          content: `\`${property}\` is not a valid property.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const newValue = interaction.options.getString('value');
      if (!newValue) {
        await interaction.reply({
          content: 'You must specify a value.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await editCard(interaction.user, cardId, property, newValue);

      if (!result.card) {
        await interaction.reply({
          content: `An error occured while editing the List \`${cardId}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply(createCardReply(result.card, `The Card \`${cardId}\` has been edited. Its new \`${result.property}\` is \`${result.value}\`.`));
      }
    } else if (subcommand === 'assign') {
      const cardId = interaction.options.getInteger('card');
      if (!cardId) {
        await interaction.reply({
          content: 'You didn\'t select any Card.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const assignee = interaction.options.getUser('assignee');
      if (!assignee) {
        await interaction.reply({
          content: 'You didn\'t select any User to assign.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await cardAssign(interaction.user, cardId, assignee);
      
      if (!result.assignment || result.error) {
        await interaction.reply({
          content: result.error ?? `An error occured while assigning <@${assignee.id}> to \`${cardId}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply(createCardReply(result.assignment.card, `<@${assignee.id}> has been successfully assigned to \`${cardId}\`.`));
      }
    } else if (subcommand === 'unassign') {
      const cardId = interaction.options.getInteger('card');
      if (!cardId) {
        await interaction.reply({
          content: 'You didn\'t select any Card.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const assignee = interaction.options.getUser('assignee');
      if (!assignee) {
        await interaction.reply({
          content: 'You didn\'t select any User to unassign.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await cardUnassign(cardId, assignee);
      
      if (!result.card || result.error) {
        await interaction.reply({
          content: result.error ?? `An error occured while unassigning <@${assignee.id}> from Card \`${cardId}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply(createCardReply(result.card, `<@${assignee.id}> has been successfully unassigned from \`${cardId}\`.`));
      }
    } else if (subcommand === 'move') {
      const cardId = interaction.options.getInteger('card');
      const targetListId = interaction.options.getInteger('targetlist');

      if (!cardId || !targetListId) {
        const errorMsg = [];
        if (!cardId) {
          errorMsg.push('a Card to edit');
        }
        if (!targetListId) {
          errorMsg.push('a target List');
        }
        const last = errorMsg.pop();
        await interaction.reply({
          content: `You must specify ${errorMsg.join(', ') + ' and ' + last}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await moveCard(interaction.user, cardId, targetListId);

      if (!result.card || result.error) {
        await interaction.reply({
          content: `An error occured while editing the Card with ID \`${cardId}\`: ${result.error}`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply(createCardReply(result.card, `The Card \`${result.card.title}\` has been successfully moved from \`${result.previousList}\` to _${result.card.list.name}.`));
      }
    } else if (subcommand === 'history') {
      const cardId = interaction.options.getInteger('card');

      if (!cardId) {
        const errorMsg = [];
        if (!cardId) {
          errorMsg.push('a Card to edit');
        }
        const last = errorMsg.pop();
        await interaction.reply({
          content: `You must specify ${errorMsg.join(', ') + ' and ' + last}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await getCardHistory(cardId);

      if (!result.card || result.error) {
        await interaction.reply({
          content: result.error ?? `An error occured while fetching the content history of the Card with ID \`${cardId}\`.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply(createCardReply(result.card, null, true, true));
      }
    }
  },
});