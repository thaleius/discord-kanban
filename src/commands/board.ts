import { APIEmbedField, MessageFlags } from "discord.js";
import { DISCORD } from "../../config.json";
import { editBoard, getBoard, getBoards, newBoard } from "../helpers/db";
import { SlashCommandBuilder, Embed, valueBuilder } from "../helpers/utils";
import { createCommand } from "../utils/command";

export default createCommand({
  data: SlashCommandBuilder()
    .setName("board")
    .setDescription("View or manage a Board.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View a Board.')
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('new')
        .setDescription('Create a new Board.')
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of the Board')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('edit')
        .setDescription('Edit a Board.')
        .addStringOption((option) =>
          option
            .setName('board')
            .setDescription('Name of the Board to edit.')
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

      const board = await getBoard(boardName);

      if (!board) {
        await interaction.reply({
          content: 'The selected Board doesn\'t exist.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const fields = board.lists.map(list => {
        const field: APIEmbedField = {
          name: list.name,
          value: valueBuilder(list),
          inline: true
        }
        return field;
      });

      const embed = Embed(board.name).addFields(fields);

      await interaction.reply({
        embeds: [embed],
        withResponse: true
      });
    } else if (subcommand === 'new') {
      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'You\'re not permitted to create a new Board.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const boardName = interaction.options.getString('name');
      if (!boardName) {
        await interaction.reply({
          content: 'You must specify a name for the new Board.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const boardDescription = interaction.options.getString('description');

      const result = await newBoard(interaction.user, boardName, boardDescription)

      if (result.boardExists) {
        await interaction.reply({
          content: `A Board with the name _${boardName}_ already exists.`,
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      await interaction.reply({
        content: `The Board _${result.board.name}_ has been created successfully.`,
        flags: MessageFlags.Ephemeral
      });
    } else if (subcommand === 'edit') {
      if (!DISCORD.ADMIN_IDs.includes(interaction.user.id)) {
        await interaction.reply({
          content: 'You\'re not permitted to edit Boards.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      const boardName = interaction.options.getString('board');
      if (!boardName) {
        await interaction.reply({
          content: 'You must specify a Board to edit.',
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

      const result = await editBoard(interaction.user, boardName, property, newValue);

      if (result.success) {
        await interaction.reply({
          content: `The Board _${boardName}_ has been edited successfully. Its new _${result.property}_ is _${result.value}_.`,
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.reply({
          content: `An error occured while editing the Board _${boardName}_.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }
  },
});