require('dotenv').config(); // JIC

const { request } = require('undici');

class WebhookUtils {
    static async send(title, description, color, footer) {
        await request(process.env.WEBHOOK, {
            body: JSON.stringify({
                embeds: [{
                    title,
                    description,
                    color,
                    footer,
                    timestamp: new Date().toISOString(),
                }]
            }),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    static async stats(msg, title) {
        if (process.env.SEND_STATS === 'true') {
            await this.send(title ?? 'Stats', msg, 0x00FF00);
        }
    }
}

module.exports = WebhookUtils;