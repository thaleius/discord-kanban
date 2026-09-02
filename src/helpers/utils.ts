import { ActionRowBuilder, APIEmbedField, ApplicationIntegrationType, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionContextType, InteractionEditReplyOptions, InteractionReplyOptions, SlashCommandBuilder as SCB, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, User } from "discord.js";
import { EMBED } from "../../config.json";
import { Assignment, Board, Card, ContentHistory, List, Prisma } from "../generated/prisma/client";

export const Embed = (title: string, subtitle: string | null = null) => {
  return new EmbedBuilder()
    .setColor(`#${EMBED.COLOR ? EMBED.COLOR.replaceAll('#', '') : '003153'}`)
    .setTitle(title)
    .setFooter(subtitle ? { text: subtitle } : null)
    .setAuthor({
      name: EMBED.NAME,
      iconURL: EMBED.ICON
    })
}

export const formatAssignees = (assignments: (Assignment & Prisma.AssignmentGetPayload<{
  include: {
    assignee: true
  }
}>)[]) => {
  return '👤 ' + assignments.map(assignment => `<@${assignment.assignee.discordId}>`).join(', ');
}

export const valueBuilder = (list: List & Prisma.ListGetPayload<{
  include: {
    cards: {
      include: {
        assignments: {
          include: {
            assignee: true
          }
        }
      }
    }
  }
}>) => {
  return list.cards.map(card => {
    const url = card.url ? card.url : '';
    let value = `[${card.id}] ` + (url ? `[${card.title}](${url})` : card.title);
    if (card.assignments.length > 0) {
      // value += "\n_Assignees:_";
      value += '\n' + formatAssignees(card.assignments);
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

export const sortCardContentHistory = (content: (ContentHistory & Prisma.ContentHistoryGetPayload<{
  include: {
    createdBy: true
  }
}>)[]) => content.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

const createListButtons = (lists: List[]) => {
  return lists.map(list =>
    new ButtonBuilder()
      .setCustomId('list_' + list.id)
      .setLabel(list.name)
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary)
  );
}

const createCardSelect = (cards: Card[]) => {
  if (cards.length > 0) {
    const cardSelect = new StringSelectMenuBuilder()
      .setCustomId('card')
      .setPlaceholder('Select a card.')
      .addOptions(
        ...cards.map(card => new StringSelectMenuOptionBuilder()
            .setLabel(card.title)
            .setValue(card.id.toString())
            .setEmoji('📝')
        )
      )
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(cardSelect);
  }

  return null;
}

const createCardEditButtons = (card: Card & Prisma.CardGetPayload<{
  include: {
    board: true,
    list: true,
    content: {
      include: {
        createdBy: true
      }
    },
    assignments: {
      include: {
        assignee: true
      }
    }
  }
}>) => {
  return [
    new ButtonBuilder()
      .setCustomId(`card-edit_${card.board.name}_${card.id}_title`)
      .setLabel('Title')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`card-edit_${card.board.name}_${card.id}_content`)
      .setLabel('Content')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`card-edit_${card.board.name}_${card.id}_url`)
      .setLabel('URL')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary)
  ]
}

