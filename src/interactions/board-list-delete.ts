import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { getBoard } from "../helpers/db";
import { checkPermission } from "../helpers/utils";
import { InteractionMap } from "../utils/interactions";

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
        content: 'You do not have permission to delete Lists of this Board.',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('Delete List')

    const listSelect = new StringSelectMenuBuilder()
      .setCustomId('list')
      .setPlaceholder('Select a List.')
      .addOptions(
        ...board.lists.map(list => 
          new StringSelectMenuOptionBuilder()
            .setLabel(list.name)
            .setValue(list.id.toString())
        )
      );

    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setPlaceholder('Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const listSelectLabel = new LabelBuilder()
      .setLabel('Select a List to delete:')
      .setStringSelectMenuComponent(listSelect);

    const nameInputLabel = new LabelBuilder()
      .setLabel('Type the name of the List to confirm:')
      .setTextInputComponent(nameInput);

    modal.addLabelComponents(listSelectLabel, nameInputLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction, interactions: InteractionMap) => interactions.get('list-delete')!.modal(interaction, interactions)
}