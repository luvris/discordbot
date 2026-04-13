const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config();

const dataPath = path.join(__dirname, '../data/notes.json');
const ALGORITHM = 'aes-256-cbc';
const SECRET = process.env.TOKEN.substring(0, 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET), iv);
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString();
}

function loadNotes() {
  if (!fs.existsSync(dataPath)) return {};
  const raw = fs.readFileSync(dataPath, 'utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function saveNotes(data) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('จัดการโน้ตส่วนตัวของคุณ')

    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('ดูโน้ตทั้งหมดในหมวดหมู่')
      .addStringOption(opt => opt.setName('category').setDescription('ชื่อหมวดหมู่').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('เพิ่มโน้ตใหม่')
      .addStringOption(opt => opt.setName('category').setDescription('ชื่อหมวดหมู่').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('ชื่อ').setRequired(true))
      .addStringOption(opt => opt.setName('id').setDescription('ไอดี').setRequired(false))
      .addStringOption(opt => opt.setName('password').setDescription('รหัสผ่าน').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('แก้ไขโน้ต')
      .addStringOption(opt => opt.setName('category').setDescription('ชื่อหมวดหมู่').setRequired(true))
      .addIntegerOption(opt => opt.setName('number').setDescription('หมายเลขโน้ต').setRequired(true))
      .addStringOption(opt => opt.setName('name').setDescription('ชื่อใหม่').setRequired(false))
      .addStringOption(opt => opt.setName('id').setDescription('ไอดีใหม่').setRequired(false))
      .addStringOption(opt => opt.setName('password').setDescription('รหัสผ่านใหม่').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('del')
      .setDescription('ลบโน้ต')
      .addStringOption(opt => opt.setName('category').setDescription('ชื่อหมวดหมู่').setRequired(true))
      .addIntegerOption(opt => opt.setName('number').setDescription('หมายเลขโน้ต').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const category = interaction.options.getString('category')?.toLowerCase();
    const userId = interaction.user.id; // ← ดึง ID ของคนที่ใช้คำสั่ง

    const allData = loadNotes();
    if (!allData[userId]) allData[userId] = {};
    const notes = allData[userId]; // ← ข้อมูลเฉพาะของ user นี้

    // ── VIEW ──
    if (sub === 'view') {
      const list = notes[category];
      if (!list || list.length === 0) {
        return interaction.reply({ content: `📭 ยังไม่มีโน้ตในหมวด **${category}**`, flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📒 โน้ต: ${category}`)
        .setColor(0x5865f2)
        .setFooter({ text: `ทั้งหมด ${list.length} รายการ` });

      list.forEach((item, i) => {
        let value = '';
        if (item.id) value += `🪪 ID: \`${item.id}\`\n`;
        if (item.password) value += `🔑 Password: \`${decrypt(item.password)}\``;
        if (!value) value = '_ไม่มีข้อมูลเพิ่มเติม_';
        embed.addFields({ name: `${i + 1}. ${item.name}`, value });
      });

      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ── ADD ──
    if (sub === 'add') {
      const password = interaction.options.getString('password');
      const newItem = {
        name: interaction.options.getString('name'),
        id: interaction.options.getString('id') || null,
        password: password ? encrypt(password) : null,
      };

      if (!notes[category]) notes[category] = [];
      notes[category].push(newItem);
      allData[userId] = notes;
      saveNotes(allData);

      return interaction.reply({
        content:
          `✅ เพิ่มโน้ตในหมวด **${category}** แล้ว!\n` +
          `📌 **${newItem.name}**` +
          (newItem.id ? `\n🪪 ID: \`${newItem.id}\`` : '') +
          (password ? `\n🔑 Password: \`${password}\`` : ''),
        flags: 64,
      });
    }

    // ── EDIT ──
    if (sub === 'edit') {
      const idx = interaction.options.getInteger('number') - 1;
      if (!notes[category]?.[idx]) {
        return interaction.reply({ content: `❌ ไม่พบโน้ตหมายเลข **${idx + 1}**`, flags: 64 });
      }

      const item = notes[category][idx];
      const newName = interaction.options.getString('name');
      const newId = interaction.options.getString('id');
      const newPassword = interaction.options.getString('password');

      if (newName) item.name = newName;
      if (newId) item.id = newId;
      if (newPassword) item.password = encrypt(newPassword);

      allData[userId] = notes;
      saveNotes(allData);

      return interaction.reply({
        content:
          `✏️ แก้ไขโน้ตหมายเลข **${idx + 1}** แล้ว!\n` +
          `📌 **${item.name}**` +
          (item.id ? `\n🪪 ID: \`${item.id}\`` : '') +
          (newPassword ? `\n🔑 Password: \`${newPassword}\`` : ''),
        flags: 64,
      });
    }

    // ── DEL ──
    if (sub === 'del') {
      const idx = interaction.options.getInteger('number') - 1;
      if (!notes[category]?.[idx]) {
        return interaction.reply({ content: `❌ ไม่พบโน้ตหมายเลข **${idx + 1}**`, flags: 64 });
      }
      const deleted = notes[category].splice(idx, 1)[0];
      allData[userId] = notes;
      saveNotes(allData);
      return interaction.reply({ content: `🗑️ ลบ **${deleted.name}** ออกจากหมวด **${category}** แล้ว!`, flags: 64 });
    }
  },
};