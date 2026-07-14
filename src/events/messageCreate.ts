import { Events, Message, EmbedBuilder, ChannelType, TextChannel } from 'discord.js';
import { pending, ledger } from '../utils/db';
import { getMaterialByValue, calculateValue } from '../utils/materials';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  // Ignora mensagens do próprio bot
  if (message.author.bot) return;

  // Só processa em canais de texto de servidores (não threads)
  if (message.channel.type !== ChannelType.GuildText) return;

  const channel = message.channel as TextChannel;

  // Verifica se há uma entrega pendente para esse canal
  const entry = pending.get(channel.id);
  if (!entry) return;

  // Garante que só o funcionário dono da entrega pode finalizar
  if (message.author.id !== entry.userId) return;

  // Verifica se há imagem anexada
  const attachment = message.attachments.first();
  const isImage = attachment?.contentType?.startsWith('image/');

  if (!attachment || !isImage) {
    await message.reply('⚠️ Por favor, envie uma **imagem (print/comprovante)** para finalizar o cadastro.');
    return;
  }

  const material = getMaterialByValue(entry.material);
  if (!material) {
    await message.reply('❌ Material da entrega não encontrado. Entre em contato com um administrador.');
    return;
  }

  const totalValue = calculateValue(entry.material, entry.quantity);

  // Atualiza o extrato persistente do funcionário
  ledger.addDelivery(entry.userId, entry.material, entry.quantity, totalValue);

  // Busca saldo atualizado para mostrar acumulado
  const updatedLedger = ledger.get(entry.userId);

  // Busca o canal de logs
  const logChannel = message.guild?.channels.cache.get(process.env.LOG_CHANNEL_ID || '') as TextChannel | undefined;

  if (!logChannel) {
    console.error(`[ERRO] Canal de logs (LOG_CHANNEL_ID) não encontrado.`);
  }

  try {
    // Embed de log para os administradores (com print)
    const adminEmbed = new EmbedBuilder()
      .setTitle('📦 Nova Entrega Registrada')
      .setDescription('Uma entrega foi cadastrada e confirmada com comprovante.')
      .addFields(
        { name: '👤 Funcionário',   value: `<@${entry.userId}>`, inline: true },
        { name: `${material.emoji} Material`, value: material.label, inline: true },
        { name: '📦 Quantidade',   value: `${entry.quantity.toLocaleString('pt-BR')} unidades`, inline: true },
        { name: '💰 Valor desta entrega', value: `R$ ${totalValue.toFixed(2)}`, inline: true },
        { name: '📊 Acumulado total', value: `R$ ${updatedLedger.grandTotal.toFixed(2)}`, inline: true },
        { name: '📅 Data',         value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
      )
      .setImage(attachment.url)
      .setColor('#2d8a4e')
      .setThumbnail(message.author.displayAvatarURL())
      .setFooter({ text: `Canal: ${channel.name} • Carpintaria` });

    if (logChannel) await logChannel.send({ embeds: [adminEmbed] });

    // Embed de confirmação para o funcionário (sem o print, mais leve)
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Entrega Confirmada!')
      .setDescription('Seu comprovante foi recebido e a entrega foi registrada com sucesso.')
      .addFields(
        { name: `${material.emoji} Material`,  value: material.label, inline: true },
        { name: '📦 Quantidade', value: `${entry.quantity.toLocaleString('pt-BR')} unidades`, inline: true },
        { name: '💰 Valor desta entrega', value: `**R$ ${totalValue.toFixed(2)}**`, inline: false },
        { name: '📊 Seu saldo acumulado', value: `**R$ ${updatedLedger.grandTotal.toFixed(2)}**`, inline: false },
      )
      .setColor('#2d8a4e')
      .setFooter({ text: 'Use /total para ver seu extrato completo' });

    await message.reply({ embeds: [successEmbed] });

    // Remove a entrega pendente (canal não é deletado!)
    pending.delete(channel.id);

  } catch (error) {
    console.error('Erro ao processar entrega:', error);
    await message.reply('❌ Ocorreu um erro ao processar sua entrega. Tente novamente ou contate um administrador.');
  }
}
