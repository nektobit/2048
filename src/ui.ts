import { effect } from "./signals";
import type { Cell, Direction, MoveMeta } from "./types";
import type { GameStore } from "./store";

interface TileSprite {
  id: number;
  row: number;
  col: number;
  value: number;
  el: HTMLDivElement;
}

interface MergeTransition {
  primary: TileSprite;
  secondary: TileSprite;
  value: number;
}

const MOVE_MS = 150;

export class GameUI {
  private readonly store: GameStore;
  private readonly boardSize: number;

  private readonly scoreEl: HTMLElement;
  private readonly bestScoreEl: HTMLElement;
  private readonly boardEl: HTMLElement;
  private readonly gridBgEl: HTMLElement;
  private readonly tileLayerEl: HTMLElement;
  private readonly overlayEl: HTMLElement;
  private readonly overlayTitleEl: HTMLElement;
  private readonly newGameBtn: HTMLButtonElement;
  private readonly retryBtn: HTMLButtonElement;
  private readonly keepGoingBtn: HTMLButtonElement;

  private tiles: TileSprite[] = [];
  private removeTimers: number[] = [];
  private nextTileId = 1;

  public constructor(store: GameStore) {
    this.store = store;
    this.boardSize = store.engine.size;

    this.scoreEl = queryRequired("#score");
    this.bestScoreEl = queryRequired("#best-score");
    this.boardEl = queryRequired("#board");
    this.gridBgEl = queryRequired("#grid-background");
    this.tileLayerEl = queryRequired("#tile-layer");
    this.overlayEl = queryRequired("#overlay");
    this.overlayTitleEl = queryRequired("#overlay-title");
    this.newGameBtn = queryRequired("#new-game");
    this.retryBtn = queryRequired("#retry");
    this.keepGoingBtn = queryRequired("#keep-going");

    this.createGridBackground();
    this.bindControls();
    this.bindEffects();
  }

  private bindEffects(): void {
    effect(() => {
      this.scoreEl.textContent = String(this.store.score());
    });

    effect(() => {
      this.bestScoreEl.textContent = String(this.store.bestScore());
    });

    effect(() => {
      this.renderTiles(this.store.board(), this.store.lastMoveMeta());
    });

    effect(() => {
      const status = this.store.gameStatus();

      if (status === "won") {
        this.overlayTitleEl.textContent = "You Win";
        this.keepGoingBtn.classList.remove("hidden");
        this.overlayEl.classList.remove("hidden");
        return;
      }

      if (status === "over") {
        this.overlayTitleEl.textContent = "Game Over";
        this.keepGoingBtn.classList.add("hidden");
        this.overlayEl.classList.remove("hidden");
        return;
      }

      this.overlayEl.classList.add("hidden");
    });
  }

  private createGridBackground(): void {
    for (let row = 0; row < this.boardSize; row += 1) {
      for (let col = 0; col < this.boardSize; col += 1) {
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.style.setProperty("--row", String(row));
        cell.style.setProperty("--col", String(col));
        this.gridBgEl.appendChild(cell);
      }
    }
  }

  private renderTiles(board: number[][], moveMeta: MoveMeta | null): void {
    this.clearRemovalTimers();

    if (!this.tiles.length || !moveMeta) {
      this.hardRender(board);
      return;
    }

    const moveTarget = this.store.engine.cloneBoard(board);
    if (moveMeta.spawned) {
      moveTarget[moveMeta.spawned.row][moveMeta.spawned.col] = 0;
    }

    const tileByCoord = new Map(this.tiles.map((tile) => [this.coordKey(tile.row, tile.col), tile]));
    const consumedIds = new Set<number>();
    const survivors: TileSprite[] = [];
    const merges: MergeTransition[] = [];

    for (let index = 0; index < this.boardSize; index += 1) {
      const coords = this.getLineCoords(moveMeta.direction, index);
      const source = coords
        .map((cell) => ({ ...cell, value: moveMeta.previousBoard[cell.row][cell.col] }))
        .filter((cell) => cell.value > 0);
      const groups = this.buildMergeGroups(source);

      for (let i = 0; i < groups.length; i += 1) {
        const group = groups[i];
        const destination = coords[i];
        const destinationValue = moveTarget[destination.row][destination.col];
        if (!destinationValue) continue;

        const firstCell = group.from[0];
        const firstTile = tileByCoord.get(this.coordKey(firstCell.row, firstCell.col));
        if (!firstTile) continue;

        consumedIds.add(firstTile.id);
        this.moveTile(firstTile, destination.row, destination.col);

        if (group.from.length === 2) {
          const secondCell = group.from[1];
          const secondTile = tileByCoord.get(this.coordKey(secondCell.row, secondCell.col));

          if (secondTile) {
            consumedIds.add(secondTile.id);
            this.moveTile(secondTile, destination.row, destination.col);
            secondTile.el.classList.add("tile-merge-fade");
            merges.push({ primary: firstTile, secondary: secondTile, value: group.value });
          }

          survivors.push({
            ...firstTile,
            value: group.value,
            row: destination.row,
            col: destination.col
          });
          continue;
        }

        this.setTileValue(firstTile, destinationValue);
        survivors.push({
          ...firstTile,
          value: destinationValue,
          row: destination.row,
          col: destination.col
        });
      }
    }

    for (const tile of this.tiles) {
      if (consumedIds.has(tile.id)) continue;
      tile.el.remove();
    }

    this.tiles = survivors;

    for (const merge of merges) {
      const timer = window.setTimeout(() => {
        merge.secondary.el.remove();
        this.setTileValue(merge.primary, merge.value);
        merge.primary.el.classList.add("tile-pop");
        requestAnimationFrame(() => merge.primary.el.classList.remove("tile-pop"));
      }, MOVE_MS);

      this.removeTimers.push(timer);
    }

    if (moveMeta.spawned) {
      const created = this.createTile(moveMeta.spawned.row, moveMeta.spawned.col, moveMeta.spawned.value, true);
      this.tiles.push(created);
    }
  }

