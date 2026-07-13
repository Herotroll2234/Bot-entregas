import { Events, Message, EmbedBuilder, ChannelType, TextChannel } from 'discord.js';
import { db } from '../utils/db';

export const name = Events.MessageCreate;
export const once = false;

export async function execute(message: Message) {
  // Ignora mensagens do próprio bot
  if (message.author.bot) return;

  const channel = message.channel;
  
  // Verifica se a mensagem está em uma thread
  if (channel.type !== ChannelType.PrivateThread && channel.type !== ChannelType.PublicThread) {
    return;
  }

  // Verifica se essa thread possui um registro de entrega pendente
  const pending = db.getPendingDelivery(channel.id);
  if (!pending) return;

  // Garante que apenas quem iniciou a entrega possa enviar o comprovante
  if (message.author.id !== pending.userId) return;

  // Verifica se há anexos e se o primeiro anexo é uma imagem
  const attachment = message.attachments.first();
  const isImage = attachment && attachment.contentType && attachment.contentType.startsWith('image/');

  if (!attachment || !isImage) {
    await message.reply('⚠️ Por favor, envie uma **imagem (print/comprovante)** para finalizar o seu cadastro de entrega.');
    return;
  }

  // Tenta encontrar o canal de logs
  const logChannelId = process.env.LOG_CHANNEL_ID;
  const logChannel = message.guild?.channels.cache.get(logChannelId || '') as TextChannel | undefined;

  if (!logChannel) {
    await message.reply('❌ Canal de logs de entregas não configurado no servidor ou ID incorreto no arquivo `.env`. Entre em contato com um administrador.');
    console.error(`[ERRO] Canal de logs de entregas com ID "${logChannelId}" não foi localizado.`);
    return;
  }

  try {
    // Cria o embed de relatório formatado para os administradores
    const reportEmbed = new EmbedBuilder()
      .setTitle('📦 Novo Registro de Entrega')
      .setDescription(`Uma nova entrega foi cadastrada com sucesso e está registrada abaixo.`)
      .addFields(
        { name: '👤 Funcionário', value: `<@${pending.userId}>`, inline: true },
        { name: '📦 Quantidade', value: pending.quantity, inline: true },
        { name: '💰 Valor Informado', value: pending.value, inline: true },
        { name: '📅 Data do Cadastro', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setImage(attachment.url)
      .setColor('#2d8a4e') // Verde sucesso
      .setThumbnail(message.author.displayAvatarURL())
      .setFooter({ text: `ID do Tópico: ${channel.id} • Carpintaria` });

    // Envia o embed de log
    await logChannel.send({ embeds: [reportEmbed] });

    // Mensagem de sucesso para o funcionário
    await message.reply('✅ **Comprovante registrado com sucesso!** O relatório foi enviado para a contabilidade da empresa.\n\n*Este tópico será excluído automaticamente em 5 segundos...*');

    // Deleta os dados do banco local
    db.deletePendingDelivery(channel.id);

    // Exclui a thread após um pequeno delay de 5 segundos
    setTimeout(async () => {
      try {
        await channel.delete();
      } catch (err) {
        console.error('Erro ao deletar thread de entrega concluída:', err);
      }
    }, 5000);

  } catch (error) {
    console.error('Erro ao processar e salvar entrega:', error);
    await message.reply('❌ Ocorreu um erro ao processar o registro da sua entrega. Por favor, tente novamente ou fale com um administrador.');
  }
}
