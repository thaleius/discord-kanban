import { MessageComponentInteraction, MessageFlags, ModalMessageModalSubmitInteraction } from "discord.js";
import { getList } from "../helpers/db";
import { checkPermission, createListReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
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
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {}
}