  private hardRender(board: number[][]): void {
    this.clearRemovalTimers();

    this.tiles.forEach((tile) => tile.el.remove());
    this.tiles = [];

    for (let row = 0; row < this.boardSize; row += 1) {
      for (let col = 0; col < this.boardSize; col += 1) {
        if (!board[row][col]) continue;
        this.tiles.push(this.createTile(row, col, board[row][col], false));
      }
    }
  }

  private createTile(row: number, col: number, value: number, pop: boolean): TileSprite {
    const el = document.createElement("div");
    el.className = `tile tile-${Math.min(value, 4096)}${pop ? " tile-pop" : ""}`;
    el.innerHTML = `<span>${value}</span>`;
    this.setPosition(el, row, col);
    this.tileLayerEl.appendChild(el);

    if (pop) {
      requestAnimationFrame(() => el.classList.remove("tile-pop"));
    }

    return { id: this.nextTileId++, row, col, value, el };
  }

  private moveTile(tile: TileSprite, row: number, col: number): void {
    tile.row = row;
    tile.col = col;
    this.setPosition(tile.el, row, col);
  }

  private setTileValue(tile: TileSprite, value: number): void {
    tile.value = value;
    tile.el.className = `tile tile-${Math.min(value, 4096)}`;

    const text = tile.el.firstElementChild;
    if (text) text.textContent = String(value);
  }

  private setPosition(tileEl: HTMLElement, row: number, col: number): void {
    tileEl.style.setProperty("--row", String(row));
    tileEl.style.setProperty("--col", String(col));
  }

  private getLineCoords(direction: Direction, index: number): Cell[] {
    const axis = Array.from({ length: this.boardSize }, (_, value) => value);

    if (direction === "left") {
      return axis.map((col) => ({ row: index, col }));
    }

    if (direction === "right") {
      return axis.slice().reverse().map((col) => ({ row: index, col }));
    }

    if (direction === "up") {
      return axis.map((row) => ({ row, col: index }));
    }

    return axis.slice().reverse().map((row) => ({ row, col: index }));
  }

  private buildMergeGroups(source: Array<Cell & { value: number }>): Array<{ value: number; from: Cell[] }> {
    const groups: Array<{ value: number; from: Cell[]; merged: boolean }> = [];

    for (const cell of source) {
      const last = groups[groups.length - 1];
      if (last && last.value === cell.value && !last.merged) {
        last.value *= 2;
        last.from.push(cell);
        last.merged = true;
      } else {
        groups.push({ value: cell.value, from: [cell], merged: false });
      }
    }

    return groups.map(({ value, from }) => ({ value, from }));
  }

  private coordKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  private clearRemovalTimers(): void {
    for (const timer of this.removeTimers) {
      window.clearTimeout(timer);
    }
    this.removeTimers = [];
  }

  private bindControls(): void {
    const keyMap: Record<string, Direction> = {
      ArrowUp: "up",
      ArrowRight: "right",
      ArrowDown: "down",
      ArrowLeft: "left"
    };

    document.addEventListener("keydown", (event) => {
      const direction = keyMap[event.key];
      if (!direction) return;

      const hasModifiers = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      if (hasModifiers) return;

      event.preventDefault();
      this.store.move(direction);
    });

    this.newGameBtn.addEventListener("click", () => this.store.newGame());
    this.retryBtn.addEventListener("click", () => this.store.newGame());
    this.keepGoingBtn.addEventListener("click", () => this.store.keepPlaying());

    let startX = 0;
    let startY = 0;

    this.boardEl.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        event.preventDefault();
      },
      { passive: false }
    );

    this.boardEl.addEventListener(
      "touchmove",
      (event) => {
        event.preventDefault();
      },
      { passive: false }
    );

    this.boardEl.addEventListener(
      "touchend",
      (event) => {
        if (!event.changedTouches.length) return;

        const endX = event.changedTouches[0].clientX;
        const endY = event.changedTouches[0].clientY;
        const dx = endX - startX;
        const dy = endY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) <= 10) return;

        const direction: Direction = absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        this.store.move(direction);
        event.preventDefault();
      },
      { passive: false }
    );
  }
}

function queryRequired<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element as T;
}
