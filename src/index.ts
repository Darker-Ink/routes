import path from "path";
import downloader from "./utils/downloader.ts";
import { Config } from "./utils/defineConfig.ts";
import cleaner from "./utils/cleaner.ts";
import walk from "./utils/walk.ts";

if (!(await Bun.file(path.join(import.meta.dirname, "./config.ts")).exists())) {
    console.log("Config file not found, we've created one for you. Please fill it out and restart.")

    await Bun.write(path.join(import.meta.dirname, "./config.ts"), `import { defineConfig } from "./utils/defineConfig.ts";

export default defineConfig({
    webhooks: [],
    githubToken: "",
    listenForChanges: true,
    repo: {
        owner: "Discord-Datamining",
        name: "Discord-Datamining",
        branch: "head/master",
        postComments: false
    },
    downloadPath: "https://raw.githubusercontent.com/Darker-Ink/endpoint-downloader/master/currentRoutes.js"
})`)

    process.exit(1);
}


const config = (await import(path.join(import.meta.dirname, "./config.ts"))).default as Config

const downloaded = await downloader(config.config.downloadPath);
const cleaned = await cleaner(downloaded);
// const walked = await walk(cleaned);

console.log(cleaned)

// console.log(walked);