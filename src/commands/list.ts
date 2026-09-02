import { MessageFlags } from "discord.js";
import { DISCORD } from "../../config.json";
import { editList, getBoard, getBoards, getList, newList } from "../helpers/db";
import { createListEmbed, SlashCommandBuilder } from "../helpers/utils";
import { createCommand } from "../utils/command";

export default createCommand({
  data: SlashCommandBuilder()
    .setName("list")
    .setDescription("View or manage a List of a Board.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription("View a List of a Board.")
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
            .setName('name')
            .setDescription('Name of the new List')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of the new List')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription("Edit a List of a Board.")
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
            .setDescription('Name of the List to edit.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('property')
            .setDescription('The property to edit.')
            .setRequired(true)
            .addChoices(
              { name: 'name', value: 'name' },
              { name: 'description', value: 'description' },
            )
        )
        .addStringOption((option) =>
          option
            .setName('value')
            .setDescription('The new value')
            .setRequired(true)
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
    } else if (focusedOption.name === 'list') {
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

      const listName = interaction.options.getString('list');
      if (!listName) {
        await interaction.reply({
          content: 'You didn\'t select any List.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const list = await getList(boardName, listName);

      if (!list) {
        await interaction.reply({
          content: 'The selected Board or List doesn\'t exist.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        embeds: [createListEmbed(list)],
        withResponse: true
      });
    } else if (subcommand === 'new') {
      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'You\'re not permitted to create a new List.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const boardName = interaction.options.getString('board');
      const listName = interaction.options.getString('name');

      if (!boardName || !listName) {
        const errorMsg = [];
        if (!listName) {
          errorMsg.push('a name for the new List');
        }
        if (!boardName) {
          errorMsg.push('a Board to add the new List to');
        }
        const last = errorMsg.pop();
        await interaction.reply({
          content: `You must specify ${errorMsg.join(', ') + ' and ' + last}.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const result = await newList(interaction.user, boardName, listName);

      if (result.error || !result.list) {
        await interaction.reply({
          content: result.error ?? 'Failed to create the List.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        content: `The List _${result.list.name}_ has been created successfully on the Board _${boardName}_.`,
        embeds: [createListEmbed(result.list)],
        withResponse: true
      });
    } else if (subcommand === 'edit') {
      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'You\'re not permitted to edit Lists.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const boardName = interaction.options.getString('board');
      if (!boardName) {
        await interaction.reply({
          content: 'You must specify a Board.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      const listName = interaction.options.getString('list');
      if (!listName) {
        await interaction.reply({
          content: 'You must specify a List to edit.',
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
      if (property !== "name" && property !== "description") {
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

      const result = await editList(interaction.user, boardName, listName, property, newValue);

      if (!result.list ||result.error) {
        await interaction.reply({
          content: result.error ?? `An error occured while editing the List _${listName}_.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: `The List _${listName}_ has been edited successfully. Its new _${result.property}_ is _${result.value}_.`,
          embeds: [createListEmbed(result.list)],
          withResponse: true
        });
      }
      
    }
  },
});