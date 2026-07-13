import { Client, Collection, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Inicializa o Cliente com os GatewayIntents necessários
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Estende o tipo de client com a propriedade commands
(client as any).commands = new Collection();

// Carrega os comandos de /src/commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      (client as any).commands.set(command.data.name, command);
      console.log(`[CARGA] Comando registrado: /${command.data.name}`);
    }
  }
}

// Carrega os eventos de /src/events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const event = require(filePath);
    if ('name' in event && 'execute' in event) {
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
      console.log(`[CARGA] Evento registrado: ${event.name}`);
    }
  }
}

// Inicializa a conexão com o Discord
const token = process.env.DISCORD_TOKEN;

console.log('[DEBUG] Variáveis de ambiente detectadas no processo:');
console.log(`- DISCORD_TOKEN: ${token ? `Definido (tamanho: ${token.length})` : 'Indefinido'}`);
console.log(`- CLIENT_ID: ${process.env.CLIENT_ID ? `Definido (tamanho: ${process.env.CLIENT_ID.length})` : 'Indefinido'}`);
console.log(`- GUILD_ID: ${process.env.GUILD_ID ? `Definido (tamanho: ${process.env.GUILD_ID.length})` : 'Indefinido'}`);
console.log(`- LOG_CHANNEL_ID: ${process.env.LOG_CHANNEL_ID ? `Definido (tamanho: ${process.env.LOG_CHANNEL_ID.length})` : 'Indefinido'}`);

if (!token || token === 'seu_token_aqui') {
  console.log('\n========================================================================');
  console.log('⚠️  [BOT] O token do bot não foi configurado no arquivo .env.');
  console.log('👉 Adicione suas credenciais no arquivo .env para iniciar o bot.');
  console.log('========================================================================\n');
} else {
  console.log('[BOT] Conectando ao Discord...');
  client.login(token).catch(err => {
    console.error('[BOT ERRO] Erro ao autenticar no Discord:', err.message);
  });
}
