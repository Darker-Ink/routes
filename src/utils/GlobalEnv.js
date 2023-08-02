const { request } = require('undici');
const cheerio = require('cheerio');
const url = "https://discord.com/login";

const GetGlobalEnv = async () => {
    const { body } = await request(url);
    const text = await body.text();
    const $ = cheerio.load(text);
    const scripts = $('script');

    for (let i = 0; i < scripts.length; i++) {
        const script = scripts[i];
        const scriptText = $(script).html();

        if (scriptText.includes('window.GLOBAL_ENV')) {
            if (scriptText.includes("RELEASE_CHANNEL: 'stable'")) {
                return scriptText;
            }
        }
    }
}

module.exports = GetGlobalEnv;