import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { editBoard, getBoard } from "../helpers/db";
import { checkPermission, createBoardReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
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
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
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
  }
}