import { ReadonlyCollection, User } from 'discord.js';
import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { prisma } from "../lib/prisma";
import { CheckBoardPermission, CheckCardPermission, checkPermission, formatUser, modifiedBy, prepareUserList, sortCardContentHistory } from './utils';

export const ContentInclude = {
  createdBy: true
};

export const BaseListInclude = {
  board: true,
  subscribers: true
} satisfies Prisma.ListInclude;

export const CardInclude = {
  board: true,
  list: {
    include: BaseListInclude
  },
  content: {
    include: ContentInclude
  },
  assignments: {
    include: {
      assignee: true,
      assignedBy: true
    }
  },
  createdBy: true,
  subscribers: true,
  tasks: {
    include: {
      comments: true
    }
  },
  attachments: true,
  comments: true
} satisfies Prisma.CardInclude;

export const ListInclude = {
  cards: {
    where: { deleted: false },
    include: CardInclude
  },
  board: true,
  subscribers: true
} satisfies Prisma.ListInclude; 

export type BoardWithListCard = Prisma.BoardGetPayload<{
  include: {
    cards: {
      where: { deleted: false },
      include: typeof CardInclude
    },
    lists: {
      where: { deleted: false },
      include: typeof ListInclude
    }
  }
}>

export type BoardWithList = Prisma.BoardGetPayload<{
  include: {
    lists: {
      where: { deleted: false },
      include: typeof ListInclude
    },
  }
}>

export type BoardWithCard = Prisma.BoardGetPayload<{
  include: {
    cards: {
      where: { deleted: false },
      include: typeof CardInclude
    },
  }
}>

export type ListWithDetails = Prisma.ListGetPayload<{
  include: typeof ListInclude
}>

export type ListWithBoard = Prisma.ListGetPayload<{
  include: {
    board: true
  }
}>

export type CardWithDetails = Prisma.CardGetPayload<{
  include: typeof CardInclude
}>

export type CardWithAssignments= Prisma.CardGetPayload<{
  include: {
    assignments: {
      include: {
        assignee: true
      }
    }
  }
}>

export type ContentWithDetails = Prisma.ContentHistoryGetPayload<{
  include: typeof ContentInclude
}>

export const getBoards = async () => {
  const boards = await prisma.board.findMany({
    select: {
      id: true,
      name: true,
      ...CheckBoardPermission
    }
  });

  return boards;
}

