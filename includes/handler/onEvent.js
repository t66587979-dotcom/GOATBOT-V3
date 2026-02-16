// onEvent.js
const fs = require("fs-extra");
const nullAndUndefined = [undefined, null];
const leven = require('leven');

function getType(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1);
}

function getRole(threadData, senderID) {
    const config = global.GoatBot.config;
    const adminBot = config.adminBot || [];
    const developer = config.developer || [];
    const vipuser = config.vipuser || [];
    
    if (!senderID) return 0;
    const adminBox = threadData ? threadData.adminIDs || [] : [];
    
    if (developer.includes(senderID)) return 4;
    if (adminBot.includes(senderID)) return 3; 
    if (vipuser.includes(senderID)) return 2; 
    if (adminBox.includes(senderID)) return 1;
    return 0;
}

function getText(type, reason, time, targetID, lang) {
    const utils = global.utils;
    if (type == "userBanned") return utils.getText({ lang, head: "handlerOnStart" }, "userBanned", reason, time, targetID);
    else if (type == "threadBanned") return utils.getText({ lang, head: "handlerOnStart" }, "threadBanned", reason, time, targetID);
    else if (type == "onlyAdminBox") return utils.getText({ lang, head: "handlerOnStart" }, "onlyAdminBox");
    else if (type == "onlyAdminBot") return utils.getText({ lang, head: "handlerOnStart" }, "onlyAdminBot");
}

function replaceShortcutInLang(text, prefix, commandName) {
    return text
        .replace(/\{(?:p|prefix)\}/g, prefix)
        .replace(/\{(?:n|name)\}/g, commandName)
        .replace(/\{pn\}/g, `\( {prefix} \){commandName}`);
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
    let roleConfig;
    if (utils.isNumber(command.config.role)) {
        roleConfig = { onStart: command.config.role };
    } else if (typeof command.config.role == "object" && !Array.isArray(command.config.role)) {
        if (!command.config.role.onStart) command.config.role.onStart = 0;
        roleConfig = command.config.role;
    } else {
        roleConfig = { onStart: 0 };
    }

    if (isGroup) roleConfig.onStart = threadData.data.setRole?.[commandName] ?? roleConfig.onStart;

    for (const key of ["onChat", "onStart", "onReaction", "onReply"]) {
        if (roleConfig[key] == undefined) roleConfig[key] = roleConfig.onStart;
    }

    return roleConfig;
}

function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, lang) {
    const config = global.GoatBot.config;
    const { adminBot, developer, vipuser, hideNotiMessage, developerOnly, vipOnly } = config; 
    const role = getRole(threadData, senderID); 

    const infoBannedUser = userData.banned;
    if (infoBannedUser.status == true) {
        const { reason, date } = infoBannedUser;
        if (hideNotiMessage.userBanned == false) message.reply(getText("userBanned", reason, date, senderID, lang));
        return true;
    }

    if (config.adminOnly.enable == true && !adminBot.includes(senderID) && !developer.includes(senderID) && !vipuser.includes(senderID) && !config.adminOnly.ignoreCommand.includes(commandName)) {
        if (hideNotiMessage.adminOnly == false) message.reply(global.utils.getText({ lang, head: "handlerOnStart" }, "onlyAdminBot", null, null, null, lang));
        return true;
    }
    
    if ((developerOnly?.enable == true) && role < 2 && !(developerOnly?.ignoreCommand || []).includes(commandName)) {
        if ((hideNotiMessage.developerOnly ?? false) == false) message.reply(global.utils.getText({ lang, head: "handlerOnStart" }, "onlyVipUserGlobal", null, null, null, lang)); 
        return true;
    }
    
    if ((vipOnly?.enable == true) && role < 2 && !(vipOnly?.ignoreCommand || []).includes(commandName)) {
        if ((hideNotiMessage.vipOnly ?? false) == false) message.reply(global.utils.getText({ lang, head: "handlerOnStart" }, "onlyVipUserGlobal", null, null, null, lang));
        return true;
    }

    if (isGroup) {
        if (threadData.data.onlyAdminBox === true && !threadData.adminIDs.includes(senderID) && !(threadData.data.ignoreCommanToOnlyAdminBox || []).includes(commandName)) {
            if (!threadData.data.hideNotiMessageOnlyAdminBox) message.reply(getText("onlyAdminBox", null, null, null, lang));
            return true;
        }

        const infoBannedThread = threadData.banned;
        if (infoBannedThread.status == true) {
            const { reason, date } = infoBannedThread;
            if (hideNotiMessage.threadBanned == false) message.reply(getText("threadBanned", reason, date, threadID, lang));
            return true;
        }
    }
    return false;
}

