import { LabelBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalMessageModalSubmitInteraction, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } from "discord.js";
import { editCard, getCard } from "../helpers/db";
import { checkPermission, createCardReply, sortCardContentHistory } from "../helpers/utils";

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
        content: 'You do not have permission to change the settings of this Card.',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(interaction.customId)
      .setTitle('Card settings')

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setPlaceholder('Title')
      .setValue(card.title)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const titleInputLabel = new LabelBuilder()
      .setLabel('Title:')
      .setTextInputComponent(titleInput);

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setPlaceholder('Content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);
    const cardContent = sortCardContentHistory(card.content)[0].value;
    if (cardContent) contentInput.setValue(cardContent);

    const contentInputLabel = new LabelBuilder()
      .setLabel('Content:')
      .setTextInputComponent(contentInput);

    const urlInput = new TextInputBuilder()
      .setCustomId('url')
      .setPlaceholder('URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);
    if (card.url) urlInput.setValue(card.url);

    const urlInputLabel = new LabelBuilder()
      .setLabel('URL:')
      .setTextInputComponent(urlInput);

    const assigneeSelect = new UserSelectMenuBuilder()
      .setCustomId('assignees')
      .setPlaceholder('Assignees')
      .setDefaultUsers(card.assignments.map(assignment => assignment.assignee.discordId))
      .setMinValues(1)
      .setMaxValues(25)
      .setRequired(false);

    const assigneeSelectLabel = new LabelBuilder()
      .setLabel('Assignees:')
      .setUserSelectMenuComponent(assigneeSelect);

    const cardManagerSelect = new UserSelectMenuBuilder()
      .setCustomId('cardmanager')
      .setPlaceholder('Card Manager')
      .setDefaultUsers(card.permittedUsers.map(user => user.discordId))
      .setMinValues(1)
      .setMaxValues(25)
      .setRequired(false);

    const cardManagerSelectLabel = new LabelBuilder()
      .setLabel('Select Managers for this Card:')
      .setUserSelectMenuComponent(cardManagerSelect);

    modal.addLabelComponents(titleInputLabel, contentInputLabel, urlInputLabel, assigneeSelectLabel, cardManagerSelectLabel);
    await interaction.showModal(modal);
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {
    const [_, cardIdStr] = interaction.customId.split('_');
    const cardId = parseInt(cardIdStr);
    const title = interaction.fields.getTextInputValue('title');
    const content = interaction.fields.getTextInputValue('content');
    const url = interaction.fields.getTextInputValue('url');
    const assignees = interaction.fields.getSelectedUsers('assignees');
    const cardManager = interaction.fields.getSelectedUsers('cardmanager');

    const result = await editCard(interaction.user, cardId, { title, content, url, assignees, cardManager });
    if (result.error || !result.card) {
      await interaction.reply({
        content: result.error,
        flags: [MessageFlags.Ephemeral]
      });
      return;
    }

    await interaction.update(createCardReply(result.card, null, false));
  }
}