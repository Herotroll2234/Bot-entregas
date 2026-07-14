import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionsBitField,
  TextChannel,
  GuildMember,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('criar-canal')
  .setDescription('Cria o canal privado de entregas para um funcionário existente.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption(opt =>
    opt
      .setName('membro')
      .setDescription('Funcionário que receberá o canal privado de entregas')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const targetUser = interaction.options.getUser('membro', true);
  const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null) as GuildMember | null;

  if (!member) {
    await interaction.editReply({ content: '❌ Não foi possível encontrar esse membro no servidor.' });
    return;
  }

  const displayName = member.displayName;
  const categoryId = process.env.CATEGORY_ID;
  const guild = interaction.guild!;

  // Gera o nome do canal a partir do apelido atual do membro
  const safeName = displayName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s|-]/g, '')   // remove caracteres especiais
    .replace(/\s+/g, '-')            // espaços viram hífens
    .substring(0, 90);

  const channelName = `🪵-${safeName}`;

  // Verifica se o canal já existe
  const existing = guild.channels.cache.find(
    c => c.name === channelName || c.name === channelName.replace('🪵-', '')
  );

  if (existing) {
    await interaction.editReply({
      content: `⚠️ Já existe um canal com esse nome: ${existing}. Se precisar recriar, exclua o canal antigo primeiro.`,
    });
    return;
  }

  try {
    const everyoneRole = guild.roles.everyone;

    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId || undefined,
      permissionOverwrites: [
        // Bloqueia @everyone
        { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        // Libera para o funcionário
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.AttachFiles,
          ],
        },
        // Libera para o bot
        {
          id: interaction.client.user!.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
      ],
      reason: `Canal de entregas criado manualmente pelo administrador ${interaction.user.tag} para ${displayName}`,
    }) as TextChannel;

    // Mensagem de boas-vindas com botão fixo
    const welcomeEmbed = new EmbedBuilder()
      .setTitle('🪵 Seu Canal de Entregas')
      .setDescription(
        `Olá **${displayName}**! Este é o seu canal privado de entregas.\n\n` +
        `Sempre que concluir uma entrega, clique no botão abaixo para registrá-la.`
      )
      .addFields({
        name: '📦 Como funciona?',
        value:
          '1. Clique em **"Cadastrar Entrega"**\n' +
          '2. Selecione o material coletado\n' +
          '3. Informe a quantidade\n' +
          '4. Envie o print do comprovante',
        inline: false,
      })
      .setColor('#c87d32')
      .setFooter({ text: 'Carpintaria Management • Canal Privado' });

    const deliveryBtn = new ButtonBuilder()
      .setCustomId('btn_registrar_entrega')
      .setLabel('Cadastrar Entrega')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📥');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(deliveryBtn);
    const msg = await newChannel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [row] });
    await msg.pin().catch(() => {});

    await interaction.editReply({
      content: `✅ Canal criado com sucesso para **${displayName}**: ${newChannel}`,
    });

  } catch (err: any) {
    console.error('Erro ao criar canal pelo /criar-canal:', err);
    await interaction.editReply({
      content: `❌ Erro ao criar o canal: ${err.message}`,
    });
  }
}
