export type Board = number[][];

export type Direction = "up" | "right" | "down" | "left";

export type GameStatus = "playing" | "won" | "over";

export interface Cell {
  row: number;
  col: number;
}

export interface Vector {
  row: number;
  col: number;
}

export interface SpawnedTile extends Cell {
  value: number;
}

export interface MoveResult {
  board: Board;
  moved: boolean;
  scoreDelta: number;
  won: boolean;
}

export interface ApplyMoveResult extends MoveResult {
  over: boolean;
  spawned: SpawnedTile | null;
}

export interface MoveMeta {
  direction: Direction;
  previousBoard: Board;
  spawned: SpawnedTile | null;
}

export interface SavedGameState {
  board: Board;
  score: number;
  status: GameStatus;
}
