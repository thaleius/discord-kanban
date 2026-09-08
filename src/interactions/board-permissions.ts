import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, UserSelectMenuBuilder } from "discord.js";
import { boardPerms, getBoard } from "../helpers/db";
import { checkPermission } from "../helpers/utils";

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
      .setTitle('Permissions')

    const boardViewerInput = new UserSelectMenuBuilder()
      .setCustomId('boardviewer')
      .setPlaceholder('Board Viewer')
      .setDefaultUsers(board.boardViewer.map(viewer => viewer.discordId))
      .setMinValues(1)
      .setMaxValues(25)
      .setRequired(false);

    const boardViewerInputLabel = new LabelBuilder()
      .setLabel('Board Viewer:')
      .setUserSelectMenuComponent(boardViewerInput);

    const boardManagerInput = new UserSelectMenuBuilder()
      .setCustomId('boardmanager')
      .setPlaceholder('Board Manager')
      .setDefaultUsers(board.boardManager.map(manager => manager.discordId))
      .setMinValues(1)
      .setMaxValues(25)
      .setRequired(false);

    const boardManagerInputLabel = new LabelBuilder()
      .setLabel('Board Manager:')
      .setUserSelectMenuComponent(boardManagerInput);

    const listManagerInput = new UserSelectMenuBuilder()
      .setCustomId('listmanager')
      .setPlaceholder('List Manager')
      .setDefaultUsers(board.listManager.map(manager => manager.discordId))
      .setMinValues(1)
      .setMaxValues(25)
      .setRequired(false);

    const listManagerInputLabel = new LabelBuilder()
      .setLabel('List Manager:')
      .setUserSelectMenuComponent(listManagerInput);

    const cardManagerInput = new UserSelectMenuBuilder()
      .setCustomId('cardmanager')
      .setPlaceholder('Card Manager')
      .setDefaultUsers(board.cardManager.map(manager => manager.discordId))
      .setMinValues(1)
      .setMaxValues(25)
      .setRequired(false);

    const cardManagerInputLabel = new LabelBuilder()
      .setLabel('Card Manager:')
      .setUserSelectMenuComponent(cardManagerInput);

    modal.addLabelComponents(boardViewerInputLabel, boardManagerInputLabel, listManagerInputLabel, cardManagerInputLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
    const [_, boardIdStr] = interaction.customId.split('_');
    const boardId = parseInt(boardIdStr);
    const boardViewer = interaction.fields.getSelectedUsers('boardviewer');
    const boardManager = interaction.fields.getSelectedUsers('boardmanager');
    const listManager = interaction.fields.getSelectedUsers('listmanager');
    const cardManager = interaction.fields.getSelectedUsers('cardmanager');

    const result = await boardPerms(interaction.user, boardId, { boardViewer, boardManager, listManager, cardManager });
    if (result && result.error) {
      await interaction.reply({
        content: result.error,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    await interaction.reply({
      content: 'Permissions changed.',
      flags: [MessageFlags.Ephemeral]
    });
  }
}