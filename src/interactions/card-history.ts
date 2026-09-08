import { MessageComponentInteraction, MessageFlags, ModalMessageModalSubmitInteraction } from "discord.js";
import { getCard, getCardHistory } from "../helpers/db";
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

    if (!checkPermission('view-board', interaction.user, card.board)) {
      return await interaction.reply({
        content: 'You do not have permission to view the history of this Card.',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const result = await getCardHistory(cardId);
    
    if (!result.card || result.error) {
      await interaction.reply({
        content: result.error ?? `An error occured while fetching the content history of the Card with ID \`${cardId}\`.`,
        flags: [MessageFlags.Ephemeral]
      });
    } else {
      await interaction.update(createCardReply(result.card, null, false, true));
    }
  },
  modal: async (interaction: ModalMessageModalSubmitInteraction) => {}
}