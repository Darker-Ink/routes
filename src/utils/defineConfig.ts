import type { Config as ConfigType, ExtractGenericFromAllowForFunction } from "../types/Config.ts";
import { FSWatcher, watch } from "chokidar"
import { join } from "node:path"

type Listeners = "configChange";

export class Config {

    private _listeners: Map<string, Function[]> = new Map();

    private rawConfig: ExtractGenericFromAllowForFunction<ConfigType>;

    #watcher: FSWatcher | null = null;

    constructor(config: ExtractGenericFromAllowForFunction<ConfigType>) {
        this.rawConfig = config;

        if (this.rawConfig.listenForChanges) {
            this.watchForChanges();
        }
    }


    public on(event: Listeners, listener: Function) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }

        this._listeners.get(event)?.push(listener);
    }

    private emit(event: Listeners, ...args: any[]) {
        if (!this._listeners.has(event)) {
            return;
        }

        for (const listener of this._listeners.get(event)!) {
            listener(...args);
        }
    }

    get config() {
        return this.rawConfig;
    }

    watchForChanges() {
        if (this.rawConfig.listenForChanges) {
            const path = join(import.meta.dirname, `../../config.ts`);

            this.#watcher = watch(path)

            this.#watcher.on("change", async () => {
                console.log("Config file changed, reloading...");

                try {
                    const { default: newConfig } = await import(`${path}?${Date.now()}`) as { default: ExtractGenericFromAllowForFunction<ConfigType> };
    
                    if (!newConfig) {
                        console.log("Failed to reload config, skipping...");
    
                        return;
                    }
    
                    this.emit("configChange", newConfig, this.config);
                    
                    this.rawConfig = newConfig;
    
                    console.log("Config reloaded!");
    
                    if (!this.rawConfig.listenForChanges) {
                        console.log("Config no longer listens for changes, stopping watcher...");
    
                        this.#watcher?.close();
                    }
                } catch {
                    console.log("Failed to reload config, skipping...");
                }
            });
        }
    }
}

let initialized = false;

export const defineConfig = (config: ConfigType): Config => {

    let currentConfig: Partial<ExtractGenericFromAllowForFunction<ConfigType>> = {

    };

    for (const [key, value] of Object.entries(config)) {
        if (typeof value === "function") {
            currentConfig[key as keyof ConfigType] = value(currentConfig);
        } else {
            currentConfig[key as keyof ConfigType] = value;
        }
    }

    if (!initialized) {
        initialized = true;
        
        return new Config(currentConfig as ExtractGenericFromAllowForFunction<ConfigType>);
    }

    // @ts-expect-error -- Its fine
    return currentConfig as ExtractGenericFromAllowForFunction<ConfigType>;
};

export default defineConfig;