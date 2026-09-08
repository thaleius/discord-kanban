import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from "discord.js";

export interface CommandConfig {
  data:
    | SlashCommandBuilder
    | ContextMenuCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void> | void;
}

/** Create a command for your application.
 *
 * @see https://discordjs.guide/creating-your-bot/slash-commands.html#individual-command-files
 */
export const createCommand = (commandConfig: CommandConfig) => commandConfig;