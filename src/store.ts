import { BOARD_SIZE, GameEngine } from "./engine";
import { batch, computed, effect, signal, untracked } from "./signals";
import type { Board, Direction, GameStatus, MoveMeta, SavedGameState } from "./types";

const STORAGE_KEYS = {
  bestScore: "retrowave-2048-best-score",
  gameState: "retrowave-2048-game-state"
} as const;

export class GameStore {
  public readonly engine: GameEngine;

  public readonly board = signal<Board>([]);
  public readonly score = signal(0);
  public readonly bestScore = signal(0);
  public readonly gameStatus = signal<GameStatus>("playing");
  public readonly lastMoveMeta = signal<MoveMeta | null>(null);

  public readonly hasWon = computed(() => this.gameStatus() === "won");
  public readonly isGameOver = computed(() => this.gameStatus() === "over");
  public readonly isTerminated = computed(() => this.hasWon() || this.isGameOver());

  private readonly storage: Storage;

  public constructor(engine = new GameEngine(), storage = window.localStorage) {
    this.engine = engine;
    this.storage = storage;

    const restored = this.readSavedGame();
    this.board(restored?.board ?? this.engine.createInitialBoard());
    this.score(restored?.score ?? 0);
    this.bestScore(this.readBestScore());
    this.gameStatus(restored?.status ?? "playing");

    this.setupPersistenceEffects();
  }

  public newGame(): void {
    batch(() => {
      this.board(this.engine.createInitialBoard());
      this.score(0);
      this.gameStatus("playing");
      this.lastMoveMeta(null);
    });
  }

  public keepPlaying(): void {
    if (this.gameStatus() !== "won") return;
    this.gameStatus("playing");
  }

  public move(direction: Direction): boolean {
    if (this.isTerminated()) return false;

    const previousBoard = this.engine.cloneBoard(this.board());
    const result = this.engine.applyMove(previousBoard, direction);
    if (!result.moved) return false;

    batch(() => {
      const nextScore = this.score() + result.scoreDelta;

      this.board(result.board);
      this.score(nextScore);
      this.lastMoveMeta({
        direction,
        previousBoard,
        spawned: result.spawned
      });

      if (result.won) {
        this.gameStatus("won");
      } else if (result.over) {
        this.gameStatus("over");
      }

      if (nextScore > this.bestScore()) {
        this.bestScore(nextScore);
      }
    });

    return true;
  }

  public restoreFrom(board: Board, score = 0, status: GameStatus = "playing"): void {
    batch(() => {
      this.board(this.engine.cloneBoard(board));
      this.score(score);
      this.gameStatus(status);
      this.lastMoveMeta(null);
    });
  }

  private setupPersistenceEffects(): void {
    effect(() => {
      const value = this.bestScore();
      untracked(() => this.storage.setItem(STORAGE_KEYS.bestScore, String(value)));
    });

    effect(() => {
      const snapshot: SavedGameState = {
        board: this.board(),
        score: this.score(),
        status: this.gameStatus()
      };

      untracked(() => {
        if (snapshot.status === "over") {
          this.storage.removeItem(STORAGE_KEYS.gameState);
          return;
        }

        this.storage.setItem(STORAGE_KEYS.gameState, JSON.stringify(snapshot));
      });
    });
  }

  private readBestScore(): number {
    const raw = this.storage.getItem(STORAGE_KEYS.bestScore);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  private readSavedGame(): SavedGameState | null {
    const raw = this.storage.getItem(STORAGE_KEYS.gameState);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<SavedGameState>;
      if (!this.isValidBoard(parsed.board)) return null;
      const score = typeof parsed.score === "number" && Number.isFinite(parsed.score) ? parsed.score : 0;

      return {
        board: parsed.board.map((row) => row.slice()),
        score,
        status: parsed.status === "won" || parsed.status === "over" ? parsed.status : "playing"
      };
    } catch {
      return null;
    }
  }

  private isValidBoard(value: unknown): value is Board {
    if (!Array.isArray(value) || value.length !== BOARD_SIZE) return false;

    return value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_SIZE &&
        row.every((cell) => Number.isFinite(cell) && cell >= 0)
    );
  }
}
