import { 
  Events, 
  Interaction, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder, 
  GuildMember, 
  ChannelType,
  EmbedBuilder
} from 'discord.js';
import { db } from '../utils/db';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(interaction: Interaction) {
  // 1. Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = (interaction.client as any).commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error('Erro ao executar comando:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'Ocorreu um erro ao executar esse comando!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'Ocorreu um erro ao executar esse comando!', ephemeral: true });
      }
    }
    return;
  }

  // 2. Button Clicks
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_solicitar_emprego') {
      const modal = new ModalBuilder()
        .setCustomId('modal_solicitar_emprego')
        .setTitle('Solicitação de Emprego');

      const nameInput = new TextInputBuilder()
        .setCustomId('nome_input')
        .setLabel('Seu Nome')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: João Silva')
        .setMaxLength(25) // Garantir que não estoure os 32 caracteres com o pombo
        .setRequired(true);

      const pomboInput = new TextInputBuilder()
        .setCustomId('pombo_input')
        .setLabel('Seu Pombo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 22')
        .setMaxLength(5)
        .setRequired(true);

      const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
      const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(pomboInput);
      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
    } 
    
    else if (interaction.customId === 'btn_registrar_entrega') {
      const modal = new ModalBuilder()
        .setCustomId('modal_registrar_entrega')
        .setTitle('Cadastro de Entrega');

      const qtdInput = new TextInputBuilder()
        .setCustomId('qtd_input')
        .setLabel('Quantidade de Itens')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 150 tábuas de carvalho')
        .setRequired(true);

      const valorInput = new TextInputBuilder()
        .setCustomId('valor_input')
        .setLabel('Valor Total')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: R$ 7.500')
        .setRequired(true);

      const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(qtdInput);
      const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(valorInput);
      modal.addComponents(row1, row2);

      await interaction.showModal(modal);
    }
    return;
  }

  // 3. Modal Submissions
  if (interaction.isModalSubmit()) {
    const member = interaction.member as GuildMember;
    if (!member) return;

    if (interaction.customId === 'modal_solicitar_emprego') {
      const nome = interaction.fields.getTextInputValue('nome_input');
      const pombo = interaction.fields.getTextInputValue('pombo_input');
      const newNickname = `${nome} | ${pombo}`.substring(0, 32);

      await interaction.deferReply({ ephemeral: true });

      let nicknameChanged = false;
      let roleAssigned = false;
      let errorMsg = '';

      // Tenta alterar o nickname
      try {
        await member.setNickname(newNickname);
        nicknameChanged = true;
      } catch (err: any) {
        console.warn(`Não foi possível alterar apelido de ${member.user.tag}:`, err.message);
        errorMsg += '\n❌ Não foi possível alterar o seu apelido (geralmente por restrição de Dono/Admin ou hierarquia).';
      }

      // Tenta atribuir o cargo
      const roleName = process.env.EMPLOYEE_ROLE_NAME || 'funcionário';
      const role = interaction.guild?.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());

      if (role) {
        try {
          await member.roles.add(role);
          roleAssigned = true;
        } catch (err: any) {
          console.warn(`Não foi possível atribuir cargo a ${member.user.tag}:`, err.message);
          errorMsg += `\n❌ Não foi possível conceder o cargo **"${roleName}"** (verifique se o cargo do bot está acima na lista de cargos).`;
        }
      } else {
        errorMsg += `\n⚠️ Cargo **"${roleName}"** não foi encontrado no servidor.`;
      }

      // Feedback para o usuário
      if (nicknameChanged && roleAssigned) {
        await interaction.editReply({
          content: `✅ **Solicitação concluída com sucesso!**\nSeu apelido foi definido como \`${newNickname}\` e você recebeu o cargo de **${roleName}**.`
        });
      } else {
        await interaction.editReply({
          content: `⚠️ **Solicitação processada com avisos:**${errorMsg}\n\n*Por favor, peça a um administrador para ajustar o seu apelido ou cargo manualmente.*`
        });
      }
    } 
    
    else if (interaction.customId === 'modal_registrar_entrega') {
      const quantidade = interaction.fields.getTextInputValue('qtd_input');
      const valor = interaction.fields.getTextInputValue('valor_input');

      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.channel;
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({ content: '❌ Este comando só pode ser usado em canais de texto de servidores.' });
        return;
      }

      try {
        // Criar Thread Privada
        const threadName = `entrega-${interaction.user.username}`.substring(0, 100);
        const thread = await channel.threads.create({
          name: threadName,
          autoArchiveDuration: 60,
          type: ChannelType.GuildPrivateThread,
          reason: `Registro de entrega para ${interaction.user.tag}`
        });

        // Adiciona o usuário que solicitou
        await thread.members.add(interaction.user.id);

        // Salvar os dados pendentes no nosso "banco de dados" local JSON
        db.savePendingDelivery(thread.id, interaction.user.id, quantidade, valor);

        // Mensagem de boas-vindas na Thread
        const welcomeEmbed = new EmbedBuilder()
          .setTitle('📥 Registro de Entrega Iniciado')
          .setDescription(
            `Olá ${interaction.user}, sua entrega foi iniciada no sistema!\n\n` +
            `🔹 **Quantidade:** ${quantidade}\n` +
            `🔹 **Valor:** ${valor}\n\n` +
            `👉 **Ação Requerida:** Por favor, faça o upload do **print/comprovante** da entrega nesta thread para finalizar o registro.`
          )
          .setColor('#c87d32')
          .setFooter({ text: 'Aguardando comprovante...' });

        await thread.send({ content: `${interaction.user}`, embeds: [welcomeEmbed] });

        await interaction.editReply({
          content: `✅ Formulado recebido! Criei uma thread privada para você concluir o registro: ${thread}`
        });

      } catch (err: any) {
        console.error('Erro ao criar thread privada de entrega:', err);
        await interaction.editReply({
          content: `❌ Ocorreu um erro ao iniciar a entrega: ${err.message}`
        });
      }
    }
    return;
  }
}