function createGetText2(langCode, pathCustomLang, prefix, command) {
    const commandType = command.config.countDown ? "command" : "command event";
    const commandName = command.config.name;
    let customLang = {};
    if (fs.existsSync(pathCustomLang)) customLang = require(pathCustomLang)[commandName]?.text || {};
    
    return function (key, ...args) {
        let lang = command.langs?.[langCode]?.[key] || customLang[key] || "";
        lang = replaceShortcutInLang(lang, prefix, commandName);
        for (let i = args.length - 1; i >= 0; i--) {
            lang = lang.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
        }
        return lang || `❌ Can't find text on language "${langCode}" for \( {commandType} " \){commandName}" with key "${key}"`;
    };
}

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
    return async function (event, message) {
        const { utils, client, GoatBot } = global;
        const { getPrefix, removeHomeDir, log, getTime } = utils;
        const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
        const { autoRefreshThreadInfoFirstTime } = config.database;
        let { hideNotiMessage = {} } = config;

        const { body, messageID, threadID, isGroup } = event;

        if (!threadID) return;

        const senderID = event.userID || event.senderID || event.author;

        let threadData = global.db.allThreadData.find(t => t.threadID == threadID);
        let userData = global.db.allUserData.find(u => u.userID == senderID);

        if (!userData && !isNaN(senderID)) userData = await usersData.create(senderID);

        if (!threadData && !isNaN(threadID)) {
            if (global.temp.createThreadDataError.includes(threadID)) return;
            threadData = await threadsData.create(threadID);
            global.db.receivedTheFirstMessage[threadID] = true;
        } else {
            if (autoRefreshThreadInfoFirstTime === true && !global.db.receivedTheFirstMessage[threadID]) {
                global.db.receivedTheFirstMessage[threadID] = true;
                await threadsData.refreshInfo(threadID);
            }
        }

        if (typeof threadData.settings.hideNotiMessage == "object") hideNotiMessage = threadData.settings.hideNotiMessage;

        const prefix = getPrefix(threadID);
        const role = getRole(threadData, senderID);
        
        // এখানে যোগ করা হয়েছে → এরর ফিক্স
        let isUserCallCommand = false;

        const parameters = {
            api, usersData, threadsData, message, event,
            userModel, threadModel, prefix, dashBoardModel,
            globalModel, dashBoardData, globalData, envCommands,
            envEvents, envGlobal, role,
            removeCommandNameFromBody: function (body_, prefix_, commandName_) {
                if ([body_, prefix_, commandName_].every(x => nullAndUndefined.includes(x))) 
                    throw new Error("Provide body, prefix and commandName");
                for (let i = 0; i < arguments.length; i++) 
                    if (typeof arguments[i] != "string") 
                        throw new Error(`Parameter ${i + 1} must be string`);
                return body_.replace(new RegExp(`^\( {prefix_}(\\s+|) \){commandName_}`, "i"), "").trim();
            }
        };
        const langCode = threadData.data.lang || config.language || "en";

        function createMessageSyntaxError(commandName) {
            message.SyntaxError = async function () {
                return await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "commandSyntaxError", prefix, commandName));
            };
        }

        const { author } = event;

        // onAnyEvent
        let args = [];
        if (typeof event.body == "string" && event.body.startsWith(prefix)) args = event.body.split(/ +/);
        const allOnAnyEvent = GoatBot.onAnyEvent || [];
        for (const key of allOnAnyEvent) {
            if (typeof key !== "string") continue;
            const command = GoatBot.commands.get(key);
            if (!command) continue;
            const commandName = command.config.name;
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            const getText2 = createGetText2(langCode, `\( {process.cwd()}/languages/events/ \){langCode}.js`, prefix, command);
            if (getType(command.onAnyEvent) == "Function") {
                const defaultOnAnyEvent = command.onAnyEvent;
                command.onAnyEvent = async function () { return defaultOnAnyEvent(...arguments); };
            }
            command.onAnyEvent({ ...parameters, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        try {
                            await handler();
                            log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData.name} | ${threadID}`);
                        } catch (err) {
                            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred7", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                            log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err);
                        }
                    }
                })
                .catch(err => log.err("onAnyEvent", `Error in onAnyEvent ${commandName}`, err));
        }

        // onFirstChat
        const allOnFirstChat = GoatBot.onFirstChat || [];
        args = body ? body.split(/ +/) : [];
        for (const itemOnFirstChat of allOnFirstChat) {
            const { commandName, threadIDsChattedFirstTime } = itemOnFirstChat;
            if (threadIDsChattedFirstTime.includes(threadID)) continue;
            const command = GoatBot.commands.get(commandName);
            if (!command) continue;
            itemOnFirstChat.threadIDsChattedFirstTime.push(threadID);
            const getText2 = createGetText2(langCode, `\( {process.cwd()}/languages/cmds/ \){langCode}.js`, prefix, command);
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            if (getType(command.onFirstChat) == "Function") {
                const defaultOnFirstChat = command.onFirstChat;
                command.onFirstChat = async function () { return defaultOnFirstChat(...arguments); };
            }
            command.onFirstChat({ ...parameters, isUserCallCommand, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;
                        try {
                            await handler();
                            log.info("onFirstChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
                        } catch (err) {
                            await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                        }
                    }
                })
                .catch(err => log.err("onFirstChat", `Error in onFirstChat ${commandName}`, err));
        }

        // onChat
        const allOnChat = GoatBot.onChat || [];
        args = body ? body.split(/ +/) : [];
        for (const key of allOnChat) {
            const command = GoatBot.commands.get(key);
            if (!command) continue;
            const commandName = command.config.name;
            const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
            const needRole = roleConfig.onChat;
            if (needRole > role) continue;
            const getText2 = createGetText2(langCode, `\( {process.cwd()}/languages/cmds/ \){langCode}.js`, prefix, command);
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            if (getType(command.onChat) == "Function") {
                const defaultOnChat = command.onChat;
                command.onChat = async function () { return defaultOnChat(...arguments); };
            }
            command.onChat({ ...parameters, isUserCallCommand, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;
                        try {
                            await handler();
                            log.info("onChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
                        } catch (err) {
                            await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                        }
                    }
                })
                .catch(err => log.err("onChat", `Error in onChat ${commandName}`, err));
        }

        // handlerEvent
        const allEventCommand = GoatBot.eventCommands.entries();
        for (const [key] of allEventCommand) {
            const getEvent = GoatBot.eventCommands.get(key);
            if (!getEvent) continue;
            const commandName = getEvent.config.name;
            const getText2 = createGetText2(langCode, `\( {process.cwd()}/languages/events/ \){langCode}.js`, prefix, getEvent);
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            try {
                const handler = await getEvent.onStart({ ...parameters, commandName, getLang: getText2 });
                if (typeof handler == "function") {
                    await handler();
                    log.info("EVENT COMMAND", `Event: ${commandName} | ${author} | ${userData.name} | ${threadID}`);
                }
            } catch (err) {
                log.err("EVENT COMMAND", `Error in event command ${commandName}`, err);
                await message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred5", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
            }
        }

        // onEvent
        const allOnEvent = GoatBot.onEvent || [];
        args = [];
        for (const key of allOnEvent) {
            if (typeof key !== "string") continue;
            const command = GoatBot.commands.get(key);
            if (!command) continue;
            const commandName = command.config.name;
            const time = getTime("DD/MM/YYYY HH:mm:ss");
            createMessageSyntaxError(commandName);
            const getText2 = createGetText2(langCode, `\( {process.cwd()}/languages/events/ \){langCode}.js`, prefix, command);
            if (getType(command.onEvent) == "Function") {
                const defaultOnEvent = command.onEvent;
                command.onEvent = async function () { return defaultOnEvent(...arguments); };
            }
            command.onEvent({ ...parameters, args, commandName, getLang: getText2 })
                .then(async (handler) => {
                    if (typeof handler == "function") {
                        try {
                            await handler();
                            log.info("onEvent", `${commandName} | ${author} | ${userData.name} | ${threadID}`);
                        } catch (err) {
                            message.reply(utils.getText({ lang: langCode, head: "handlerOnStart" }, "errorOccurred6", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                            log.err("onEvent", `Error in onEvent ${commandName}`, err);
                        }
                    }
                })
                .catch(err => log.err("onEvent", `Error in onEvent ${commandName}`, err));
        }

        // placeholder functions
        async function presence() { /* Your code here */ }
        async function read_receipt() { /* Your code here */ }
        async function typ() { /* Your code here */ }

        await presence();
        await read_receipt();
        await typ();
    };
};
