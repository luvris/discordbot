const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('ตอบกลับ Pong! พร้อม latency'),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`🏓 Pong! Latency: **${latency}ms**`);
  },
};