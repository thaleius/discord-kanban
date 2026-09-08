import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { getCard, moveCard } from "../helpers/db";
import { checkPermission, createCardReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
    const [_, cardIdStr] = interaction.customId.split('_');
    const cardId = parseInt(cardIdStr);

    const card = await getCard(cardId);
    if (!card) {
      await interaction.reply({
        content: 'Card does not exist.',
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    if (!checkPermission('card', interaction.user, card.board, card)) {
      return await interaction.reply({
        content: 'You do not have permission to move this Card.',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('Move Card to another List')

    const listSelect = new StringSelectMenuBuilder()
      .setCustomId('list')
      .setPlaceholder('Select a List.')
      .addOptions(
        ...card.board.lists.map(list => 
          new StringSelectMenuOptionBuilder()
            .setLabel(list.name)
            .setValue(list.id.toString())
        )
      );

    const listSelectLabel = new LabelBuilder()
      .setLabel('Select a List:')
      .setStringSelectMenuComponent(listSelect);

    modal.addLabelComponents(listSelectLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
    const [_, cardIdStr] = interaction.customId.split('_');
    const cardId = parseInt(cardIdStr);
    const listId = parseInt(interaction.fields.getStringSelectValues('list')[0]);
    
    const result = await moveCard(interaction.user, cardId, listId);
    if (!result.card || result.error) {
      return interaction.reply({
        content: result.error ?? "An error occured while moving the Card.",
        flags: [MessageFlags.Ephemeral]
      });
    }

    await interaction.update(createCardReply(result.card, null, false));
  }
}