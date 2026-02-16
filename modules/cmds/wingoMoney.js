module.exports = {
  config: {
    name: "wingoMoney",
    aliases: ["wingo", "wg"],
    version: "1.8.0",
    author: "SaGor",
    role: 0,
    category: "game",
    shortDescription: "Wingo betting game",
    usages: "wg daily | wg bet <amount> <red/green/big/small> | wg leaderboard"
  },

  onStart: async function ({ api, event, args, prefix, usersData }) {
    const userID = event.senderID;
    let user = await usersData.get(userID) || {};
    if (typeof user.money !== "number") user.money = 0;
    
    const styleText = (text) => {
      const bold = { 
        "A":"𝗔","B":"𝗕","C":"𝗖","D":"𝗗","E":"𝗘","F":"𝗙","G":"𝗚","H":"𝗛","I":"𝗜","J":"𝗝","K":"𝗞","L":"𝗟","M":"𝗠",
        "N":"𝗡","O":"𝗢","P":"𝗣","Q":"𝗤","R":"𝗥","S":"𝗦","T":"𝗧","U":"𝗨","V":"𝗩","W":"𝗪","X":"𝗫","Y":"𝗬","Z":"𝗭",
        "a":"𝗮","b":"𝗯","c":"𝗰","d":"𝗱","e":"𝗲","f":"𝗳","g":"𝗴","h":"𝗵","i":"𝗶","j":"𝗷","k":"𝗸","l":"𝗹","m":"𝗺",
        "n":"𝗻","o":"𝗼","p":"𝗽","q":"𝗾","r":"𝗿","s":"𝘀","t":"𝘁","u":"𝘂","v":"𝘃","w":"𝘄","x":"𝘅","y":"𝘆","z":"𝘇",
        "0":"𝟬","1":"𝟭","2":"𝟮","3":"𝟯","4":"𝟰","5":"𝟱","6":"𝟲","7":"𝟳","8":"𝟴","9":"𝟵",
        ".":"∙","$":"$"
      };
      return text.split("").map(c => bold[c] || c).join("");
    };
    
    const formatMoney = (n) => {
      let str;
      if (n >= 1_000_000) str = (n / 1_000_000).toFixed(2) + "M$";
      else if (n >= 1_000) str = (n / 1_000).toFixed(2) + "K$";
      else str = n + "$";
      return styleText(str);
    };
    
    if (args[0] === "daily") {
      if (Date.now() - (user.lastDaily || 0) < 86400000)
        return api.sendMessage(styleText("⏳ Daily already claimed!"), event.threadID);

      user.money += 100;
      user.lastDaily = Date.now();
      await usersData.set(userID, user);

      return api.sendMessage(
        styleText(`🎁 Daily Reward: +100$\n💳 Balance: ${formatMoney(user.money)} (${styleText(user.money+"$")})`),
        event.threadID
      );
    }
    
    if (args[0] === "leaderboard") {
      const all = await usersData.getAll();
      const list = all
        .filter(u => typeof u.data?.money === "number")
        .sort((a, b) => b.data.money - a.data.money)
        .slice(0, 10);

      let msg = styleText("🏆 Wingo Leaderboard 🏆\n\n");
      list.forEach((u, i) => {
        msg += styleText(`${i + 1}. ${u.userID} → ${formatMoney(u.data.money)}\n`);
      });

      return api.sendMessage(msg, event.threadID);
    }
    
    if (args[0] === "bet") {
      const amount = Number(args[1]);
      const option = args[2];

      if (!amount || amount <= 0)
        return api.sendMessage(
          styleText(`❌ Invalid amount!\nUsage: ${prefix}wg bet <amount> <red/green/big/small>`),
          event.threadID
        );

      if (!["red", "green", "big", "small"].includes(option))
        return api.sendMessage(styleText("❌ Invalid option!"), event.threadID);

      if (user.money < amount)
        return api.sendMessage(
          styleText(`❌ Not enough balance!\n💳 Balance: ${formatMoney(user.money)}`),
          event.threadID
        );

      user.money -= amount;
      await usersData.set(userID, user);

      api.sendMessage(styleText("🎰 Wingo started...\n⏳ Wait 5 seconds"), event.threadID, async (err, info) => {
        if (err) return;

        setTimeout(async () => {
          const num = Math.floor(Math.random() * 10);
          const color =
            [1, 3, 7, 9].includes(num) ? "RED" :
            [2, 4, 6, 8].includes(num) ? "GREEN" : "VIOLET";
          const size = num >= 5 ? "BIG" : "SMALL";

          let resultMsg = styleText("┏━━━━━🎯 Result ━━━━━┓\n");
          resultMsg += styleText(`┃ 🔢 Number: ${num}\n`);
          resultMsg += styleText(`┃ 🎨 Color: ${color}\n`);
          resultMsg += styleText(`┃ 📏 Size: ${size}\n`);
          resultMsg += styleText("┃\n");

          const win = option === color.toLowerCase() || option === size.toLowerCase();
          if (win) {
            user.money += amount * 2;
            resultMsg += styleText(`┃ 🎉 You Win! ${amount}\n`);
            resultMsg += styleText(`┃ 💳 Balance: ${formatMoney(user.money)} (${user.money}$)\n`);
          } else {
            resultMsg += styleText(`┃ 😢 You Lose! ${amount}\n`);
            resultMsg += styleText(`┃ 💳 Balance: ${formatMoney(user.money)} (${user.money}$)\n`);
          }

          resultMsg += styleText("┗━━━━━━━━━━━━━━━━━┛");

          await usersData.set(userID, user);
          api.editMessage(resultMsg, info.messageID, event.threadID);
        }, 5000);
      });

      return;
    }
    
    return api.sendMessage(
      styleText(
        `🎰 Wingo Menu\n\n` +
        `${prefix}wg daily\n` +
        `${prefix}wg bet <amount> <red/green/big/small>\n` +
        `${prefix}wg leaderboard`
      ),
      event.threadID
    );
  }
};
