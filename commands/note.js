const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const crypto = require("node:crypto");
const db = require("../firebase");
require("dotenv").config();

const ALGORITHM = "aes-256-cbc";
const SECRET = process.env.TOKEN.substring(0, 32);

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET), iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);
  return decrypted.toString();
}

async function loadUserNotes(userId) {
  const doc = await db.collection("notes").doc(userId).get();
  return doc.exists ? doc.data() : {};
}

async function saveUserNotes(userId, data) {
  await db.collection("notes").doc(userId).set(data);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("จัดการโน้ตส่วนตัวของคุณ")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("ดูโน้ตทั้งหมดในหมวดหมู่")
        .addStringOption((opt) =>
          opt.setName("category").setDescription("ชื่อหมวดหมู่").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("เพิ่มโน้ตใหม่")
        .addStringOption((opt) =>
          opt.setName("category").setDescription("ชื่อหมวดหมู่").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("name").setDescription("ชื่อ").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("id").setDescription("ไอดี").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("password").setDescription("รหัสผ่าน").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("แก้ไขโน้ต")
        .addStringOption((opt) =>
          opt.setName("category").setDescription("ชื่อหมวดหมู่").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName("number").setDescription("หมายเลขโน้ต").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("name").setDescription("ชื่อใหม่").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("id").setDescription("ไอดีใหม่").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("password").setDescription("รหัสผ่านใหม่").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("del").setDescription("ลบโน้ต (เลือกจาก dropdown)")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const notes = await loadUserNotes(userId);

    // ───────────────────────────── VIEW ─────────────────────────────
    if (sub === "view") {
      const category = interaction.options.getString("category")?.toLowerCase();
      const list = notes[category];
      if (!list || list.length === 0) {
        return interaction.reply({
          content: `📭 ยังไม่มีโน้ตในหมวด **${category}**`,
          flags: 64,
        });
      }
      const embed = new EmbedBuilder()
        .setTitle(`📒 โน้ต: ${category}`)
        .setColor(0x5865f2)
        .setFooter({ text: `ทั้งหมด ${list.length} รายการ` });
      list.forEach((item, i) => {
        let value = "";
        if (item.id) value += `🪪 ID: \`${item.id}\`\n`;
        if (item.password) value += `🔑 Password: \`${decrypt(item.password)}\``;
        if (!value) value = "_ไม่มีข้อมูลเพิ่มเติม_";
        embed.addFields({ name: `${i + 1}. ${item.name}`, value });
      });
      return interaction.reply({ embeds: [embed], flags: 64 });
    }

    // ────────────────────────────── ADD ─────────────────────────────
    if (sub === "add") {
      const category = interaction.options.getString("category")?.toLowerCase();
      const password = interaction.options.getString("password");
      const newItem = {
        name: interaction.options.getString("name"),
        id: interaction.options.getString("id") || null,
        password: password ? encrypt(password) : null,
      };
      if (!notes[category]) notes[category] = [];
      notes[category].push(newItem);
      await saveUserNotes(userId, notes);
      return interaction.reply({
        content:
          `✅ เพิ่มโน้ตในหมวด **${category}** แล้ว!\n` +
          `📌 **${newItem.name}**` +
          (newItem.id ? `\n🪪 ID: \`${newItem.id}\`` : "") +
          (password ? `\n🔑 Password: \`${password}\`` : ""),
        flags: 64,
      });
    }

    // ────────────────────────────── EDIT ────────────────────────────
    if (sub === "edit") {
      const category = interaction.options.getString("category")?.toLowerCase();
      const idx = interaction.options.getInteger("number") - 1;
      if (!notes[category]?.[idx]) {
        return interaction.reply({
          content: `❌ ไม่พบโน้ตหมายเลข **${idx + 1}**`,
          flags: 64,
        });
      }
      const item = notes[category][idx];
      const newName = interaction.options.getString("name");
      const newId = interaction.options.getString("id");
      const newPassword = interaction.options.getString("password");
      if (newName) item.name = newName;
      if (newId) item.id = newId;
      if (newPassword) item.password = encrypt(newPassword);
      await saveUserNotes(userId, notes);
      return interaction.reply({
        content:
          `✏️ แก้ไขโน้ตหมายเลข **${idx + 1}** แล้ว!\n` +
          `📌 **${item.name}**` +
          (item.id ? `\n🪪 ID: \`${item.id}\`` : "") +
          (newPassword ? `\n🔑 Password: \`${newPassword}\`` : ""),
        flags: 64,
      });
    }

    // ────────────────────────────── DEL ─────────────────────────────
    if (sub === "del") {
      const keys = Object.keys(notes);

      // ไม่มี category เลย
      if (keys.length === 0) {
        return interaction.reply({
          content: "📭 ยังไม่มีโน้ตเลยครับ!",
          flags: 64,
        });
      }

      // ขั้นที่ 1: dropdown เลือก category
      const categoryMenu = new StringSelectMenuBuilder()
        .setCustomId("del_category")
        .setPlaceholder("🗂️ เลือก category...")
        .addOptions(
          keys.map((key) => ({
            label: key,
            description: `${notes[key].length} รายการ`,
            value: key,
          }))
        );

      return interaction.reply({
        content: "🗂️ เลือก **category** ที่อยากลบโน้ต:",
        components: [new ActionRowBuilder().addComponents(categoryMenu)],
        flags: 64,
      });
    }
  },

  // ─────────────── HANDLE SELECT MENU & BUTTON ───────────────────
  async handleComponent(interaction) {
    const userId = interaction.user.id;
    const notes = await loadUserNotes(userId);

    // ขั้นที่ 2: เลือก category แล้ว → dropdown รายการ
    if (interaction.customId === "del_category") {
      const category = interaction.values[0];
      const list = notes[category];

      if (!list || list.length === 0) {
        return interaction.update({
          content: `📭 ไม่มีโน้ตในหมวด **${category}** แล้วครับ`,
          components: [],
        });
      }

      const itemMenu = new StringSelectMenuBuilder()
        .setCustomId(`del_item:${category}`)
        .setPlaceholder("📋 เลือกโน้ตที่อยากลบ...")
        .addOptions(
          list.map((item, i) => ({
            label: item.name,
            description: item.id ? `ID: ${item.id}` : "ไม่มี ID",
            value: String(i),
          }))
        );

      return interaction.update({
        content: `📋 เลือก **โน้ต** ที่อยากลบจาก **${category}**:`,
        components: [new ActionRowBuilder().addComponents(itemMenu)],
      });
    }

    // ขั้นที่ 3: เลือกโน้ตแล้ว → ปุ่มยืนยัน/ยกเลิก
    if (interaction.customId.startsWith("del_item:")) {
      const category = interaction.customId.split(":")[1];
      const idx = parseInt(interaction.values[0]);
      const item = notes[category][idx];

      const confirmBtn = new ButtonBuilder()
        .setCustomId(`del_confirm:${category}:${idx}`)
        .setLabel("🗑️ ลบเลย")
        .setStyle(ButtonStyle.Danger);

      const cancelBtn = new ButtonBuilder()
        .setCustomId("del_cancel")
        .setLabel("❌ ยกเลิก")
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        content:
          `⚠️ ยืนยันลบ **${item.name}**` +
          (item.id ? ` (ID: \`${item.id}\`)` : "") +
          ` ออกจากหมวด **${category}** ?`,
        components: [
          new ActionRowBuilder().addComponents(confirmBtn, cancelBtn),
        ],
      });
    }

    // ขั้นที่ 4: กดยืนยัน → ลบจริง
    if (interaction.customId.startsWith("del_confirm:")) {
      const [, category, idxStr] = interaction.customId.split(":");
      const idx = parseInt(idxStr);
      const list = notes[category];
      const deleted = list.splice(idx, 1)[0];
      await saveUserNotes(userId, notes);

      let msg = `🗑️ ลบ **${deleted.name}** ออกจากหมวด **${category}** แล้วครับ!\n\n`;
      if (list.length === 0) {
        msg += `📭 ไม่มีโน้ตเหลือในหมวด **${category}** แล้ว`;
      } else {
        msg += `📋 รายการที่เหลือ (${list.length} รายการ)\n`;
        list.forEach((item, i) => {
          msg += `${i + 1}. **${item.name}**`;
          if (item.id) msg += ` | 🪪 \`${item.id}\``;
          msg += "\n";
        });
      }

      return interaction.update({ content: msg, components: [] });
    }

    // ยกเลิก
    if (interaction.customId === "del_cancel") {
      return interaction.update({
        content: "✅ ยกเลิกแล้วครับ ไม่มีอะไรถูกลบ",
        components: [],
      });
    }
  },
};