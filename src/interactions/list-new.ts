import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { getBoard, newList } from "../helpers/db";
import { checkPermission, createBoardReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
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
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
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
  }
}