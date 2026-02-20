import type { ApplyMoveResult, Board, Cell, Direction, MoveResult, SpawnedTile, Vector } from "./types";

export const BOARD_SIZE = 4;

const DIRECTION_VECTORS: Record<Direction, Vector> = {
  up: { row: -1, col: 0 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 }
};

export class GameEngine {
  public readonly size: number;
  private readonly random: () => number;

  public constructor(size = BOARD_SIZE, random: () => number = Math.random) {
    this.size = size;
    this.random = random;
  }

  public createEmptyBoard(size = this.size): Board {
    return Array.from({ length: size }, () => Array(size).fill(0));
  }

  public cloneBoard(board: Board): Board {
    return board.map((row) => row.slice());
  }

  public createInitialBoard(): Board {
    let board = this.createEmptyBoard();
    board = this.addRandomTile(board);
    board = this.addRandomTile(board);
    return board;
  }

  public getAvailableCells(board: Board): Cell[] {
    const cells: Cell[] = [];

    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board.length; col += 1) {
        if (board[row][col] === 0) cells.push({ row, col });
      }
    }

    return cells;
  }

  public addRandomTile(board: Board): Board {
    return this.addRandomTileWithMeta(board).board;
  }

  public addRandomTileWithMeta(board: Board): { board: Board; spawned: SpawnedTile | null } {
    const available = this.getAvailableCells(board);

    if (!available.length) {
      return { board: this.cloneBoard(board), spawned: null };
    }

    const nextBoard = this.cloneBoard(board);
    const target = available[Math.floor(this.random() * available.length)];
    const value = this.random() < 0.9 ? 2 : 4;
    nextBoard[target.row][target.col] = value;

    return {
      board: nextBoard,
      spawned: { row: target.row, col: target.col, value }
    };
  }

  public moveBoard(board: Board, direction: Direction): MoveResult {
    const vector = DIRECTION_VECTORS[direction];
    const size = board.length;
    const nextBoard = this.cloneBoard(board);
    const traversals = this.buildTraversals(size, vector);
    const mergedTargets = new Set<string>();

    let moved = false;
    let scoreDelta = 0;
    let won = false;

    for (const row of traversals.rows) {
      for (const col of traversals.cols) {
        const value = nextBoard[row][col];
        if (!value) continue;

        const { farthest, next } = this.findFarthestPosition(nextBoard, { row, col }, vector);

        if (this.inBounds(size, next)) {
          const nextValue = nextBoard[next.row][next.col];
          const mergeTarget = `${next.row},${next.col}`;

          if (nextValue === value && !mergedTargets.has(mergeTarget)) {
            nextBoard[row][col] = 0;
            nextBoard[next.row][next.col] = value * 2;
            mergedTargets.add(mergeTarget);

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

  public applyMove(board: Board, direction: Direction): ApplyMoveResult {
    const moveResult = this.moveBoard(board, direction);

    if (!moveResult.moved) {
      return {
        ...moveResult,
        over: !this.movesAvailable(board),
        spawned: null
      };
    }

    const spawnResult = this.addRandomTileWithMeta(moveResult.board);
    return {
      ...moveResult,
      board: spawnResult.board,
      over: !this.movesAvailable(spawnResult.board),
      spawned: spawnResult.spawned
    };
  }

  public movesAvailable(board: Board): boolean {
    return this.getAvailableCells(board).length > 0 || this.matchesAvailable(board);
  }

  private matchesAvailable(board: Board): boolean {
    const size = board.length;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const value = board[row][col];
        if (!value) continue;

        for (const vector of Object.values(DIRECTION_VECTORS)) {
          const next: Cell = { row: row + vector.row, col: col + vector.col };
          if (!this.inBounds(size, next)) continue;
          if (board[next.row][next.col] === value) return true;
        }
      }
    }

    return false;
  }

  private buildTraversals(size: number, vector: Vector): { rows: number[]; cols: number[] } {
    const rows = Array.from({ length: size }, (_, index) => index);
    const cols = Array.from({ length: size }, (_, index) => index);

    if (vector.row === 1) rows.reverse();
    if (vector.col === 1) cols.reverse();

    return { rows, cols };
  }

  private findFarthestPosition(board: Board, start: Cell, vector: Vector): { farthest: Cell; next: Cell } {
    let previous = start;
    let current: Cell = { row: start.row + vector.row, col: start.col + vector.col };

    while (this.inBounds(board.length, current) && board[current.row][current.col] === 0) {
      previous = current;
      current = { row: current.row + vector.row, col: current.col + vector.col };
    }

    return { farthest: previous, next: current };
  }

  private inBounds(size: number, cell: Cell): boolean {
    return cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
  }
}