export const createBoardEmbed = (board: Board & Prisma.BoardGetPayload<{
  include: {
    lists: {
      include: {
        cards: {
          include: {
            assignments: {
              include: {
                assignee: true
              }
            }
          }
        }
      }
    }
  }
}>) => {
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

export const createListEmbed = (list: List & Prisma.ListGetPayload<{
  include: {
    board: true,
    cards: {
      include: {
        assignments: {
          include: {
            assignee: true
          }
        }
      }
    }
  }
}>) => {
  const embed = Embed(list.name, list.board.name);
  const content = valueBuilder(list);
  if (content) {
    embed.setDescription(content);
  }
  return embed;
}

export const createCardEmbed = (card: Card & Prisma.CardGetPayload<{
  include: {
    board: true,
    list: true,
    content: {
      include: {
        createdBy: true
      }
    },
    assignments: {
      include: {
        assignee: true
      }
    }
  }
}>, history: boolean = false) => {
  const embed = Embed(card.title + (history ? ' [History]' : ''), card.board.name + ' | ' + card.list.name)
  if (card.url) {
    embed.setURL(card.url);
  }
  const content = [];
  
  if (history) {
    content.push(sortCardContentHistory(card.content).map(c => `<t:${Math.floor(c.createdAt.getTime()/1000)}:f> by <@${c.createdBy.discordId}>\n> ${c.value || '`EMPTY`'}`).join('\n\n'))
  } else {
    const latestContent = sortCardContentHistory(card.content)[0].value;
    if (latestContent !== '') {
      content.push(latestContent);
    }
  }

  if (card.assignments.length > 0) {
    content.push(formatAssignees(card.assignments));
  }
  if (content.length > 0) {
    embed.setDescription(content.join('\n\n'));
  }
  return embed;
}

export const createBoardReply = (board: Board & Prisma.BoardGetPayload<{
  include: {
    cards: {
      include: {
        assignments: true
      }
    },
    lists: {
      include: {
        cards: {
          include: {
            assignments: true
          }
        }
      }
    }
  }
}>, message?: string | null, noReply?: boolean) => {
  const reply: InteractionReplyOptions & InteractionEditReplyOptions & { withResponse?: boolean } = {
    content: message ?? '',
    embeds: [createBoardEmbed(board)]
  }

  if (!noReply) {
    reply.withResponse = true;
  }
  
  const listButtons = createListButtons(board.lists);
  const cardSelect = createCardSelect(board.cards);

  const moveCardButton = new ButtonBuilder()
    .setCustomId(`board-card-move_${board.id}`)
    .setLabel('Move Card')
    .setStyle(ButtonStyle.Secondary);

  const assignCardButton = new ButtonBuilder()
    .setCustomId(`board-card-assign_${board.id}`)
    .setLabel('Assign/unassign')
    .setStyle(ButtonStyle.Secondary);

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(...listButtons, moveCardButton, assignCardButton)];
  if (cardSelect) components.push(cardSelect);

  reply.components = components;

  return reply;
}

export const createListReply = (list: List & Prisma.ListGetPayload<{
  include: {
    board: true,
    cards: {
      include: {
        assignments: {
          include: {
            assignee: true
          }
        }
      }
    }
  }
}>, message?: string | null, noReply?: boolean) => {
  const reply: InteractionReplyOptions & InteractionEditReplyOptions & { withResponse?: boolean } = {
    content: message ?? '',
    embeds: [createListEmbed(list)]
  }

  if (!noReply) {
    reply.withResponse = true;
  }
  
  const cardSelect = createCardSelect(list.cards);
  const back = new ButtonBuilder()
    .setCustomId('board_' + list.boardId)
    .setEmoji('◀️')
    .setLabel('Back to Board')
    .setStyle(ButtonStyle.Secondary);

  const newCardButton = new ButtonBuilder()
    .setCustomId(`card-new_${list.boardId}_${list.id}`)
    .setLabel('New Card')
    .setStyle(ButtonStyle.Secondary);

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [new ActionRowBuilder<ButtonBuilder>().addComponents(back, newCardButton)];
  if (cardSelect) components.push(cardSelect);

  reply.components = components;

  return reply;
}

export const createCardReply = (card: Card & Prisma.CardGetPayload<{
  include: {
    board: true,
    list: true,
    content: {
      include: {
        createdBy: true
      }
    },
    assignments: {
      include: {
        assignee: true
      }
    }
  }
}>, message?: string | null, noReply?: boolean, history: boolean = false) => {
  const reply: InteractionReplyOptions & InteractionEditReplyOptions & { withResponse?: boolean } = {
    content: message ?? '',
    embeds: [createCardEmbed(card, history)]
  }

  if (!noReply) {
    reply.withResponse = true;
  }
  const back = new ButtonBuilder()
    .setCustomId('list_' + card.listId)
    .setEmoji('◀️')
    .setLabel('Back to List')
    .setStyle(ButtonStyle.Secondary);

  const moveCardButton = new ButtonBuilder()
    .setCustomId(`card-move_${card.id}`)
    .setLabel('Move Card')
    .setStyle(ButtonStyle.Secondary);

  const assignCardButton = new ButtonBuilder()
    .setCustomId(`card-assign_${card.id}`)
    .setLabel('Assign/unassign')
    .setStyle(ButtonStyle.Secondary);

  const historyCardButton = new ButtonBuilder()
    .setCustomId(`card-history_${card.id}`)
    .setLabel('History')
    .setStyle(ButtonStyle.Secondary);

  const components: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(back, assignCardButton, moveCardButton),
    new ActionRowBuilder<ButtonBuilder>().addComponents(...createCardEditButtons(card), historyCardButton)
  ];
  reply.components = components;

  return reply;
}

export const formatUser = (user: User) => {
  return {
    id: user.id,
    username: user.username,
    displayName: user.globalName
  }
}