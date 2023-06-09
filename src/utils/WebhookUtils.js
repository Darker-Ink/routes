const { request } = require('undici');
const config = require('./ConfigManager').getConfig();

const SendHooks = config.Webhooks.filter((hook) => hook.send.enabled && !hook.send.plain);

class WebhookUtils {
    static async send(title, description, color, footer, msg) {
        for (const hook of SendHooks) {
            await request(hook.url, {
                body: JSON.stringify({
                    embeds: [{
                        title,
                        description,
                        color,
                        footer,
                        timestamp: new Date().toISOString(),
                    }],
                    content: msg
                }),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
        }
    }

    static async stats(msg, title, message) {
        await this.send(title ?? 'Stats', msg, 0x00FF00, {}, message);
    }
}

module.exports = WebhookUtils;
