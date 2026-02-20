import { GameEngine } from "./engine";
import { GameStore } from "./store";
import { GameUI } from "./ui";

const engine = new GameEngine();
const store = new GameStore(engine);

new GameUI(store);
