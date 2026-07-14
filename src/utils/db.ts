import * as fs from 'fs';
import * as path from 'path';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PendingDelivery {
  userId: string;
  channelId: string;   // Canal privado do funcionário
  material: string;    // Ex: 'tronco_madeira'
  quantity: number;
  createdAt: number;
}

interface MaterialEntry {
  quantity: number;
  totalValue: number;
}

interface LedgerEntry {
  userId: string;
  materials: Record<string, MaterialEntry>; // keyed by material value
  grandTotal: number; // total a receber em R$
  lastUpdated: number;
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const PENDING_FILE = path.join(DB_DIR, 'pending-deliveries.json');
const LEDGER_FILE  = path.join(DB_DIR, 'ledgers.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

function readJSON<T>(file: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8') || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Pending Deliveries ───────────────────────────────────────────────────────

export const pending = {
  save(channelId: string, userId: string, material: string, quantity: number) {
    const data = readJSON<Record<string, PendingDelivery>>(PENDING_FILE, {});
    data[channelId] = { userId, channelId, material, quantity, createdAt: Date.now() };
    writeJSON(PENDING_FILE, data);
  },

  get(channelId: string): PendingDelivery | undefined {
    return readJSON<Record<string, PendingDelivery>>(PENDING_FILE, {})[channelId];
  },

  delete(channelId: string) {
    const data = readJSON<Record<string, PendingDelivery>>(PENDING_FILE, {});
    delete data[channelId];
    writeJSON(PENDING_FILE, data);
  },
};

// ─── Ledger (Extrato de cada funcionário) ─────────────────────────────────────

export const ledger = {
  get(userId: string): LedgerEntry {
    const all = readJSON<Record<string, LedgerEntry>>(LEDGER_FILE, {});
    return all[userId] ?? { userId, materials: {}, grandTotal: 0, lastUpdated: Date.now() };
  },

  addDelivery(userId: string, material: string, quantity: number, value: number) {
    const all = readJSON<Record<string, LedgerEntry>>(LEDGER_FILE, {});
    if (!all[userId]) all[userId] = { userId, materials: {}, grandTotal: 0, lastUpdated: Date.now() };
    if (!all[userId].materials[material]) all[userId].materials[material] = { quantity: 0, totalValue: 0 };

    all[userId].materials[material].quantity   += quantity;
    all[userId].materials[material].totalValue  = parseFloat((all[userId].materials[material].totalValue + value).toFixed(2));
    all[userId].grandTotal = parseFloat((all[userId].grandTotal + value).toFixed(2));
    all[userId].lastUpdated = Date.now();

    writeJSON(LEDGER_FILE, all);
  },

  resetUser(userId: string): LedgerEntry {
    const all = readJSON<Record<string, LedgerEntry>>(LEDGER_FILE, {});
    const snapshot = all[userId] ?? { userId, materials: {}, grandTotal: 0, lastUpdated: Date.now() };
    all[userId] = { userId, materials: {}, grandTotal: 0, lastUpdated: Date.now() };
    writeJSON(LEDGER_FILE, all);
    return snapshot; // retorna o snapshot antes de zerar (para usar no log)
  },
};
