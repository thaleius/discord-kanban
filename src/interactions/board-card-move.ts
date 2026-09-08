import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { getBoard, getCard, moveCard } from "../helpers/db";
import { checkPermission, createBoardReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
    const [_, boardIdStr] = interaction.customId.split('_');
    const boardId = parseInt(boardIdStr);

    const board = await getBoard(boardId);
    if (!board) {
      await interaction.reply({
        content: 'Board does not exist.',
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    if (board.cards.length === 0) {
      await interaction.reply({
        content: "No cards to move.",
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('Move Card to another List')

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

    const cardSelectLabel = new LabelBuilder()
      .setLabel('Select a Card:')
      .setStringSelectMenuComponent(cardSelect);

    const listSelectLabel = new LabelBuilder()
      .setLabel('Select a List:')
      .setStringSelectMenuComponent(listSelect);

    modal.addLabelComponents(cardSelectLabel, listSelectLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
    const cardId = parseInt(interaction.fields.getStringSelectValues('card')[0]);
    const listId = parseInt(interaction.fields.getStringSelectValues('list')[0]);

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

    const result = await moveCard(interaction.user, cardId, listId);
    if (!result.card || result.error) {
      return interaction.reply({
        content: result.error ?? "An error occured while moving the Card.",
        flags: [MessageFlags.Ephemeral]
      });
    }
    
    await interaction.update(createBoardReply(result.card.board, null, false));
  }
}