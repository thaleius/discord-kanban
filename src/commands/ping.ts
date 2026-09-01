import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { createCommand } from "../utils/command";

export default createCommand({
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  async execute(interaction) {
    await interaction.reply({
      content: "Pong!",
      flags: [MessageFlags.Ephemeral] 
    });
  },
});