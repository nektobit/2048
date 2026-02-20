import {
  BOARD_SIZE,
  applyMove,
  cloneBoard,
  createInitialBoard,
  createEmptyBoard
} from "./engine.js";
import { signal, computed, effect, batch, untracked } from "./signals.js";

const STORAGE_KEYS = {
  bestScore: "retrowave-2048-best-score",
  gameState: "retrowave-2048-game-state"
};

function readBestScore() {
  const raw = localStorage.getItem(STORAGE_KEYS.bestScore);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function readSavedGame() {
  const raw = localStorage.getItem(STORAGE_KEYS.gameState);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.board) || parsed.board.length !== BOARD_SIZE) {
      return null;
    }

    return {
      board: parsed.board.map((row) => row.slice()),
      score: Number.isFinite(parsed.score) ? parsed.score : 0,
      status: parsed.status === "won" || parsed.status === "over" ? parsed.status : "playing"
    };
  } catch {
    return null;
  }
}

export function createGameStore(random = Math.random) {
  const restored = readSavedGame();
  const board = signal(restored?.board ?? createInitialBoard(random));
  const score = signal(restored?.score ?? 0);
  const bestScore = signal(readBestScore());
  const gameStatus = signal(restored?.status ?? "playing");
  const lastMoveMeta = signal(null);

  const hasWon = computed(() => gameStatus() === "won");
  const isGameOver = computed(() => gameStatus() === "over");
  const isTerminated = computed(() => hasWon() || isGameOver());

  effect(() => {
    const value = bestScore();
    untracked(() => localStorage.setItem(STORAGE_KEYS.bestScore, String(value)));
  });

  effect(() => {
    const snapshot = {
      board: board(),
      score: score(),
      status: gameStatus()
    };

    untracked(() => {
      if (snapshot.status === "over") {
        localStorage.removeItem(STORAGE_KEYS.gameState);
      } else {
        localStorage.setItem(STORAGE_KEYS.gameState, JSON.stringify(snapshot));
      }
    });
  });

  function newGame() {
    batch(() => {
      board(createInitialBoard(random));
      score(0);
      gameStatus("playing");
      lastMoveMeta(null);
    });
  }

  function keepPlaying() {
    if (gameStatus() !== "won") return;
    gameStatus("playing");
  }

  function move(direction) {
    if (isTerminated()) return false;

    const previousBoard = cloneBoard(board());
    const result = applyMove(previousBoard, direction, random);
    if (!result.moved) return false;

    batch(() => {
      board(result.board);
      score(score() + result.scoreDelta);
      lastMoveMeta({
        direction,
        previousBoard,
        spawned: result.spawned
      });

      if (result.won) {
        gameStatus("won");
      } else if (result.over) {
        gameStatus("over");
      }

      if (score() > bestScore()) {
        bestScore(score());
      }
    });

    return true;
  }

  function restoreFrom(boardInput, scoreInput = 0, statusInput = "playing") {
    batch(() => {
      board(cloneBoard(boardInput ?? createEmptyBoard()));
      score(scoreInput);
      gameStatus(statusInput);
      lastMoveMeta(null);
    });
  }

  return {
    board,
    score,
    bestScore,
    gameStatus,
    lastMoveMeta,
    hasWon,
    isGameOver,
    newGame,
    keepPlaying,
    move,
    restoreFrom
  };
}
