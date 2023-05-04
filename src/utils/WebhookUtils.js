require('dotenv').config(); // JIC

const { request } = require('undici');

class WebhookUtils {
    static async send(title, description, color, footer, msg) {
        await request(process.env.WEBHOOK, {
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

    static async stats(msg, title, message) {
        if (process.env.SEND_STATS === 'true') {
            await this.send(title ?? 'Stats', msg, 0x00FF00, {}, message);
        }
    }
}

module.exports = WebhookUtils;
