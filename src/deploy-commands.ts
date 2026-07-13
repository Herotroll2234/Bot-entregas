import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const commands: any[] = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[AVISO] O comando em "${filePath}" está faltando a propriedade "data" ou "execute".`);
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('[ERRO] DISCORD_TOKEN e CLIENT_ID são obrigatórios no arquivo .env!');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`[DEPLOY] Iniciando a atualização de ${commands.length} comandos de aplicativo (/).`);

    if (guildId && guildId !== 'seu_guild_id_aqui') {
      console.log(`[DEPLOY] Registrando comandos localmente para a Guilda (Servidor): ${guildId}`);
      const data: any = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log(`[DEPLOY] Comandos locais registrados com sucesso! Total: ${data.length}`);
    } else {
      console.log('[DEPLOY] Registrando comandos GLOBALMENTE. (Pode demorar até 1 hora para aparecer em todos os servidores)');
      const data: any = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log(`[DEPLOY] Comandos globais registrados com sucesso! Total: ${data.length}`);
    }
  } catch (error) {
    console.error('[DEPLOY ERRO] Erro ao registrar comandos:', error);
  }
})();
