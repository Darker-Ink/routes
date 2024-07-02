import { request } from "undici"

const downloader = async (path: string): Promise<string> => {
    const res = await request(path);

    if (res.statusCode !== 200) {
        throw new Error(`Failed to download file: ${res.statusCode}`);
    }

    return res.body.text();
}

export default downloader;