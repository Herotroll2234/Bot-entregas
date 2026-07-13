import { Client, Events } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client: Client) {
  console.log(`[BOT] Conectado com sucesso como ${client.user?.tag}!`);
}
