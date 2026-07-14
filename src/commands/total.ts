import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { ledger } from '../utils/db';
import { getMaterialByValue } from '../utils/materials';

export const data = new SlashCommandBuilder()
  .setName('total')
  .setDescription('Mostra o total de coletas e valor a receber.')
  .addUserOption(opt =>
    opt
      .setName('membro')
      .setDescription('Funcionário a consultar (apenas gerentes podem consultar outros)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const requester = interaction.member as GuildMember;
  const isManager = requester.permissions.has(PermissionFlagsBits.ManageGuild);

  const targetUser = interaction.options.getUser('membro');

  // Funcionários só podem ver o próprio extrato
  if (targetUser && targetUser.id !== interaction.user.id && !isManager) {
    await interaction.editReply({ content: '❌ Apenas gerentes podem consultar o saldo de outros funcionários.' });
    return;
  }

  const userId = targetUser?.id ?? interaction.user.id;
  const member = targetUser
    ? await interaction.guild?.members.fetch(userId).catch(() => null)
    : requester;

  const entry = ledger.get(userId);
  const displayName = member?.displayName ?? targetUser?.username ?? 'Desconhecido';

  if (entry.grandTotal === 0 && Object.keys(entry.materials).length === 0) {
    await interaction.editReply({ content: `📭 **${displayName}** ainda não possui entregas registradas.` });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📊 Extrato de Coletas — ${displayName}`)
    .setColor('#c87d32')
    .setThumbnail(member?.displayAvatarURL() ?? null)
    .setTimestamp();

  // Mostra cada material
  for (const [matValue, matEntry] of Object.entries(entry.materials)) {
    const material = getMaterialByValue(matValue);
    const label = material ? `${material.emoji} ${material.label}` : matValue;
    embed.addFields({
      name: label,
      value: `Quantidade: **${matEntry.quantity.toLocaleString('pt-BR')}**\nValor: **R$ ${matEntry.totalValue.toFixed(2)}**`,
      inline: true,
    });
  }

  embed.addFields({
    name: '💰 Total a Receber',
    value: `**R$ ${entry.grandTotal.toFixed(2)}**`,
    inline: false,
  });

  embed.setFooter({ text: 'Carpintaria Management • Extrato' });

  await interaction.editReply({ embeds: [embed] });
}
