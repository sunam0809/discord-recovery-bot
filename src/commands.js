const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const WEB_URL = process.env.WEB_URL || 'https://discord-web-vvxf.onrender.com';

async function handleVerifyPanel(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  const role = interaction.options.getRole('역할');
  const webhookUrl = interaction.options.getString('웹훅');
  const guildId = interaction.guild.id;

  db.setGuildSettings(guildId, {
    roleId: role.id,
    roleName: role.name,
    webhookUrl,
    channelId: interaction.channel.id,
    guildName: interaction.guild.name,
  });

  const embed = new EmbedBuilder()
    .setTitle('🔐 서버 인증')
    .setDescription(
      '아래 버튼을 클릭하여 Discord 계정으로 인증하세요.\n\n' +
      '✅ 인증 완료 시 **' + role.name + '** 역할이 부여됩니다.\n' +
      '🔒 귀하의 정보는 안전하게 보호됩니다.'
    )
    .setColor(0x5865F2)
    .setFooter({ text: interaction.guild.name + ' 인증 시스템' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('✅ 인증하기')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.editReply({ content: '✅ 인증창이 설치되었습니다!' });
}

async function handleVerifyButton(interaction, db) {
  const guildId = interaction.guild.id;
  const settings = db.getGuildSettings(guildId);

  if (!settings) {
    return interaction.reply({
      content: '❌ 인증 설정이 없습니다. `/인증창` 명령어를 먼저 실행하세요.',
      ephemeral: true,
    });
  }

  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${WEB_URL}/auth/callback`;
  const authUrl =
    `https://discord.com/api/oauth2/authorize` +
    `?client_id=${process.env.DISCORD_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=identify%20guilds.join` +
    `&state=${guildId}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🔗 Discord로 인증하기')
      .setStyle(ButtonStyle.Link)
      .setURL(authUrl)
  );

  await interaction.reply({
    content: '아래 버튼을 클릭하여 Discord 계정으로 인증을 완료하세요.',
    components: [row],
    ephemeral: true,
  });
}

async function handleCreateRecoveryKey(interaction, db) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guild.id;
  const settings = db.getGuildSettings(guildId);

  if (!settings) {
    return interaction.editReply({ content: '❌ 인증 설정이 없습니다. `/인증창` 명령어를 먼저 실행하세요.' });
  }

  const key = db.createRecoveryKey(guildId);
  const users = db.getVerifiedUsers(guildId);

  const embed = new EmbedBuilder()
    .setTitle('🔑 복구키 생성 완료')
    .setDescription(
      '**복구키 (1회용):**\n```\n' + key + '\n```\n\n' +
      '📊 현재 인증된 멤버 수: **' + users.length + '명**\n\n' +
      '⚠️ 이 키는 **1회만** 사용 가능합니다. 안전하게 보관하세요!\n' +
      '`/복구키사용 키:복구키` 명령어로 멤버를 복구할 수 있습니다.'
    )
    .setColor(0x57F287)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleUseRecoveryKey(interaction, db, client) {
  await interaction.deferReply({ ephemeral: true });
  const key = interaction.options.getString('키').trim();
  const targetGuildId = interaction.guild.id;

  const keyData = db.useRecoveryKey(key);
  if (!keyData) {
    return interaction.editReply({ content: '❌ 유효하지 않거나 이미 사용된 복구키입니다.' });
  }

  const verifiedUsers = db.getVerifiedUsers(keyData.guildId);
  if (verifiedUsers.length === 0) {
    return interaction.editReply({ content: '❌ 복구할 인증된 멤버가 없습니다.' });
  }

  const settings = db.getGuildSettings(targetGuildId);
  if (!settings) {
    return interaction.editReply({ content: '❌ 현재 서버에 인증 설정이 없습니다. `/인증창` 먼저 실행하세요.' });
  }

  let successCount = 0;
  let failCount = 0;

  await interaction.editReply({ content: `⏳ ${verifiedUsers.length}명의 멤버를 초대 중입니다...` });

  for (const user of verifiedUsers) {
    try {
      await axios.put(
        `https://discord.com/api/v10/guilds/${targetGuildId}/members/${user.userId}`,
        {
          access_token: user.accessToken,
          roles: [settings.roleId],
        },
        {
          headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      successCount++;
    } catch (err) {
      console.error(`유저 ${user.userId} 초대 실패:`, err.response?.data);
      failCount++;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ 복구 완료')
    .setDescription(
      `**복구 결과:**\n` +
      `✅ 성공: **${successCount}명**\n` +
      `❌ 실패: **${failCount}명**\n\n` +
      `총 ${verifiedUsers.length}명 중 ${successCount}명이 이 서버로 복구되었습니다.`
    )
    .setColor(0x57F287)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

module.exports = {
  handleVerifyPanel,
  handleVerifyButton,
  handleCreateRecoveryKey,
  handleUseRecoveryKey,
};
