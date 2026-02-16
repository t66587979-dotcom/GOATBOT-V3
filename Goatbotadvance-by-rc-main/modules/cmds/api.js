const axios = require("axios");
const qs = require("qs");

module.exports = {
  config: {
    name: "api",
    version: "1.0",
    author: "ＳＡＧＯＲ",
    role: 0,
    usePrefix: false,
    description: "API tester (GET/POST) with headers, params, auto JSON)",
    guide: `
/apitest get <url> [param:key=value&key2=value2]
/apitest post <url> <body> [header:Key=Value&Key2=Value2]`,
    category: "utility",
    cooldowns: 5
  },

  onStart: async function({ api, event, args }) {
    const method = args[0]?.toLowerCase();
    const url = args[1];
    const rest = args.slice(2).join(" ").trim();

    if (!method || !url) {
      return api.sendMessage(
        "Usage:\n/apitest get <url> [params]\n/apitest post <url> <body> [headers]",
        event.threadID,
        event.messageID
      );
    }

    let data = {};
    let headers = {};
    let params = {};

    try {
      const paramMatch = rest.match(/param:(.+)/);
      if (paramMatch) {
        params = qs.parse(paramMatch[1], { delimiter: "&" });
      }
            
      const headerMatch = rest.match(/header:(.+)/);
      if (headerMatch) {
        const h = qs.parse(headerMatch[1], { delimiter: "&" });
        headers = h;
      }
            
      if (method === "post") {
        const bodyPart = rest.replace(/header:.+/, "").trim();
        if (bodyPart) {
          try {
            data = JSON.parse(bodyPart);
          } catch {
            data = qs.parse(bodyPart, { delimiter: "&" });
          }
        }
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
      }

      let res;
      if (method === "get") {
        res = await axios.get(url, { params, headers });
      } else if (method === "post") {
        res = await axios.post(url, data, { headers, params });
      } else {
        return api.sendMessage(
          "❌ Only GET and POST supported",
          event.threadID,
          event.messageID
        );
      }

      const reply = JSON.stringify(res.data, null, 2);
      if (reply.length > 19000) {
        return api.sendMessage(
          "✅ Response too long. Use pastebin: [example.com/paste]",
          event.threadID,
          event.messageID
        );
      }

      return api.sendMessage(reply, event.threadID, event.messageID);
    } catch (err) {
      const errorMsg = err.response
        ? `HTTP ${err.response.status} ${err.response.statusText}\n${JSON.stringify(err.response.data, null, 2)}`
        : err.message;
      return api.sendMessage("❌ Error:\n" + errorMsg, event.threadID, event.messageID);
    }
  }
};
