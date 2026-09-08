import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getList } from "../helpers/db";
import { checkPermission } from "../helpers/utils";
import { InteractionMap } from "../utils/interactions";

export default {
  button: async (interaction: MessageComponentInteraction) => {
    const listId = parseInt(interaction.customId.split('_')[1]);
    const list = await getList(listId);
    if (!list) return await interaction.reply({
      content: 'The List does not exist.',
      flags: [MessageFlags.Ephemeral]
    });

    if (!checkPermission('card', interaction.user, list.board)) {
      return await interaction.reply({
        content: 'You do not have permission to delete this Card.',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('Delete Card')

    const cardSelect = new StringSelectMenuBuilder()
      .setCustomId('card')
      .setPlaceholder('Select a Card.')
      .addOptions(
        ...list.cards.map(card => 
          new StringSelectMenuOptionBuilder()
            .setLabel(card.title)
            .setValue(card.id.toString())
        )
      );

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setPlaceholder('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const cardSelectLabel = new LabelBuilder()
      .setLabel('Select a Card to delete:')
      .setStringSelectMenuComponent(cardSelect);

    const titleInputLabel = new LabelBuilder()
      .setLabel('Type the title of the Card to confirm:')
      .setTextInputComponent(titleInput);

    modal.addLabelComponents(cardSelectLabel, titleInputLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction, interactions: InteractionMap) => interactions.get('card-delete')!.modal(interaction, interactions)
}