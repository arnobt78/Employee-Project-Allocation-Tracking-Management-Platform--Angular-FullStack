import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data.json");

let inMemoryStore = null;

async function readStoreFromDisk() {
  const file = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(file);
}

export async function getStore() {
  if (!inMemoryStore) {
    inMemoryStore = await readStoreFromDisk();
  }
  return JSON.parse(JSON.stringify(inMemoryStore));
}
