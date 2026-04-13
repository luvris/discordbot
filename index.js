const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// โหลด commands ทั้งหมด
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

// บอทพร้อมแล้ว
client.once("ready", () => {
  console.log(`✅ Online! Logged in as ${client.user.tag}`);
});

// รับ interaction ทั้งหมด (รวมในอันเดียว)
client.on("interactionCreate", async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }

    // Select Menu และ Button
    if (interaction.isStringSelectMenu() || interaction.isButton()) {
      const noteCommand = client.commands.get("note");
      if (noteCommand?.handleComponent) {
        await noteCommand.handleComponent(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      const noteCommand = client.commands.get("note");
      if (noteCommand?.handleModal) {
        await noteCommand.handleModal(interaction);
      }
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ เกิดข้อผิดพลาด!", flags: 64 });
    }
  }
});

// Health check server สำหรับ Koyeb
const http = require("http");
http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("OK");
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("Health check server running");
  });

// Register commands อัตโนมัติตอน start
(async () => {
  const commands = [];
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
  }

  const rest = new REST().setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
    body: commands,
  });
  console.log("✅ Commands registered!");
})();

client.login(process.env.TOKEN);
