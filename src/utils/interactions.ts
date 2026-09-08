import { MessageComponentInteraction, ModalMessageModalSubmitInteraction } from "discord.js";
import { readdir } from "fs/promises";

export type InteractionMap = Map<string, InteractionHandler>;

type InteractionHandler = {
  button: (interaction: MessageComponentInteraction) => Promise<void> | void,
  modal: (interaction: ModalMessageModalSubmitInteraction, interactions: InteractionMap) => Promise<void> | void
}

export const loadInteractions = async () => new Map(
  await Promise.all(
    (await readdir(`src/interactions/`))
      .filter((file) => file.endsWith(".ts"))
      .map(async (file) => [
        file.replace('.ts', ''),
          (await import(`../interactions/${file}`)).default as InteractionHandler
      ] as const)
  )
);