const fs = require('fs');
const path = require('path');

module.exports = {
    config: {
        name: "file",
        aliases: ["files"],
        version: "3.0",
        author: "𝗦𝗔𝗚𝗢𝗥",
        countDown: 3,
        role: 0,
        shortDescription: "bot file",
        longDescription: "Send bot file from cmds",
        category: "owner",
        guide: "{pn} <filename>"
    },

    onStart: async function ({ message, args, api, event }) {

        const permission = [
            "61581197276223",
            "",
            "",
            ""

        ];

        if (!permission.includes(event.senderID)) {
            return api.sendMessage(
                "❌ **Access Denied!**\ntor marechudi tui admin na!🤬",
                event.threadID,
                event.messageID
            );
        }

        if (!args[0]) {
            return api.sendMessage(
                "⚠️ **File name missing!**\n\nUse:\n> `file <name>`",
                event.threadID,
                event.messageID
            );
        }

        const fileName = args[0].trim();
        const possibleExtensions = [".js", ".json", ".txt"];
        let filePath = null;

        for (let ext of possibleExtensions) {
            let check = path.join(__dirname, fileName + ext);
            if (fs.existsSync(check)) filePath = check;
        }

        if (!filePath) {
            const cmds = path.join(process.cwd(), "cmds");
            for (let ext of possibleExtensions) {
                let check = path.join(cmds, fileName + ext);
                if (fs.existsSync(check)) filePath = check;
            }
        }

        if (!filePath) {
            return api.sendMessage(
                `❌ **File Not Found:** \`${fileName}\`\n\nPossible Extensions: .js .json .txt`,
                event.threadID,
                event.messageID
            );
        }

        try {
            const fileContent = fs.readFileSync(filePath, "utf8");
            const fileBase = path.basename(filePath);

            const styledText =
`╭─────────────────╮
│ 📄 𝗕𝗼𝘁 𝗦𝗼𝘂𝗿𝗰𝗲 𝗩𝗶𝗲𝘄𝗲𝗿
╰─────────────────╯
🔹 **File:** ${fileBase}
🔹 **Path:** ${filePath}

${fileContent}
            `;

            api.sendMessage(styledText, event.threadID);

        } catch (err) {
            api.sendMessage(
                "❌ **Error reading file!**\nCheck file permission or path.",
                event.threadID,
                event.messageID
            );
        }
    }
};
