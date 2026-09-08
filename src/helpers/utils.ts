import { ActionRowBuilder, APIEmbedField, ApplicationIntegrationType, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionContextType, InteractionEditReplyOptions, InteractionReplyOptions, ReadonlyCollection, SlashCommandBuilder as SCB, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, User } from "discord.js";
import { DISCORD, EMBED } from "../../config.json";
import { Board, Card, List, Prisma } from "../generated/prisma/client";

export const Embed = (title: string, icon: string | null, subtitle: string | null = null, footer: string | null = null) => {
  const embed = new EmbedBuilder()
    .setColor(`#${EMBED.COLOR ? EMBED.COLOR.replaceAll('#', '') : '003153'}`)
    .setAuthor({
      name: title,
      iconURL: icon ?? undefined
    })

  if (subtitle) embed.setTitle(subtitle);
  if (footer) embed.setFooter({ text: footer });

  return embed;
}

export const formatAssignees = (assignments: Prisma.AssignmentGetPayload<{
  select: {
    assignee: {
      select: {
        discordId: true
      }
    }
  }
}>[]) => {
  return '👤 ' + assignments.map(assignment => `<@${assignment.assignee.discordId}>`).join(', ');
}

export const valueBuilder = (list: Prisma.ListGetPayload<{
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

export const sortCardContentHistory = (content: Prisma.ContentHistoryGetPayload<{
  select: {
    value: true,
    createdBy: {
      select: {
        discordId: true
      }
    },
    createdAt: true
  }
}>[]) => content.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

const createListSelect = (lists: List[]) => {
  if (lists.length > 0) {
    const listSelect = new StringSelectMenuBuilder()
      .setCustomId('list')
      .setPlaceholder('Select a List.')
      .addOptions(
        ...lists.map(list => new StringSelectMenuOptionBuilder()
            .setLabel(list.name)
            .setValue(list.id.toString())
            .setEmoji('📋')
        )
      )
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(listSelect);
  }

  return null;
}

const createCardSelect = (cards: Card[]) => {
  if (cards.length > 0) {
    const cardSelect = new StringSelectMenuBuilder()
      .setCustomId('card')
      .setPlaceholder('Select a Card.')
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

export const createBoardEmbed = (board: Prisma.BoardGetPayload<{
  include: {
    lists: {
      include: {
        cards: {
          include: {
            assignments: {
              include: {
                assignee: {
                  select: {
                    discordId: true
                  }
                }
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

return Embed(board.name, board.icon).addFields(fields);
}

export const createListEmbed = (list: Prisma.ListGetPayload<{
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
  const embed = Embed(list.board.name, list.board.icon, list.name);
  const content = valueBuilder(list);
  if (content) {
    embed.setDescription(content);
  }
  return embed;
}

export const createCardEmbed = (card: Prisma.CardGetPayload<{
  select: {
    title: true,
    content: {
      select: {
        value: true,
        createdBy: {
          select: {
            discordId: true
          }
        },
        createdAt: true
      }
    },
    url: true,
    assignments: {
      select: {
        assignee: {
          select: {
            discordId: true
          }
        }
      }
    },
    board: {
      select: {
        name: true,
        icon: true
      }
    },
    list: {
      select: {
        name: true
      }
    }
  }
}>, history: boolean = false) => {
  const embed = Embed(card.board.name, card.board.icon, card.title + (history ? ' [History]' : ''), card.list.name)
  if (card.url) {
    embed.setURL(card.url);
  }
  const content = [];
  
  if (history) {
    content.push(sortCardContentHistory(card.content).map(c => `<t:${Math.floor(c.createdAt.getTime()/1000)}:f> by <@${c.createdBy.discordId}>\n${c.value || '`EMPTY`'}`).join('\n\n'))
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
            assignments: {
              select: {
                assignee: {
                  select: {
                    discordId: true
                  }
                }
              }
            }
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
  
  const listSelect = createListSelect(board.lists);
  const cardSelect = createCardSelect(board.cards);

  const newListButton = new ButtonBuilder()
    .setCustomId(`list-new_${board.id}`)
    .setLabel('New List')
    .setStyle(ButtonStyle.Success);

  const deleteListButton = new ButtonBuilder()
    .setCustomId(`board-list-delete_${board.id}`)
    .setLabel('Delete a List')
    .setStyle(ButtonStyle.Danger);

  const newCardButton = new ButtonBuilder()
    .setCustomId(`board-card-new_${board.id}`)
    .setLabel('New Card')
    .setStyle(ButtonStyle.Success);

  const moveCardButton = new ButtonBuilder()
    .setCustomId(`board-card-move_${board.id}`)
    .setLabel('Move Card')
    .setStyle(ButtonStyle.Secondary);

  const deleteCardButton = new ButtonBuilder()
    .setCustomId(`board-card-delete_${board.id}`)
    .setLabel('Delete a Card')
    .setStyle(ButtonStyle.Danger);

  const settingsButton = new ButtonBuilder()
    .setCustomId(`board-settings_${board.id}`)
    .setLabel('Settings')
    .setStyle(ButtonStyle.Primary);

  const permissionsButton = new ButtonBuilder()
    .setCustomId(`board-permissions_${board.id}`)
    .setLabel('Permissions')
    .setStyle(ButtonStyle.Primary);

  const cardButtons = [newCardButton];
  if (board.cards.length > 0) {
    cardButtons.push(deleteCardButton, moveCardButton);
  }

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...[
        newListButton,
        board.lists.length > 0 ? deleteListButton : null,
        settingsButton,
        permissionsButton
      ].filter(button => button !== null)
    ),
    // new ActionRowBuilder<ButtonBuilder>().addComponents(...cardButtons)
  ];
  if (listSelect) components.push(listSelect);
  if (cardSelect) components.push(cardSelect);

  reply.components = components;

  return reply;
}

export const createListReply = (list: Prisma.ListGetPayload<{
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

  const deleteListButton = new ButtonBuilder()
    .setCustomId(`list-delete_${list.id}`)
    .setLabel('Delete List')
    .setStyle(ButtonStyle.Danger);
    
  const newCardButton = new ButtonBuilder()
    .setCustomId(`list-card-new_${list.boardId}_${list.id}`)
    .setLabel('New Card')
    .setStyle(ButtonStyle.Success);

  const deleteCardButton = new ButtonBuilder()
    .setCustomId(`list-card-delete_${list.id}`)
    .setLabel('Delete a Card')
    .setStyle(ButtonStyle.Danger);

  const cardButtons = [newCardButton];
  if (list.cards.length > 0) cardButtons.push(deleteCardButton);

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(back, deleteListButton),
    new ActionRowBuilder<ButtonBuilder>().addComponents(...cardButtons)
  ];
  if (cardSelect) components.push(cardSelect);

  reply.components = components;

  return reply;
}

export const createCardReply = (card: Prisma.CardGetPayload<{
  select: {
    id: true,
    title: true,
    content: {
      select: {
        value: true,
        createdBy: {
          select: {
            discordId: true
          }
        },
        createdAt: true
      }
    },
    url: true,
    assignments: {
      select: {
        assignee: true
      }
    },
    listId: true,
    board: {
      select: {
        name: true,
        icon: true
      }
    },
    list: {
      select: {
        name: true
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

  const deleteCardButton = new ButtonBuilder()
    .setCustomId(`card-delete_${card.id}`)
    .setLabel('Delete Card')
    .setStyle(ButtonStyle.Danger);

  const moveCardButton = new ButtonBuilder()
    .setCustomId(`card-move_${card.id}`)
    .setLabel('Move Card')
    .setStyle(ButtonStyle.Secondary);

  const settingsButton = new ButtonBuilder()
    .setCustomId(`card-settings_${card.id}`)
    .setLabel('Settings')
    .setStyle(ButtonStyle.Primary);

  const historyCardButton = new ButtonBuilder()
    .setCustomId(`card-history_${card.id}`)
    .setLabel('History')
    .setStyle(ButtonStyle.Secondary);

  const components: ActionRowBuilder<ButtonBuilder>[] = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(back, deleteCardButton, settingsButton, moveCardButton, historyCardButton)
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

export const CheckBoardPermission = {
  owner: {
    select: {
      discordId: true
    }
  },
  boardManager: {
    select: {
      discordId: true
    }
  },
  boardViewer: {
    select: {
      discordId: true
    }
  },
  listManager: {
    select: {
      discordId: true
    }
  },
  cardManager: {
    select: {
      discordId: true
    }
  }
}
export const CheckCardPermission = {
  permittedUsers: {
    select: {
      discordId: true
    }
  },
  permittedRoles: {
    select: {
      discordId: true
    }
  }
}

type PermType = 'board' | 'list' | 'card' | 'view-board';
export const checkPermission = (type: PermType, userInfo: User, board: Prisma.BoardGetPayload<{
  select: typeof CheckBoardPermission
}>, card?: Prisma.CardGetPayload<{
    select: typeof CheckCardPermission
  }>) => {
  if (
    DISCORD.ADMIN_IDs.includes(userInfo.id) ||
    userInfo.id === board.owner.discordId ||
    board.boardManager.find(user => user.discordId === userInfo.id)
  ) {
    return true;
  }

  if (type === 'view-board') {
    if (
      board.listManager.find(user => user.discordId === userInfo.id) ||
      board.cardManager.find(user => user.discordId === userInfo.id) ||
      board.boardViewer.find(user => user.discordId === userInfo.id)
    ) {
      return true;
    }
  } else if (type === 'list') {
    if (
      board.listManager.find(user => user.discordId === userInfo.id)
    ) {
      return true;
    }
  } else if (type === 'card') {
    if (
      board.cardManager.find(user => user.discordId === userInfo.id)
    ) {
      return true;
    }

    if (
      card && card.permittedUsers.find(user => user.discordId === userInfo.id)
    ) {
      return true;
    } 
  }

  return false;
}

export const prepareUserList = (currentUsers: string[], newUsers?: ReadonlyCollection<string, User> | null) => {
  const removeUsers = [] as string[];
  const addUsers = [] as User[];

  for (const id of currentUsers) {
    if (!newUsers?.has(id)) {
      removeUsers.push(id);
    }
  }

  if (newUsers) {
    for (const id of newUsers) {
      if (!currentUsers.includes(id[0])) {
        addUsers.push(id[1]);
      }
    }
  }

  return {
    add: addUsers,
    remove: removeUsers
  }
}

export const modifiedBy = (user: User) => {
  return {
    connectOrCreate: {
      where: { discordId: user.id },
      create: {
        discordId: user.id,
        username: user.username,
        displayName: user.displayName
      }
    }
  }
}