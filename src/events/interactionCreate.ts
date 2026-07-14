import {
  Events,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildMember,
  ChannelType,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionsBitField,
  TextChannel,
} from 'discord.js';
import { pending } from '../utils/db';
import { MATERIALS, getMaterialByValue } from '../utils/materials';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {

  // ─── 1. Slash Commands ──────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const command = (interaction.client as any).commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Erro ao executar comando:', error);
      const reply = { content: '❌ Ocorreu um erro ao executar esse comando!', ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
      else await interaction.reply(reply);
    }
    return;
  }

  // ─── 2. Botões ───────────────────────────────────────────────────────────────
  if (interaction.isButton()) {

    // Botão: Solicitar Emprego
    if (interaction.customId === 'btn_solicitar_emprego') {
      const modal = new ModalBuilder()
        .setCustomId('modal_solicitar_emprego')
        .setTitle('Solicitação de Emprego');

      const nameInput = new TextInputBuilder()
        .setCustomId('nome_input')
        .setLabel('Seu Nome')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: João Silva')
        .setMaxLength(25)
        .setRequired(true);

      const pomboInput = new TextInputBuilder()
        .setCustomId('pombo_input')
        .setLabel('Seu Pombo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 22')
        .setMaxLength(5)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(pomboInput),
      );
      await interaction.showModal(modal);
      return;
    }

    // Botão: Cadastrar Entrega — mostra menu de materiais
    if (interaction.customId === 'btn_registrar_entrega') {
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_material')
        .setPlaceholder('Selecione o material entregue...')
        .addOptions(
          MATERIALS.map(m =>
            new StringSelectMenuOptionBuilder()
              .setLabel(m.label)
              .setValue(m.value)
              .setEmoji(m.emoji)
          )
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      await interaction.reply({
        content: '🪵 **Qual material você está entregando?**',
        components: [row],
        ephemeral: true,
      });
      return;
    }
  }

  // ─── 3. Select Menu (escolha de material) ────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_material') {
    const selectedValue = interaction.values[0];
    const material = getMaterialByValue(selectedValue);
    if (!material) {
      await interaction.reply({ content: '❌ Material inválido selecionado.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_entrega:${selectedValue}`)
      .setTitle(`${material.emoji} ${material.label}`);

    const qtdInput = new TextInputBuilder()
      .setCustomId('qtd_input')
      .setLabel('Quantidade entregue')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 150')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(qtdInput));
    await interaction.showModal(modal);
    return;
  }

  // ─── 4. Modais ────────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const member = interaction.member as GuildMember;
    if (!member) return;

    // ── 4a. Solicitação de Emprego ────────────────────────────────────────────
    if (interaction.customId === 'modal_solicitar_emprego') {
      const nome  = interaction.fields.getTextInputValue('nome_input');
      const pombo = interaction.fields.getTextInputValue('pombo_input');
      const newNickname = `${nome} | ${pombo}`.substring(0, 32);

      await interaction.deferReply({ ephemeral: true });

      let errors = '';

      // Alterar nickname
      try {
        await member.setNickname(newNickname);
      } catch (err: any) {
        errors += '\n❌ Não foi possível alterar o apelido (hierarquia de cargos).';
      }

      // Atribuir cargo
      const roleName = process.env.EMPLOYEE_ROLE_NAME || 'funcionário';
      const role = interaction.guild?.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
      if (role) {
        try { await member.roles.add(role); }
        catch { errors += `\n❌ Não foi possível conceder o cargo **"${roleName}"**.`; }
      } else {
        errors += `\n⚠️ Cargo **"${roleName}"** não encontrado no servidor.`;
      }

      // Criar canal privado do funcionário
      const categoryId = process.env.CATEGORY_ID;
      const guild = interaction.guild!;
      const channelName = `🪵-${nome.toLowerCase().replace(/\s+/g, '-')}-${pombo}`.substring(0, 100);

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
            // Libera para o próprio bot
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
          reason: `Canal de entregas criado para ${newNickname}`,
        }) as TextChannel;

        // Manda mensagem de boas-vindas com botão fixo
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('🪵 Seu Canal de Entregas')
          .setDescription(
            `Olá **${nome}**! Bem-vindo(a) à equipe da Carpintaria!\n\n` +
            `Este é o seu canal privado de entregas.\n` +
            `Sempre que concluir uma entrega, clique no botão abaixo para registrá-la.`
          )
          .addFields(
            { name: '📦 Como funciona?', value: '1. Clique em **"Cadastrar Entrega"**\n2. Selecione o material\n3. Informe a quantidade\n4. Envie o print do comprovante', inline: false }
          )
          .setColor('#c87d32')
          .setFooter({ text: 'Carpintaria Management • Canal Privado' });

        const deliveryBtn = new ButtonBuilder()
          .setCustomId('btn_registrar_entrega')
          .setLabel('Cadastrar Entrega')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📥');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(deliveryBtn);
        const msg = await newChannel.send({ embeds: [welcomeEmbed], components: [row] });
        await msg.pin().catch(() => {}); // tenta fixar a mensagem

        await interaction.editReply({
          content:
            `✅ **Bem-vindo(a) à Carpintaria, ${nome}!**\n` +
            `Apelido: \`${newNickname}\` | Cargo: **${roleName}**\n` +
            `Seu canal de entregas foi criado: ${newChannel}` +
            (errors ? `\n\n⚠️ Avisos:${errors}` : ''),
        });

      } catch (err: any) {
        console.error('Erro ao criar canal privado:', err);
        await interaction.editReply({
          content:
            `✅ Recrutamento processado, mas houve um erro ao criar o canal privado: ${err.message}` +
            (errors ? `\n⚠️ Avisos:${errors}` : ''),
        });
      }
      return;
    }

    // ── 4b. Cadastro de Entrega (após selecionar material) ────────────────────
    if (interaction.customId.startsWith('modal_entrega:')) {
      const materialValue = interaction.customId.split(':')[1];
      const material = getMaterialByValue(materialValue);

      if (!material) {
        await interaction.reply({ content: '❌ Material inválido.', ephemeral: true });
        return;
      }

      const qtdRaw = interaction.fields.getTextInputValue('qtd_input');
      const quantity = parseInt(qtdRaw.replace(/\D/g, ''), 10);

      if (isNaN(quantity) || quantity <= 0) {
        await interaction.reply({ content: '❌ Quantidade inválida. Digite apenas números (ex: `150`).', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({ content: '❌ Este botão só pode ser usado em canais de texto.' });
        return;
      }

      // Salva a entrega pendente associada ao canal do funcionário
      pending.save(channel.id, interaction.user.id, materialValue, quantity);

      const unitPrice = material.pricePerUnit;
      const totalValue = (unitPrice * quantity).toFixed(2);

      const promptEmbed = new EmbedBuilder()
        .setTitle(`📥 Entrega Iniciada — ${material.emoji} ${material.label}`)
        .setDescription(
          `Sua entrega foi registrada no sistema!\n\n` +
          `🔹 **Material:** ${material.emoji} ${material.label}\n` +
          `🔹 **Quantidade:** ${quantity.toLocaleString('pt-BR')} unidades\n` +
          `🔹 **Preço por unidade:** R$ ${unitPrice.toFixed(2)}\n` +
          `💰 **Valor estimado: R$ ${totalValue}**\n\n` +
          `👉 **Agora envie o print/comprovante aqui no canal para finalizar!**`
        )
        .setColor('#c87d32')
        .setFooter({ text: 'Aguardando comprovante...' });

      await channel.send({ content: `${interaction.user}`, embeds: [promptEmbed] });
      await interaction.editReply({ content: '✅ Formulário enviado! Agora envie o print aqui no canal.' });
      return;
    }
  }
}
