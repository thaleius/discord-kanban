import { MessageFlags } from "discord.js";
import { DISCORD } from "../../config.json";
import { cardAssign, editCard, getBoard, getBoards, getCard, moveCard, newCard } from "../helpers/db";
import { SlashCommandBuilder, Embed } from "../helpers/utils";
import { createCommand } from "../utils/command";

export default createCommand({
  data: SlashCommandBuilder()
    .setName("card")
    .setDescription("View or manage a Card of a Board.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription("View a Card of a Board.")
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        // .addStringOption((option) =>
        //   option
        //     .setName('list')
        //     .setDescription('Name of the List')
        //     .setRequired(false)
        //     .setAutocomplete(true)
        // )
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
        .setDescription('Create a new List.')
        .addStringOption((option) =>
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
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        // .addStringOption((option) =>
        //   option
        //     .setName('list')
        //     .setDescription('Name of the List')
        //     .setRequired(false)
        //     .setAutocomplete(true)
        // )
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
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        // .addStringOption((option) =>
        //   option
        //     .setName('list')
        //     .setDescription('Name of the List')
        //     .setRequired(false)
        //     .setAutocomplete(true)
        // )
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
        .setName('move')
        .setDescription('Move a Card to another List.')
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
        // .addStringOption((option) =>
        //   option
        //     .setName('list')
        //     .setDescription('Name of the List')
        //     .setRequired(false)
        //     .setAutocomplete(true)
        // )
        .addIntegerOption((option) =>
          option
            .setName('card')
            .setDescription('Card to move to another List.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('targetlist')
            .setDescription('List to move the Card to.')
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
        filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.name }))
      );
    } else if (focusedOption.name === 'list' || focusedOption.name === 'targetlist') {
      const boardName = interaction.options.getString('board');
      if (!boardName) return;

      const board = await getBoard(boardName);
      if (!board) return;

      const filtered = board.lists.filter(choice => 
        choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())
      );
      await interaction.respond(
        filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.name }))
      );
    } else if (focusedOption.name === 'card') {
      const boardName = interaction.options.getString('board');
      if (!boardName) return;
      const board = await getBoard(boardName);
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
      const boardName = interaction.options.getString('board');
      if (!boardName) {
        await interaction.reply({
          content: 'You didn\'t select any Board.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const cardId = interaction.options.getInteger('card');
      if (!cardId) {
        await interaction.reply({
          content: 'You didn\'t select any Card.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const card = await getCard(boardName, cardId);

      if (!card) {
        await interaction.reply({
          content: 'The selected Card doesn\'t exist.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const embed = Embed(card.title, card.board.name + ' | ' + card.list.name)
      if (card.content) {
        embed.setDescription(card.content);
      }

      await interaction.reply({
        embeds: [embed],
        withResponse: true
      });
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

      const result = await newCard(interaction.user, boardName, listName, cardTitle, cardContent, cardUrl)

      if (!result.boardExists) {
        await interaction.reply({
          content: `A Board with the name _${boardName}_ does not exist.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (result.cardExists) {
        await interaction.reply({
          content: `A Card with the name _${cardTitle}_ already exists on the Board _${boardName}_.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (!result.listExists) {
        await interaction.reply({
          content: `A List with the name _${listName}_ does not exist on the Board _${boardName}_.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        content: `The Card _${result.card!.title}_ has been created successfully in the List _${listName}_.`,
        flags: MessageFlags.Ephemeral
      });
    } else if (subcommand === 'edit') {
      const boardName = interaction.options.getString('board');
      const cardId = interaction.options.getInteger('card');

      if (!boardName || !cardId) {
        const errorMsg = [];
        if (!boardName) {
          errorMsg.push('a Board');
        }
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

      const card = await getCard(boardName, cardId);

      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id) || interaction.user.id !== card?.createdBy.discordId) {
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
          content: `_${property}_ is not a valid property.`,
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

      const result = await editCard(interaction.user, boardName, cardId, property, newValue);

      if (result.error) {
        await interaction.reply({
          content: `An error occured while editing the List _${cardId}_: ${result.error}`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: `The Card _${cardId}_ has been edited successfully. Its new _${result.property}_ is _${result.value}_.`,
          flags: MessageFlags.Ephemeral
        });
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
      
      if (result.error) {
        await interaction.reply({
          content: `An error occured while assigning <@${assignee.id}> to _${cardId}_: ${result.error}`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: `<@${assignee.id}> has been successfully assigned to _${cardId}_.`,
          flags: MessageFlags.Ephemeral
        });
      }
    } else if (subcommand === 'move') {
      const boardName = interaction.options.getString('board');
      const cardId = interaction.options.getInteger('card');
      const targetListName = interaction.options.getString('targetlist');

      if (!boardName || !cardId || !targetListName) {
        const errorMsg = [];
        if (!boardName) {
          errorMsg.push('a Board');
        }
        if (!cardId) {
          errorMsg.push('a Card to edit');
        }
        if (!cardId) {
          errorMsg.push('a target List');
        }
        const last = errorMsg.pop();
        await interaction.reply({
          content: `You must specify ${errorMsg.join(', ') + ' and ' + last}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await moveCard(interaction.user, boardName, cardId, targetListName);

      if (result.error) {
        await interaction.reply({
          content: `An error occured while editing the Card with ID _${cardId}_: ${result.error}`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: `The Card _${result.card!.title}_ has been successfully moved from _${result.previousList}_ to _${result.card!.list.name}.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  },
});