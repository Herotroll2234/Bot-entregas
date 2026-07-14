import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { ledger } from '../utils/db';
import { getMaterialByValue } from '../utils/materials';

export const data = new SlashCommandBuilder()
  .setName('pago')
  .setDescription('Registra o pagamento de um funcionário e zera o saldo dele.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addUserOption(opt =>
    opt
      .setName('membro')
      .setDescription('Funcionário que receberá o pagamento')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('membro', true);
  const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
  const displayName = member?.displayName ?? targetUser.username;

  const snapshot = ledger.resetUser(targetUser.id);

  if (snapshot.grandTotal === 0 && Object.keys(snapshot.materials).length === 0) {
    await interaction.editReply({ content: `⚠️ **${displayName}** não possui saldo pendente para pagar.` });
    return;
  }

  // Embed de recibo para o administrador
  const receiptEmbed = new EmbedBuilder()
    .setTitle('✅ Pagamento Registrado')
    .setDescription(`O saldo de **${displayName}** foi zerado com sucesso.`)
    .setColor('#2d8a4e')
    .setThumbnail(member?.displayAvatarURL() ?? null)
    .setTimestamp();

  // Detalha os materiais pagos
  for (const [matValue, matEntry] of Object.entries(snapshot.materials)) {
    const material = getMaterialByValue(matValue);
    const label = material ? `${material.emoji} ${material.label}` : matValue;
    receiptEmbed.addFields({
      name: label,
      value: `Quantidade: **${matEntry.quantity.toLocaleString('pt-BR')}**\nValor Pago: **R$ ${matEntry.totalValue.toFixed(2)}**`,
      inline: true,
    });
  }

  receiptEmbed.addFields({
    name: '💰 Total Pago',
    value: `**R$ ${snapshot.grandTotal.toFixed(2)}**`,
    inline: false,
  });

  receiptEmbed.addFields({
    name: '👮 Pago por',
    value: `${interaction.user}`,
    inline: false,
  });

  receiptEmbed.setFooter({ text: 'Carpintaria Management • Pagamentos' });

  // Envia o recibo no canal de logs
  const logChannel = interaction.guild?.channels.cache.get(process.env.LOG_CHANNEL_ID || '') as TextChannel | undefined;
  if (logChannel) {
    await logChannel.send({ embeds: [receiptEmbed] });
  }

  // Confirma para o gerente
  await interaction.editReply({ embeds: [receiptEmbed] });
}
