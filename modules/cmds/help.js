/**
 * ================================
 *  Author  : SAGOR
 *  Note    : Coded with ➲ by SAGOR
 * ================================
 */

const { getPrefix } = global.utils;
const { commands } = global.GoatBot;

module.exports = {
  config: {
    name: "help",
    version: "3.5",
    author: "SaGor",
    usePrefix: false,
    role: 0,
    category: "info",
    priority: 1
  },

  onStart: async function ({ message, args, event, role }) {
    const prefix = getPrefix(event.threadID);
    const arg = args[0]?.toLowerCase();

    if (!arg) {
      const listByCategory = {};
      Array.from(commands.entries())
        .filter(([_, cmd]) => cmd.config.role <= role)
        .forEach(([name, cmd]) => {
          const cat = cmd.config.category || "Uncategorized";
          if (!listByCategory[cat]) listByCategory[cat] = [];
          listByCategory[cat].push(name);
        });

      let msg = "";
      for (let cat in listByCategory) {
        msg += `\n${cat.toUpperCase()}\n`;
        listByCategory[cat].forEach(cmd => msg += `• ${cmd}\n`);
      }
      return message.reply(msg.trim());
    }

    const cmd = commands.get(arg) || commands.get(global.GoatBot.aliases.get(arg));
    if (!cmd || cmd.config.role > role) return message.reply(`✘ Command "${arg}" not found.`);

    const info = cmd.config;
    let msg = `╭─❖🌟 ${info.name.toUpperCase()} 🌟❖─╮\n\n`;
    msg += `👑 Author  : ${info.author}\n`;
    msg += `⚙️ Version : ${info.version}\n`;
    msg += `📂 Category: ${info.category}\n`;
    msg += `🕒 Cooldown: ${info.countDown || info.cooldowns || 3}s\n`;
    msg += `🎯 Role    : ${info.role}\n`;
    msg += `💬 Desc    : ${info.shortDescription || info.description || "No description"}\n`;
    msg += `💡 Usage   : ${prefix}${info.guide?.en || info.usages || info.name}\n`;
    msg += info.aliases?.length ? `🔁 Aliases : ${info.aliases.join(", ")}\n` : "";
    msg += `\n╰────────• 🌸 •──────────╯`;
    return message.reply(msg);
  }
};
