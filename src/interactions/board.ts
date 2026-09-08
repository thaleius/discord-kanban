import { MessageComponentInteraction, MessageFlags, ModalMessageModalSubmitInteraction } from "discord.js";
import { getBoard } from "../helpers/db";
import { checkPermission, createBoardReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
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
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {}
}