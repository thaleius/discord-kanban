import { APIEmbedField, ApplicationIntegrationType, EmbedBuilder, InteractionContextType, SlashCommandBuilder as SCB } from "discord.js";
import { BoardWithList, CardWithDetails, ListWithDetails } from "./db";

export const Embed = (title: string, subtitle: string | null = null) => {
  return new EmbedBuilder()
    .setColor(0x7f0100)
    .setTitle(title)
    .setFooter(subtitle ? { text: subtitle } : null)
    .setAuthor({
      name: "NIRU",
      iconURL: "https://tr.rbxcdn.com/180DAY-756b15ab67c3502eff74fb2c23ebcba6/150/150/Image/Webp/noFilter"
    })
}

const formatAssignees = (card: CardWithDetails) => {
  return card.assignments.map(assignment => `<@${assignment.assignee.discordId}>`);
}

export const valueBuilder = (list: ListWithDetails) => {
  return list.cards.map(card => {
    const url = card.url ? card.url : '';
    let value = `[${card.id}] ` + (url ? `[${card.title}](${url})` : card.title);
    if (card.assignments.length > 0) {
      // value += "\n_Assignees:_";
      const assignees = formatAssignees(card);
      value += `\n> ${assignees.join(', ')}`;
    }
    return value;
  }).join('\n');
}

export const SlashCommandBuilder = () => new SCB()
  .setContexts(
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
  )
  .setIntegrationTypes(
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall
  )

export const createBoardEmbed = (board: BoardWithList) => {
  const fields = board.lists.map(list => {
  const field: APIEmbedField = {
    name: list.name,
    value: valueBuilder(list),
    inline: true
  }
  return field;
});

return Embed(board.name).addFields(fields);
}

export const createListEmbed = (list: ListWithDetails) => {
  const embed = Embed(list.name, list.board.name);
  const content = valueBuilder(list);
  if (content) {
    embed.setDescription(content);
  }
  return embed;
}

export const createCardEmbed = (card: CardWithDetails) => {
  const embed = Embed(card.title, card.board.name + ' | ' + card.list.name)
  if (card.url) {
    embed.setURL(card.url);
  }
  const content = [card.content];
  if (card.assignments.length > 0) {
    content.push(`> ${formatAssignees(card).join(', ')}`);
  }
  if (content) {
    embed.setDescription(content.join('\n\n'));
  }
  return embed;
}