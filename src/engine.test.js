import { describe, expect, it } from "vitest";
import { moveBoard } from "./engine.js";

describe("2048 merge rules", () => {
  it("simple merge", () => {
    const board = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    const result = moveBoard(board, "left");
    expect(result.board[0]).toEqual([4, 0, 0, 0]);
    expect(result.scoreDelta).toBe(4);
    expect(result.moved).toBe(true);
  });

  it("double tiles in a row", () => {
    const board = [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    const result = moveBoard(board, "left");
    expect(result.board[0]).toEqual([4, 4, 0, 0]);
    expect(result.scoreDelta).toBe(8);
  });

  it("merge across gaps", () => {
    const board = [
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    const result = moveBoard(board, "left");
    expect(result.board[0]).toEqual([4, 0, 0, 0]);
    expect(result.scoreDelta).toBe(4);
  });

  it("prevents double merge in one move", () => {
    const board = [
      [2, 2, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    const result = moveBoard(board, "left");
    expect(result.board[0]).toEqual([4, 4, 0, 0]);
    expect(result.scoreDelta).toBe(4);
  });

  it("reports no move when board stays unchanged", () => {
    const board = [
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 64]
    ];

    const result = moveBoard(board, "left");
    expect(result.moved).toBe(false);
    expect(result.scoreDelta).toBe(0);
    expect(result.board).toEqual(board);
  });
});