export const getBoard = async (id: number) => {
  const board = await prisma.board.findUnique({
    relationLoadStrategy: "join",
    where: {
      id: id
    },
    include: {
      ...CheckBoardPermission,
      cards: {
        where: { deleted: false },
        include: {
          assignments: {
            include: {
              assignee: true
            }
          }
        }
      },
      lists: {
        where: { deleted: false },
        include: {
          cards: {
            where: { deleted: false },
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
  });

  return board;
}

export const getList = async (id: number) => {
  const list = await prisma.list.findUnique({
    relationLoadStrategy: "join",
    where: {
      id: id,
      deleted: false
    },
    include: {
      ...ListInclude,
      board: {
        include: CheckBoardPermission
      }
    },
  });

  return list;
}

export const getBoardList = async (boardName: string, listName: string) => {
  return await prisma.list.findFirst({
    where: {
      name: listName,
      board: {
        name: boardName
      }
    },
    select: {
      id: true,
      boardId: true
    }
  })
}

export const getCard = async (cardId: number) => {
  const card = await prisma.card.findUnique({
    relationLoadStrategy: "join",
    where: {
      id: cardId,
      deleted: false
    },
    select: {
      id: true,
      title: true,
      content: {
        include: {
          createdBy: true
        }
      },
      url: true,
      assignments: {
        include: {
          assignee: true
        }
      },
      board: {
        select: {
          ...CheckBoardPermission,
          name: true,
          icon: true,
          lists: {
            where: { deleted: false },
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      listId: true,
      list: {
        where: { deleted: false },
        select: {
          name: true
        }
      },
      createdBy: {
        select: {
          discordId: true
        }
      },
      ...CheckCardPermission
    }
  });

  return card;
}

const upsertUser = (user: User) => {
  return {
    where: { discordId: user.id },
    update: {
      username: user.username,
      displayName: user.displayName
    },
    create: {
      discordId: user.id,
      username: user.username,
      displayName: user.displayName
    },
  }
}

export const newBoard = async (userInfo: User, boardName: string, boardDescription: string | null) => {
  const existingBoard = await prisma.board.findUnique({
    where: { name: boardName },
    include: {
      lists: {
        where: { deleted: false },
        include: ListInclude
      },
      cards: {
        where: { deleted: false },
        include: CardInclude
      }
    }
  });

  if (existingBoard) {
    return {
      boardExists: true,
      board: existingBoard
    }; 
  }

  const [user, newBoard] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txBoard = await tx.board.create({
      data: {
        name: boardName,
        description: boardDescription,
        owner: { connect: { id: txUser.id } },
        createdBy: { connect: { id: txUser.id } },
        modifiedBy: { connect: { id: txUser.id } },
      },
      include: {
      lists: {
        where: { deleted: false },
        include: ListInclude
      },
      cards: {
        where: { deleted: false },
        include: CardInclude
      }
    }
    });

    return [txUser, txBoard];
  });

  return {
    boardExists: false,
    board: newBoard
  };
}

export const newList = async (userInfo: User, boardId: number, listName: string, listDescription?: string) => {
  const board = await prisma.board.findUnique({
    where: {
      id: boardId
    },
    select: {
      ...CheckBoardPermission,
      name: true
    }
  });
  if (!board) {
    return {
      error: `A Board with the ID \`${boardId}\` does not exist.`
    }; 
  }

  if (!checkPermission('list', userInfo, board)) {
    return {
      error: `You are not permitted to create a new List for \`${board.name}\`.`
    };
  }

  const existingList = await prisma.list.findFirst({
    where: {
      name: listName,
      deleted: false,
      board: {
        id: boardId
      }
    },
    include: {
      ...ListInclude,
      board: {
        include: {
          cards: {
            where: { deleted: false },
            include: {
              assignments: {
                include: {
                  assignee: true
                }
              }
            }
          },
          lists: {
            where: { deleted: false },
            include: {
              cards: {
                where: { deleted: false },
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
      }
    }
  });
  if (existingList) {
    return {
      error: `A List with the name \`${listName}\` already exists on the Board \`${existingList.board.name}\`.`,
      list: existingList
    }; 
  }

  const [user, newList] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txList = await tx.list.create({
      data: {
        name: listName,
        description: listDescription,
        board: {
          connect: {
            id: boardId
          }
        },
        createdBy: { connect: { id: txUser.id } },
        modifiedBy: { connect: { id: txUser.id } },
      },
      include: {
        ...ListInclude,
        board: {
          include: {
            cards: {
              where: { deleted: false },
              include: {
                assignments: {
                  include: {
                    assignee: true
                  }
                }
              }
            },
            lists: {
              where: { deleted: false },
              include: {
                cards: {
                  where: { deleted: false },
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
        }
      }
    });

    return [txUser, txList];
  });

  return {
    list: newList
  };
}

export const newCard = async (userInfo: User, boardId: number, listId: number, cardTitle: string, cardContent: string | null, cardUrl: string | null) => {
  const board = await prisma.board.findUnique({
    where: {
      id: boardId,
    },
    select: {
      ...CheckBoardPermission,
      id: true,
      name: true,
      cards: {
        select: { id: true },
        where: {
          title: cardTitle,
          deleted: false
        }
      }
    }
  });
  if (!board) {
    return {
      error: `The Board does not exist.`
    };
  }

  if (!checkPermission('list', userInfo, board)) {
    return {
      error: `You are not permitted to create a new List for \`${board.name}\`.`
    };
  }

  if (board.cards.length > 0) {
    return {
      error: `A Card with this title already exists on this Board.`
    };
  }

  const list = await prisma.list.findUnique({
    where: {
      id: listId
    },
  });
  if (!list) {
    return {
      error: `The List does not exist.`
    };
  }

  const [user, newCard] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txCard = await tx.card.create({
      data: {
        title: cardTitle,
        content: {
          create: {
            value: cardContent || '',
            createdBy: {
              connectOrCreate: {
                where: { discordId: userInfo.id },
                create: {
                  discordId: userInfo.id,
                  username: userInfo.username,
                  displayName: userInfo.displayName
                }
              }
            }
          }
        },
        url: cardUrl,
        board: {
          connect: {
            id: board.id
          }
        },
        list: {
          connect: {
            id: list.id
          }
        },
        createdBy: { connect: { id: txUser.id } },
        modifiedBy: { connect: { id: txUser.id } },
      },
      include: {
        board: true,
        list: {
          include: {
            board: true,
            cards: {
              where: { deleted: false },
              include: {
                assignments: {
                  include: {
                    assignee: true
                  }
                }
              }
            }
          }
        },
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
    });

    return [txUser, txCard];
  });

  return {
    card: newCard
  };
}

export const editBoard = async (userInfo: User, boardId: number, { name, icon }: { name?: string, icon?: string}) => {
  const targetBoard = await getBoard(boardId);
  if (!targetBoard) {
    return {
      error: 'The Board does not exist.'
    }
  }

  const data = {} as Record<'name' | 'icon', string>;

  if (name && name !== targetBoard.name) {
    data['name'] = name;
  }
  if (icon && icon !== targetBoard.icon) {
    data['icon'] = icon;
  }

  const [user, board] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txBoard = await tx.board.update({
      where: {
        id: boardId
      },
      data: {
        ...data,
        modifiedBy: { connect: { id: txUser.id } }
      },
      include: {
        lists: {
          where: { deleted: false },
          include: ListInclude
        },
        cards: {
          where: { deleted: false },
          include: CardInclude
        }
      }
    });
    return [txUser, txBoard];
  });

  return {
    board
  }
}

export const editList = async (userInfo: User, listId: number, property: "name" | "description", newValue: string) => {
  const targetList = await getList(listId);
  if (!targetList) {
    return {
      error: `The List does not exist.`
    };
  }
  if (!checkPermission('list', userInfo, targetList.board)) {
    return {
      error: `You are not permitted to edit Lists of \`${targetList.board.name}\`.`
    };
  }

  const data: Record<string, string> = {};
  data[property] = newValue;

  const [user, list] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txList = await tx.list.update({
      where: {
        id: listId
      },
      data: {
        ...data,
        modifiedBy: { connect: { id: txUser.id } }
      },
      include: ListInclude
    });
    return [txUser, txList];
  });

  return {
    property, value: list[property], list
  }
}

export const editCard = async (userInfo: User, cardId: number, values: {
  title?: string,
  content?: string,
  url?: string,
  assignees?: ReadonlyCollection<string, User> | null,
  cardManager?: ReadonlyCollection<string, User> | null
}) => {
  const targetCard = await getCard(cardId);
  if (!targetCard) {
    return {
      error: 'The Card does not exist.'
    };
  }
  if (!checkPermission('card', userInfo, targetCard.board, targetCard)) {
    return {
      error: `You are not permitted to edit Cards of \`${targetCard.board.name}\`.`
    };
  }

  if (values.assignees !== undefined) {
    const currentAssignees = targetCard.assignments.map(assignment => assignment.assignee.discordId);

    for (const id of currentAssignees) {
      if (!values.assignees?.has(id)) {
        await cardUnassign(cardId, id);
      }
    }
    
    if (values.assignees) {
      for (const [id, assignee] of values.assignees) {
        if (!currentAssignees.includes(id)) {
          await cardAssign(formatUser(userInfo), cardId, formatUser(assignee))
        }
      }
    }
  }

  const { add: addCardManager, remove: removeCardManager } = prepareUserList(
    targetCard.permittedUsers.map(user => user.discordId),
    values.cardManager
  )

  const [user, card] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const query: Prisma.CardUpdateArgs = {
      where: {
        id: cardId
      },
      data: {
        modifiedBy: { connect: { id: txUser.id } }
      },
      include: CardInclude
    }

    await tx.card.update({
      where: { id: cardId },
      data: {
        permittedUsers: {
          deleteMany: {
            discordId: {
              in: removeCardManager
            }
          }
        },
        modifiedBy: { connect: { id: txUser.id } }
      }
    });
    
    await Promise.all(
      addCardManager.map((manager) =>
        tx.card.update({
          where: { id: cardId },
          data: {
            permittedUsers: {
              connectOrCreate: {
                where: { discordId: manager.id },
                create: {
                  discordId: manager.id,
                  username: manager.username,
                  displayName: manager.displayName
                },
              },
            },
            modifiedBy: {
              connectOrCreate: {
                where: { discordId: userInfo.id },
                create: {
                  discordId: userInfo.id,
                  username: userInfo.username,
                  displayName: userInfo.displayName
                }
              }
            }
          },
        })
      )
    );

    if (values.title) {
      query.data.title = values.title;
    }

    if (typeof values.content === 'string' && values.content !== sortCardContentHistory(targetCard.content)[0].value) {
      query.data.content = {
        create: {
          value: values.content,
          createdBy: {
            connectOrCreate: {
              where: { discordId: userInfo.id },
              create: {
                discordId: userInfo.id,
                username: userInfo.username,
                displayName: userInfo.displayName
              }
            }
          }
        }
      }
    }

    if (values.url) {
      query.data.url = values.url;
    }

    const txCard = await tx.card.update(query) as CardWithDetails;
    return [txUser, txCard];
  });

  return {
    card
  };
}

export const cardAssign = async (assigner: User | {
  id: string, username: string | null, displayName: string | null
}, cardId: number, assignee: User | {
  id: string, username: string | null, displayName: string | null
}) => {
  const card = await prisma.card.findFirst({
    where: {
      id: cardId
    },
    select: {
      id: true,
      assignments: {
        select: {
          card: {
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
          },
          assignee: {
            select: {
              discordId: true
            }
          }
        }
      }
    }
  });

  if (!card) return { error: "Card does not exist." };

  const existingAssignment = card.assignments.find(assignment => assignment.assignee.discordId === assignee.id);
  if (existingAssignment) {
    return { error: "User is already assigned to this Card.", assignment: existingAssignment }
  }

  const assignment = await prisma.assignment.create({
    data: {
      card: {
        connect: { id: card.id },
      },
      assignee: {
        connectOrCreate: {
          where: { discordId: assignee.id },
          create: {
            discordId: assignee.id,
            username: assignee.username,
            displayName: assignee.displayName
          },
        },
      },
      assignedBy: {
        connectOrCreate: {
          where: { discordId: assigner.id },
          create: {
            discordId: assigner.id,
            username: assigner.username,
            displayName: assigner.displayName
          },
        },
      },
    },
    include: {
      card: {
        include: CardInclude
      }
    }
  });

  return {
    assignment
  };
}

export const cardUnassign = async (cardId: number, discordId: string) => {
  const user = await prisma.user.findUnique({
    where: { discordId: discordId },
    select: { id: true }
  });
  if (!user) return { error: `User <@${discordId}> does not exist in the database.` }

  const targetAssignment = await prisma.assignment.findUnique({
    where: {
      assigneeId_cardId: {
        cardId: cardId,
        assigneeId: user.id
      }
    },
    select: {
      id: true
    }
  });

  if (!targetAssignment) return { error: `<@${discordId}> is not assigned to this Card.` };

  await prisma.assignment.delete({
    where: { id: targetAssignment.id }
  });

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: CardInclude
  });

  if (!card) return { error: `Card with ID \`${cardId}\` does not exist.` }

  return {
    card: card
  };
}

export const moveCard = async (userInfo: User, cardId: number, targetListId: number) => {
  await prisma.user.upsert(upsertUser(userInfo));

  const targetCard = await prisma.card.findFirst({
    where: {
      id: cardId
    },
    select: {
      id: true,
      boardId: true,
      list: {
        select: { name: true }
      }
    },
  });

  if (!targetCard) {
    return {
      error: 'Card does not exist.'
    };
  }

  const previousList = targetCard.list.name;

  const targetList = await prisma.list.findFirst({
    where: {
      id: targetListId,
      boardId: targetCard.boardId
    },
    select: { id: true }
  });

  if (!targetList) {
    return {
      error: 'Target List does not exist.'
    }
  }

  const card = await prisma.card.update({
    where: {
      id: targetCard.id
    },
    data: {
      list: {
        connect: {
          id: targetList.id
        }
      }
    },
    include: {
      ...CardInclude,
      board: {
        include: {
          lists: {
            include: ListInclude
          },
          cards: {
            include: CardInclude
          }
        }
      },
    }
  });

  return {
    previousList,
    card
  }
}

export const getCardHistory = async (cardId: number) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: CardInclude
  });
  if (!card) return { error: `Card with the ID \`${cardId}\` does not exist.` }

  return {
    card
  }
}

