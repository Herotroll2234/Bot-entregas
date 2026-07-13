import * as fs from 'fs';
import * as path from 'path';

interface PendingDelivery {
  userId: string;
  quantity: string;
  value: string;
  createdAt: number;
}

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DB_DIR, 'pending-deliveries.json');

// Garante que o diretório data exista
function ensureDirectoryExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// Lê os dados do arquivo JSON
function readData(): Record<string, PendingDelivery> {
  ensureDirectoryExists();
  if (!fs.existsSync(DB_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('Erro ao ler o banco de dados temporário:', error);
    return {};
  }
}

// Salva os dados no arquivo JSON
function writeData(data: Record<string, PendingDelivery>) {
  ensureDirectoryExists();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erro ao salvar no banco de dados temporário:', error);
  }
}

export const db = {
  savePendingDelivery(threadId: string, userId: string, quantity: string, value: string) {
    const data = readData();
    data[threadId] = {
      userId,
      quantity,
      value,
      createdAt: Date.now()
    };
    writeData(data);
  },

  getPendingDelivery(threadId: string): PendingDelivery | undefined {
    const data = readData();
    return data[threadId];
  },

  deletePendingDelivery(threadId: string) {
    const data = readData();
    if (data[threadId]) {
      delete data[threadId];
      writeData(data);
    }
  }
};
