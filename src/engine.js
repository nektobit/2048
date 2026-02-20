export const BOARD_SIZE = 4;

export const DIRECTIONS = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 }
};

export function createEmptyBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function createInitialBoard(random = Math.random, size = BOARD_SIZE) {
  let board = createEmptyBoard(size);
  board = addRandomTile(board, random);
  board = addRandomTile(board, random);
  return board;
}

export function getAvailableCells(board) {
  const cells = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board.length; col += 1) {
      if (board[row][col] === 0) cells.push({ row, col });
    }
  }

  return cells;
}

export function addRandomTile(board, random = Math.random) {
  return addRandomTileWithMeta(board, random).board;
}

export function addRandomTileWithMeta(board, random = Math.random) {
  const available = getAvailableCells(board);

  if (!available.length) {
    return { board: cloneBoard(board), spawned: null };
  }

  const nextBoard = cloneBoard(board);
  const target = available[Math.floor(random() * available.length)];
  const value = random() < 0.9 ? 2 : 4;
  nextBoard[target.row][target.col] = value;
  return {
    board: nextBoard,
    spawned: { row: target.row, col: target.col, value }
  };
}

export function moveBoard(board, direction) {
  const vector = DIRECTIONS[direction];

  if (!vector) {
    throw new Error(`Invalid direction: ${direction}`);
  }

  const size = board.length;
  const nextBoard = cloneBoard(board);
  const traversals = buildTraversals(size, vector);
  const mergedTargets = new Set();

  let moved = false;
  let scoreDelta = 0;
  let won = false;

  for (const row of traversals.rows) {
    for (const col of traversals.cols) {
      const value = nextBoard[row][col];
      if (!value) continue;

      const { farthest, next } = findFarthestPosition(nextBoard, { row, col }, vector);

      if (inBounds(size, next)) {
        const nextValue = nextBoard[next.row][next.col];
        const nextKey = `${next.row},${next.col}`;

        if (nextValue === value && !mergedTargets.has(nextKey)) {
          nextBoard[row][col] = 0;
          nextBoard[next.row][next.col] = value * 2;
          mergedTargets.add(nextKey);

          scoreDelta += value * 2;
          moved = true;
          if (value * 2 === 2048) won = true;
          continue;
        }
      }

      if (farthest.row !== row || farthest.col !== col) {
        nextBoard[row][col] = 0;
        nextBoard[farthest.row][farthest.col] = value;
        moved = true;
      }
    }
  }

  return { board: nextBoard, moved, scoreDelta, won };
}

export function applyMove(board, direction, random = Math.random) {
  const movedResult = moveBoard(board, direction);

  if (!movedResult.moved) {
    return { ...movedResult, over: !movesAvailable(board), spawned: null };
  }

  const spawnResult = addRandomTileWithMeta(movedResult.board, random);
  return {
    ...movedResult,
    board: spawnResult.board,
    over: !movesAvailable(spawnResult.board),
    spawned: spawnResult.spawned
  };
}

export function movesAvailable(board) {
  return getAvailableCells(board).length > 0 || matchesAvailable(board);
}

export function matchesAvailable(board) {
  const size = board.length;
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = board[row][col];
      if (!value) continue;

      for (const vector of Object.values(DIRECTIONS)) {
        const next = { row: row + vector.row, col: col + vector.col };
        if (!inBounds(size, next)) continue;
        if (board[next.row][next.col] === value) return true;
      }
    }
  }

  return false;
}

function buildTraversals(size, vector) {
  const rows = Array.from({ length: size }, (_, index) => index);
  const cols = Array.from({ length: size }, (_, index) => index);

  if (vector.row === 1) rows.reverse();
  if (vector.col === 1) cols.reverse();

  return { rows, cols };
}

function findFarthestPosition(board, start, vector) {
  let previous = start;
  let current = { row: start.row + vector.row, col: start.col + vector.col };

  while (inBounds(board.length, current) && board[current.row][current.col] === 0) {
    previous = current;
    current = { row: current.row + vector.row, col: current.col + vector.col };
  }

  return { farthest: previous, next: current };
}

function inBounds(size, cell) {
  return cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
}