export const deleteList = async (userInfo: User, listId: number, listName: string) => {
  const list = await prisma.list.update({
    where: { id: listId, name: listName, deleted: false },
    data: {
      deleted: true,
      modifiedBy: modifiedBy(userInfo)
    },
    select: {
      board: {
        include: {
          cards: {
            where: { deleted: false },
            include: {
              assignments: true
            }
          },
          lists: {
            where: { deleted: false },
            include: {
              cards: {
                where: { deleted: false },
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
      }
    }
  });

  return list;
}

export const deleteCard = async (userInfo: User, cardId: number, cardTitle: string) => {
  const card = await prisma.card.update({
    where: { id: cardId, title: cardTitle, deleted: false },
    data: {
      deleted: true,
      modifiedBy: modifiedBy(userInfo)
    },
    select: {
      board: {
        include: {
          cards: {
            where: { deleted: false },
            include: {
              assignments: true
            }
          },
          lists: {
            where: { deleted: false },
            include: {
              cards: {
                where: { deleted: false },
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
      },
      list: {
        include: {
          board: true,
          cards: {
            where: { deleted: false },
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
  });

  return card;
}

export const boardPerms = async (userInfo: User, boardId: number, perms: {
  boardViewer?: ReadonlyCollection<string, User> | null,
  boardManager?: ReadonlyCollection<string, User> | null,
  listManager?: ReadonlyCollection<string, User> | null,
  cardManager?: ReadonlyCollection<string, User> | null
}) => {
  const board = await getBoard(boardId);
  if (!board) {
    return {
      error: 'The Board does not exist'
    }
  }

  for (const type in perms) {
    const currentUsers =
      type === 'boardViewer'
      ? board.boardViewer
      : type === 'boardManager'
        ? board.boardManager
        : type === 'listManager'
          ? board.listManager
          : board.cardManager;

    const { add: addManager, remove: removeManager } = prepareUserList(
      currentUsers.map(user => user.discordId),
      perms[type as keyof typeof perms]
    )

    await prisma.board.update({
      where: { id: boardId },
      data: {
        [type]: {
          deleteMany: {
            discordId: {
              in: removeManager
            }
          }
        },
        modifiedBy: modifiedBy(userInfo)
      }
    });
    
    await Promise.all(
      addManager.map((manager) =>
        prisma.board.update({
          where: { id: boardId },
          data: {
            [type]: {
              connectOrCreate: {
                where: { discordId: manager.id },
                create: {
                  discordId: manager.id,
                  username: manager.username,
                  displayName: manager.displayName
                },
              },
            },
            modifiedBy: modifiedBy(userInfo)
          }
        })
      )
    );
  }
}