const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const { configCommands } = global.GoatBot;
const { log } = global.utils;

function getDomain(url) {
    const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function isURL(str) {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    config: {
        name: "cmd",
        version: "1.1",
        author: "Rx Abdullah (fixed for auto-loader)",
        countDown: 5,
        role: 2,
        category: "owner",
        description: { en: "Install & manage commands (with replace on exist)" },
        guide: {
            en: "{pn} install <url> <file.js>\n" +
                "{pn} install <file.js> <code>\n" +
                "→ If file exists → react ✅ to replace & load"
        }
    },

    onStart: async function ({ api, args, message, event, getLang }) {
        const prefix = global.GoatBot.config.prefix || ".";
        const commandName = this.config.name;

        if (!args[0] || args[0].toLowerCase() === "help") {
            return message.reply(
                "📦 CMD Manager (Updated)\n\n" +
                `• ${prefix}cmd install <url> <file.js> → From URL\n` +
                `• ${prefix}cmd install <file.js> <code> → Direct code\n` +
                "If file already exists → React to message with 👍 to overwrite & reload."
            );
        }

        if (args[0].toLowerCase() !== "install") {
            return message.reply("Use: cmd install <url/code> <file.js>\nType cmd help for details.");
        }

        let urlOrCode = args[1];
        let fileName = args[2];
        let rawCode = "";

        if (!urlOrCode || !fileName) {
            return message.reply("Missing URL/code or file name.\nExample: cmd install https://pastebin.com/raw/abc admin.js");
        }

        // Swap if first arg is file.js and second is code/url
        if (urlOrCode.endsWith(".js") && !isURL(urlOrCode)) {
            const tmp = fileName;
            fileName = urlOrCode;
            urlOrCode = tmp;
        }

        const cmdsPath = path.join(process.cwd(), "modules", "cmds");
        const fullPath = path.join(cmdsPath, fileName);

        // URL থেকে code নেয়া
        if (isURL(urlOrCode)) {
            let url = urlOrCode;
            const domain = getDomain(url);

            if (domain === "pastebin.com") {
                url = url.replace(/pastebin\.com\/(?!raw\/)/, "pastebin.com/raw/");
            } else if (domain === "github.com") {
                url = url.replace(/github\.com\/(.*)\/blob\//, "raw.githubusercontent.com/$1/");
            }

            try {
                const res = await axios.get(url);
                rawCode = res.data;

                if (domain === "savetext.net" || domain.includes("paste")) { // cheerio for some paste sites
                    const $ = cheerio.load(rawCode);
                    rawCode = $("#content").text() || rawCode;
                }
            } catch (err) {
                return message.reply(`Failed to fetch code from URL.\nError: ${err.message}`);
            }
        } else {
            // Direct code from message body
            rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length + 1).trim();
            if (!rawCode) rawCode = urlOrCode; // fallback
        }

        if (!rawCode) {
            return message.reply("No valid code found from URL or message.");
        }

        // File already exists → confirm replace
        if (fs.existsSync(fullPath)) {
            return message.reply(`⚠️ File already exists: ${fileName}\nReact with 👍 to overwrite & reload.`, (err, info) => {
                if (err) return;
                global.GoatBot.onReaction.set(info.messageID, {
                    commandName: commandName,
                    messageID: info.messageID,
                    type: "replace_confirm",
                    author: event.senderID,
                    data: { fileName, rawCode, fullPath }
                });
            });
        }

        // New file → direct save & load attempt
        try {
            fs.writeFileSync(fullPath, rawCode, "utf8");
            const loaded = await tryReloadCommand(fileName);
            return message.reply(loaded.success ?
                `✅ Installed & loaded: ${fileName}\nPath: ${fullPath.replace(process.cwd(), "")}` :
                `✅ Saved but reload failed: ${fileName}\nRestart bot to use.\nError: ${loaded.error || "Unknown"}`
            );
        } catch (err) {
            return message.reply(`❌ Install failed: ${err.message}`);
        }
    },

    onReaction: async function ({ Reaction, event, api, message }) {
        const { author, data: { fileName, rawCode, fullPath }, type } = Reaction;
        if (event.userID !== author || event.reaction !== "✅") return;

        if (type !== "replace_confirm") return;

        try {
            fs.writeFileSync(fullPath, rawCode, "utf8");
            const loaded = await tryReloadCommand(fileName);
            message.reply(loaded.success ?
                `✅ Replaced & reloaded: ${fileName}` :
                `✅ Replaced but reload failed: ${fileName}\nRestart bot.\nError: ${loaded.error || "Unknown"}`
            );
        } catch (err) {
            message.reply(`❌ Replace failed: ${err.message}`);
        }

        // Clean reaction
        global.GoatBot.onReaction.delete(Reaction.messageID);
    }
};

// Helper: Try to reload command without full restart (dynamic require)
async function tryReloadCommand(fileName) {
    const cmdsPath = path.join(process.cwd(), "modules", "cmds");
    const fullPath = path.join(cmdsPath, fileName);

    try {
        // Delete old cache
        delete require.cache[require.resolve(fullPath)];

        const cmdModule = require(fullPath);
        const cmdName = cmdModule.config?.name?.toLowerCase();

        if (!cmdName) throw new Error("No config.name in command");

        // Update GoatBot.commands map
        global.GoatBot.commands.set(cmdName, cmdModule);

        // Aliases update if any
        if (cmdModule.config?.aliases) {
            for (const alias of cmdModule.config.aliases) {
                global.GoatBot.aliases.set(alias, cmdName);
            }
        }

        // Optional: call onLoad if exists
        if (cmdModule.onLoad) {
            await cmdModule.onLoad({ api: global.api || {}, ...global }); // approximate params
        }

        return { success: true };
    } catch (err) {
        console.error(`Reload failed for ${fileName}:`, err);
        return { success: false, error: err.message };
    }
                           }
