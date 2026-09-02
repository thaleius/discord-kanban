import { User } from 'discord.js';
import 'dotenv/config';
import { Prisma } from '../generated/prisma/client';
import { prisma } from "../lib/prisma";

export const CardInclude = {
  board: true,
  list: true,
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
} satisfies Prisma.Board$cardsArgs['include']; 

export const ListInclude = {
  cards: {
    include: CardInclude
  },
  board: true,
  subscribers: true
} satisfies Prisma.Board$listsArgs['include']; 

export type BoardWithListCard = Prisma.BoardGetPayload<{
  include: {
    cards: {
      include: typeof CardInclude
    },
    lists: {
      include: typeof ListInclude
    }
  }
}>

export type BoardWithList = Prisma.BoardGetPayload<{
  include: {
    lists: {
      include: typeof ListInclude
    },
  }
}>

export type BoardWithCard = Prisma.BoardGetPayload<{
  include: {
    cards: {
      include: typeof CardInclude
    },
  }
}>

export type ListWithDetails = Prisma.ListGetPayload<{
  include: typeof ListInclude
}>

export type CardWithDetails = Prisma.CardGetPayload<{
  include: typeof CardInclude
}>

export const getBoards = async () => {
  const boards = await prisma.board.findMany();

  return boards;
}

export const getBoard = async (name: string): Promise<BoardWithListCard | null> => {
  const board = await prisma.board.findUnique({
    relationLoadStrategy: "join",
    where: {
      name: name
    },
    include: {
      cards: {
        include: CardInclude
      },
      lists: {
        include: ListInclude
      }
    }
  });

  return board;
}

export const getList = async (boardName: string, name: string): Promise<ListWithDetails | null> => {
  const board = await getBoard(boardName);
  if (!board) return null;

  const list = await prisma.list.findUnique({
    relationLoadStrategy: "join",
    where: {
      name_boardId: {
        name: name,
        boardId: board.id
      }
    },
    include: ListInclude
  });

  return list;
}

export const getCard = async (boardName: string, cardId: number): Promise<CardWithDetails | null> => {
  const card = await prisma.card.findUnique({
    relationLoadStrategy: "join",
    where: {
      id: cardId
    },
    include: CardInclude
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
        include: ListInclude
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
        createdBy: { connect: { id: txUser.id } },
        modifiedBy: { connect: { id: txUser.id } },
      },
      include: {
      lists: {
        include: ListInclude
      },
      cards: {
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

export const newList = async (userInfo: User, boardName: string, listName: string) => {
  const board = await prisma.board.findUnique({
    where: {
      name: boardName
    }
  });
  if (!board) {
    return {
      error: `A Board with the name ${boardName} does not exist.`
    }; 
  }

  const existingList = await prisma.list.findFirst({
    where: {
      name: listName,
      board: {
        name: boardName
      }
    },
    include: ListInclude
  });
  if (existingList) {
    return {
      error: `A List with the name _${listName}_ already exists in the Board _${boardName}_.`,
      list: existingList
    }; 
  }

  const [user, newList] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txList = await tx.list.create({
      data: {
        name: listName,
        board: {
          connect: {
            name: boardName
          }
        },
        createdBy: { connect: { id: txUser.id } },
        modifiedBy: { connect: { id: txUser.id } },
      },
      include: ListInclude
    });

    return [txUser, txList];
  });

  return {
    list: newList
  };
}

export const newCard = async (userInfo: User, boardName: string, listName: string, cardTitle: string, cardContent: string | null, cardUrl: string | null) => {
  const board = await prisma.board.findUnique({
    where: {
      name: boardName,
    },
    select: {
      id: true,
      cards: {
        select: { id: true },
        where: {
          title: cardTitle
        }
      }
    }
  });
  if (!board) {
    return {
      boardExists: false
    }; 
  }
  if (board.cards.length > 0) {
    return {
      boardExists: true,
      cardExists: true,
    };
  }

  const list = await prisma.list.findFirst({
    where: {
      name: listName,
      board: {
        name: boardName
      }
    },
  });
  if (!list) {
    return {
      boardExists: true,
      listExists: false,
      cardExists: false,
    }; 
  }

  const [user, newCard] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txCard = await tx.card.create({
      data: {
        title: cardTitle,
        content: cardContent || '',
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
      include: CardInclude
    });

    return [txUser, txCard];
  });

  return {
    boardExists: true,
    listExists: true,
    cardExists: false,
    card: newCard
  };
}

export const editBoard = async (userInfo: User, boardName: string, property: "name" | "description", newValue: string) => {
  const data: Record<string, string> = {};
  data[property] = newValue;

  const [user, board] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txBoard = await tx.board.update({
      where: {
        name: boardName
      },
      data: {
        ...data,
        modifiedBy: { connect: { id: txUser.id } }
      },
      include: {
        lists: {
          include: ListInclude
        }
      }
    });
    return [txUser, txBoard];
  });

  return {
    success: board[property] === newValue,
    property, value: board[property],
    board
  }
}

export const editList = async (userInfo: User, boardName: string, listName: string, property: "name" | "description", newValue: string) => {
  const data: Record<string, string> = {};
  data[property] = newValue;

  const board = await getBoard(boardName);
  if (!board) {
    return {
      error: "Board does not exist."
    }
  }

  const [user, list] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txList = await tx.list.update({
      where: {
        name_boardId: {
          name: listName,
          boardId: board.id
        }
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

export const editCard = async (userInfo: User, boardName: string, cardId: number, property: "title" | "content" | "url", newValue: string) => {
  const data: Record<string, string> = {};
  data[property] = newValue;

  const board = await getBoard(boardName);
  if (!board) {
    return {
      error: "Board does not exist."
    }
  }

  const [user, card] = await prisma.$transaction(async (tx) => {
    const txUser = await tx.user.upsert(upsertUser(userInfo));

    const txCard = await tx.card.update({
      where: {
        id: cardId
      },
      data: {
        ...data,
        modifiedBy: { connect: { id: txUser.id } }
      },
      include: CardInclude
    });
    return [txUser, txCard];
  });

  return {
    property, value: card[property], card
  }
}

export const cardAssign = async (assigner: User, cardId: number, assignee: User) => {
  const card = await prisma.card.findFirst({
    where: {
      id: cardId
    },
    select: {
      id: true,
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
  });

  if (!card) return { error: "Card does not exist." };

  if (card.assignments.some(assignment => assignment.assignee.discordId === assignee.id)) {
    return { error: "User is already assigned to this Card." }
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

export const moveCard = async (userInfo: User, boardName: string, cardId: number, targetListName: string) => {
  await prisma.user.upsert(upsertUser(userInfo));

  const targetCard = await prisma.card.findFirst({
    where: {
      id: cardId
    },
    select: {
      id: true,
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
      name: targetListName,
      board: {
        name: boardName
      }
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
    include: CardInclude
  });

  return {
    previousList,
    card
  }
}