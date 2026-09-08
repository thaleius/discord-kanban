import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { deleteCard, getCard } from "../helpers/db";
import { checkPermission, createBoardReply, createListReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
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
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
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
  }
}