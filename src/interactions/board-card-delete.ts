import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getBoard } from "../helpers/db";
import { InteractionMap } from "../utils/interactions";

export default {
  button: async (interaction: MessageComponentInteraction) => {
    const boardId = parseInt(interaction.customId.split('_')[1]);
    const board = await getBoard(boardId);
    if (!board) return await interaction.reply({
      content: 'The Board does not exist.',
      flags: [MessageFlags.Ephemeral]
    });

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('Delete Card')

    const cardSelect = new StringSelectMenuBuilder()
      .setCustomId('card')
      .setPlaceholder('Select a Card.')
      .addOptions(
        ...board.cards.map(card => 
          new StringSelectMenuOptionBuilder()
            .setLabel(card.title)
            .setValue(card.id.toString())
        )
      );

    const title = new TextInputBuilder()
      .setCustomId('title')
      .setPlaceholder('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const cardSelectLabel = new LabelBuilder()
      .setLabel('Select a Card to delete:')
      .setStringSelectMenuComponent(cardSelect);

    const nameInputLabel = new LabelBuilder()
      .setLabel('Type the title of the Card to confirm:')
      .setTextInputComponent(title);

    modal.addLabelComponents(cardSelectLabel, nameInputLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction, interactions: InteractionMap) => interactions.get('card-delete')!.modal(interaction, interactions)
}