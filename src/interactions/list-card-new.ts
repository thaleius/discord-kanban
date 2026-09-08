import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import { getList, newCard } from "../helpers/db";
import { checkPermission, createListReply } from "../helpers/utils";

export default {
  button: async (interaction: MessageComponentInteraction) => {
    const [_, listIdStr] = interaction.customId.split('_');
    const listId = parseInt(listIdStr);
    const list = await getList(listId);
    if (!list) return await interaction.reply({
      content: 'The List does not exist.',
      flags: [MessageFlags.Ephemeral]
    });

    if (!checkPermission('card', interaction.user, list.board)) {
      return await interaction.reply({
        content: 'You do not have permission to create Cards on this Board.',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('New Card')

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setPlaceholder('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setPlaceholder('Content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const urlInput = new TextInputBuilder()
      .setCustomId('url')
      .setPlaceholder('URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const titleInputLabel = new LabelBuilder()
      .setLabel('Title:')
      .setTextInputComponent(titleInput);

    const contentInputLabel = new LabelBuilder()
      .setLabel('Content:')
      .setTextInputComponent(contentInput);

    const urlInputLabel = new LabelBuilder()
      .setLabel('URL:')
      .setTextInputComponent(urlInput);

    modal.addLabelComponents(titleInputLabel, contentInputLabel, urlInputLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
    const [_, boardIdStr, listIdStr] = interaction.customId.split('_');
    const boardId = parseInt(boardIdStr);
    const listId = parseInt(listIdStr);

    const cardTitle = interaction.fields.getTextInputValue('title');
    const cardContent = interaction.fields.getTextInputValue('content');
    const cardUrl = interaction.fields.getTextInputValue('url');

    if (!cardTitle) {
      return interaction.reply({
        content: "Missing Card title.",
        flags: [MessageFlags.Ephemeral]
      });
    }

    const result = await newCard(interaction.user, boardId, listId, cardTitle, cardContent, cardUrl);
    if (result.error || !result.card) return interaction.reply({
      content: result.error ?? "An error occured while creating the Card.",
      flags: [MessageFlags.Ephemeral]
    })

    await interaction.update(createListReply(result.card.list, null, false));
  }
}