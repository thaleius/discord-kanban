import { ApplicationIntegrationType, EmbedBuilder, InteractionContextType, SlashCommandBuilder as SCB } from "discord.js";
import { ListWithDetails } from "./db";

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

export const valueBuilder = (list: ListWithDetails) => {
  return list.cards.map(card => {
    const url = card.url ? card.url : '';
    let value = `[${card.id}] ` + (url ? `[${card.title}](${url})` : card.title);
    if (card.assignments.length > 0) {
      // value += "\n_Assignees:_";
      const assignees = card.assignments.map(assignment => `<@${assignment.assignee.discordId}>`);
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