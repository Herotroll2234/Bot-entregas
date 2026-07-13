import { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  CommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChatInputCommandInteraction
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configura os painéis da Carpintaria no canal.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(subcommand =>
    subcommand
      .setName('recrutamento')
      .setDescription('Envia o painel de solicitação de emprego neste canal.')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('entregas')
      .setDescription('Envia o painel de cadastro de entregas neste canal.')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'recrutamento') {
    const embed = new EmbedBuilder()
      .setTitle('🪵 Carpintaria - Trabalhe Conosco')
      .setDescription(
        'Deseja fazer parte da nossa equipe de carpintaria?\n\n' +
        'Clique no botão abaixo para preencher o formulário de solicitação de emprego.\n' +
        'O preenchimento automático irá alterar o seu nome no servidor e conceder o cargo inicial.'
      )
      .setColor('#2d8a4e') // Verde floresta
      .setThumbnail(interaction.guild?.iconURL() || null)
      .setFooter({ text: 'Carpintaria Management • Recrutamento', iconURL: interaction.client.user?.displayAvatarURL() });

    const button = new ButtonBuilder()
      .setCustomId('btn_solicitar_emprego')
      .setLabel('Solicitar Emprego')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📝');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({ content: 'Painel de recrutamento enviado com sucesso!', ephemeral: true });
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [embed], components: [row] });
    }

  } else if (subcommand === 'entregas') {
    const embed = new EmbedBuilder()
      .setTitle('📦 Registro de Entregas')
      .setDescription(
        'Olá, funcionário! Cadastre aqui as suas entregas realizadas.\n\n' +
        '1. Clique no botão **"Cadastrar Entrega"** abaixo.\n' +
        '2. Preencha a **quantidade** de itens e o **valor** total da entrega.\n' +
        '3. O bot criará uma thread privada para você enviar o **print de comprovação**.'
      )
      .setColor('#c87d32') // Castanho madeira
      .setThumbnail(interaction.guild?.iconURL() || null)
      .setFooter({ text: 'Carpintaria Management • Financeiro', iconURL: interaction.client.user?.displayAvatarURL() });

    const button = new ButtonBuilder()
      .setCustomId('btn_registrar_entrega')
      .setLabel('Cadastrar Entrega')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📥');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await interaction.reply({ content: 'Painel de entregas enviado com sucesso!', ephemeral: true });
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [embed], components: [row] });
    }
  }
}
