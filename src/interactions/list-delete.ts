import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { deleteList, getList } from "../helpers/db";
import { checkPermission, createBoardReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
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
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
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