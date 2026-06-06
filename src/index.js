require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const commands = require('./commands');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

async function registerCommands() {
  try {
    const slashCommands = [
      new SlashCommandBuilder()
        .setName('인증창')
        .setDescription('인증 패널을 현재 채널에 설치합니다')
        .addRoleOption(option =>
          option.setName('역할')
            .setDescription('인증 후 부여할 역할')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('웹훅')
            .setDescription('인증 로그를 받을 웹훅 URL')
            .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
        .setName('복구키만들기')
        .setDescription('서버 복구를 위한 1회용 복구키를 생성합니다')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

      new SlashCommandBuilder()
        .setName('복구키사용')
        .setDescription('복구키를 사용하여 인증된 멤버를 현재 서버로 초대합니다')
        .addStringOption(option =>
          option.setName('키')
            .setDescription('복구키를 입력하세요')
            .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    ].map(cmd => cmd.toJSON());

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: slashCommands });
    console.log('✅ 슬래시 명령어 등록 완료');
  } catch (error) {
    console.error('명령어 등록 실패:', error);
  }
}

client.once('ready', async () => {
  console.log(`✅ 봇 로그인: ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === '인증창') {
      await commands.handleVerifyPanel(interaction, db);
    } else if (interaction.commandName === '복구키만들기') {
      await commands.handleCreateRecoveryKey(interaction, db);
    } else if (interaction.commandName === '복구키사용') {
      await commands.handleUseRecoveryKey(interaction, db, client);
    }
  }

  if (interaction.isButton() && interaction.customId === 'verify_button') {
    await commands.handleVerifyButton(interaction, db);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
