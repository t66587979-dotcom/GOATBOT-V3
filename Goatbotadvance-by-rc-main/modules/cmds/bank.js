const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

module.exports = {
    config: {
        name: "bank",
        version: "2.0-premium",
        author: "SaGor",
        role: 0,
        shortDescription: "Banking System",
        longDescription: "Full banking with ATM card generator, multiple designs with professional layout.",
        category: "finance",
        guide: `{pn} - View bank menu
{pn} register - Register account
{pn} balance - Check balance  
{pn} deposit <amount> - Deposit money
{pn} withdraw <amount> - Withdraw money
{pn} history - Transaction history
{pn} card - View ATM card
{pn} send <amount> - 
{pn} account - Account information`
    },
  
    formatMoney(amount) {
        if (isNaN(amount)) return "0";
        amount = Number(amount);
        const scales = [
            { value: 1e15, suffix: 'Q' },
            { value: 1e12, suffix: 'T' },
            { value: 1e9, suffix: 'B' },
            { value: 1e6, suffix: 'M' },
            { value: 1e3, suffix: 'k' }
        ];
        for (let scale of scales) {
            if (amount >= scale.value) {
                let val = amount / scale.value;
                return val % 1 === 0 ? `${val}${scale.suffix}` : `${val.toFixed(2)}${scale.suffix}`;
            }
        }
        return amount.toString();
    },

    generateCardNumber() {
        return "5284 " +
            Math.floor(1000 + Math.random() * 9000) + " " +
            Math.floor(1000 + Math.random() * 9000) + " " +
            Math.floor(1000 + Math.random() * 9000);
    },

    generateCVV() { return Math.floor(100 + Math.random() * 900).toString(); },
    generatePIN() { return Math.floor(1000 + Math.random() * 9000).toString(); },
    getExpiry() {
        const now = new Date();
        return `${now.getMonth() + 1}/${(now.getFullYear() + 4).toString().slice(-2)}`;
    },

    nowISO() {
        return new Date().toISOString();
    },

    cardDesigns: {
        default: {
            gradient: ["#0a0f24", "#16233f", "#1c2b4a"],
            chipColor: "#d4c28f",
            hologramColors: ["#d97c30", "#d9b130"],
        },
        ocean: {
            gradient: ["#004e92", "#000428", "#002f4b"],
            chipColor: "#b5c99a",
            hologramColors: ["#1ca3ec", "#50c9ce"],
        },
        sunset: {
            gradient: ["#ff512f", "#f09819", "#ff7e5f"],
            chipColor: "#ffd700",
            hologramColors: ["#ff4500", "#ff6347"],
        }
    },
  
    async createRealCard(card, username, balance, transactions = [], design = "default") {
        const width = 900, height = 540;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext("2d");
        const d = this.cardDesigns[design] || this.cardDesigns.default;
      
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, d.gradient[0]);
        bg.addColorStop(0.5, d.gradient[1]);
        bg.addColorStop(1, d.gradient[2]);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);
      
        ctx.font = "48px sans-serif";
        ctx.fillStyle = "white";
        ctx.fillText("Premium Bank Wallet", 40, 80);
      
        ctx.fillStyle = d.chipColor;
        ctx.fillRect(40, 160, 120, 80);
        ctx.strokeStyle = "#8d7d47";
        ctx.lineWidth = 3;
        ctx.strokeRect(40, 160, 120, 80);

        ctx.strokeStyle = "#b6a46b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, 190); ctx.lineTo(160, 190);
        ctx.moveTo(40, 210); ctx.lineTo(160, 210);
        ctx.stroke();
      
        ctx.font = "42px monospace";
        ctx.fillStyle = "white";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 10;
        ctx.fillText(card.number, 40, 340);
        ctx.shadowBlur = 0;
      
        ctx.font = "36px sans-serif";
        ctx.fillStyle = "#eeeeee";
        ctx.fillText(username.toUpperCase(), 40, 430);
      
        ctx.font = "28px sans-serif";
        ctx.fillStyle = "#bbbbbb";
        ctx.fillText("VALID THRU", 600, 300);
        ctx.font = "44px monospace";
        ctx.fillStyle = "white";
        ctx.fillText(card.expiry, 600, 350);
      
        ctx.font = "26px sans-serif";
        ctx.fillStyle = "#dddddd";
        ctx.fillText("CVV: *** (Hidden)", 600, 430);
      
        ctx.font = "34px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(`Balance: ${this.formatMoney(balance)} BDT`, 860, 470);
      
        if (transactions.length) {
            const lastTx = transactions[transactions.length - 1];
            const typeSymbol = lastTx.type === "sent" ? "➡️" : "⬅️";
            const amountText = `${this.formatMoney(lastTx.amount)} BDT`;
            const info = `${typeSymbol} ${amountText} ${lastTx.type === "sent" ? "Sent" : "Received"}`;
            ctx.font = "26px sans-serif";
            ctx.fillStyle = "#ffd700";
            ctx.textAlign = "left";
            ctx.fillText(info, 40, 470);
        }
      
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = d.hologramColors[0];
        ctx.beginPath(); ctx.arc(750, 140, 35, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = d.hologramColors[1];
        ctx.beginPath(); ctx.arc(790, 140, 35, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      
        const outputDir = path.join(__dirname, "cache");
        fs.mkdirSync(outputDir, { recursive: true });
        const filePath = path.join(outputDir, `${Date.now()}_card.png`);
        fs.writeFileSync(filePath, canvas.toBuffer());
        return filePath;
    },
  
    async onStart({ message, args, usersData, event }) {
        const uid = event.senderID;
        const action = args[0]?.toLowerCase();
        let data = await usersData.get(uid);
        if (!data.data) data.data = {};
        if (!data.data.bank)
            data.data.bank = {
                balance: 0,
                registered: false,
                card: null,
                transactions: [],
                accountNumber: `GB${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
                createdAt: null,
                savings: 0
            };
        const bank = data.data.bank;
      
        if (action === "register") {
            if (bank.registered) return message.reply("⚠️ You already have a bank account.");
            bank.registered = true;
            bank.balance = 0;
            bank.createdAt = this.nowISO();
            await usersData.set(uid, { data: data.data });

            return message.reply(
`✅ REGISTRATION SUCCESSFUL!
🏦 Premium Digital Bank
📈 Account No: ${bank.accountNumber}
📅 Opened: ${bank.createdAt}`
            );
        }

        if (!bank.registered)
            return message.reply("❌ You don't have a bank account.\nUse: \`bank register\`");
      
        if (action === "balance") {
            return message.reply(`🪙 Your balance: **${this.formatMoney(bank.balance)} BDT**`);
        }
      
        if (action === "card") {
            if (!bank.card) {
                bank.card = {
                    number: this.generateCardNumber(),
                    cvv: this.generateCVV(),
                    pin: this.generatePIN(),
                    expiry: this.getExpiry(),
                };
                await usersData.set(uid, { data: data.data });
            }
            const chosenDesign = args[1]?.toLowerCase() || "default";
            const image = await this.createRealCard(bank.card, data.name || "User", bank.balance, bank.transactions, chosenDesign);
            return message.reply({
                body:
                    "💳 **Your ATM Card**\n\n" +
                    `Card Number: ${bank.card.number}\n` +
                    `Expiry: ${bank.card.expiry}\n` +
                    `PIN: ${bank.card.pin}\n` +
                    `CVV: (Hidden)\n` +
                    `Balance: ${this.formatMoney(bank.balance)} BDT`,
                attachment: fs.createReadStream(image),
            });
        }
      
        if (action === "deposit") {
            const amount = parseFloat(args[1]);
            if (isNaN(amount) || amount <= 0) return message.reply("❌ Enter a valid amount.");
            bank.balance += amount;
            bank.transactions.push({ type: "received", amount, from: "Deposit", time: Date.now() });
            await usersData.set(uid, { data: data.data });
            return message.reply(`✅ Deposited **${this.formatMoney(amount)} BDT**\n💰 New Balance: **${this.formatMoney(bank.balance)} BDT**`);
        }
      
        if (action === "withdraw") {
            const amount = parseFloat(args[1]);
            if (isNaN(amount) || amount <= 0) return message.reply("❌ Enter a valid amount.");
            if (amount > bank.balance) return message.reply("❌ Insufficient balance.");
            bank.balance -= amount;
            bank.transactions.push({ type: "sent", amount, to: "Withdrawal", time: Date.now() });
            await usersData.set(uid, { data: data.data });
            return message.reply(`✅ Withdrew **${this.formatMoney(amount)} BDT**\n💰 New Balance: **${this.formatMoney(bank.balance)} BDT**`);
        }
      
        if (action === "send") {
            const target = args[1];
            const amount = parseFloat(args[2]);
            if (!target) return message.reply("❌ Please specify recipient.");
            if (isNaN(amount) || amount <= 0) return message.reply("❌ Enter valid amount.");
            if (amount > bank.balance) return message.reply("❌ Insufficient balance.");
            let targetData = await usersData.get(target);
            if (!targetData.data) targetData.data = {};
            if (!targetData.data.bank) targetData.data.bank = { balance: 0, registered: false, card: null, transactions: [] };
            if (!targetData.data.bank.registered) return message.reply("❌ Recipient does not have a bank account.");
            bank.balance -= amount;
            targetData.data.bank.balance += amount;
            bank.transactions.push({ type: "sent", amount, to: targetData.name || "User", time: Date.now() });
            targetData.data.bank.transactions.push({ type: "received", amount, from: data.name || "User", time: Date.now() });
            await usersData.set(uid, { data: data.data });
            await usersData.set(target, { data: targetData.data });
            return message.reply(`✅ Sent **${this.formatMoney(amount)} BDT** to ${targetData.name || "User"}.\n💰 New Balance: **${this.formatMoney(bank.balance)} BDT**`);
        }
      
        if (action === "history") {
            let historyText = "📝 TRANSACTION HISTORY\n━━━━━━━━━━━━━━━━━\n";
            if (!bank.transactions.length) {
                historyText += "1. 📥 RECEIVED\n   +$0 | Invalid Date\n   ID: undefined\n";
            } else {
                bank.transactions.slice(-10).reverse().forEach((tx, i) => {
                    const date = tx.time ? new Date(tx.time).toLocaleString() : "Invalid Date";
                    if (tx.type === "received") {
                        historyText += `${i + 1}. 📥 RECEIVED\n   +$${tx.amount} | ${date}\n   ID: ${tx.from || "undefined"}\n`;
                    } else if (tx.type === "sent") {
                        historyText += `${i + 1}. 📤 SENT\n   -$${tx.amount} | ${date}\n   ID: ${tx.to || "undefined"}\n`;
                    }
                });
            }
            return message.reply(historyText);
        }
      
        if (action === "account") {
            return message.reply(
`💳 ACCOUNT INFORMATION

🏦 Premium Digital Bank
━━━━━━━━━━━━━━━━━
👤 Holder: ${data.name || "User"}
📈 Account: ${bank.accountNumber}
💴 Balance: $${bank.balance}
💎 Savings: $${bank.savings || 0}
━━━━━━━━━━━━━━━━━`
            );
        }

        return message.reply("❌ Invalid command.\nUse: bank register | balance | card | deposit | withdraw | send | history | account");
    }
};
