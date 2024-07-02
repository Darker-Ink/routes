export type ExtractGenericFromAllowForFunction<T> = {
    [K in keyof T]: T[K] extends AllowForFunction<infer U>
    ? ExtractGenericFromAllowForFunction<U>
    : never;
};

type AllowForFunction<T> = T | ((config: ExtractGenericFromAllowForFunction<Config>) => T);

export interface Config {

    /**
     * The download path (leave as default if you don't know what you're doing)
     */
    downloadPath: string;

    /**
     * Auto reload the config when the file changes
     */
    listenForChanges: boolean;

    /**
     * The github token to use
     */
    githubToken: string;

    /**
     * The repo to target
     */
    repo: {
        /**
         * The repo owner
         */
        owner: string;

        /**
         * The repo name
         */
        name: string;

        /**
         * The branch (head/master for the master branch)
         */
        branch: string;

        /**
         * If the bot should post comments
         */
        postComments: boolean;
    };

    webhooks: {
        url: string;
        send: {
            errors: boolean;
            updates: boolean;
        };
        customMessage: string | null;
        enabled: boolean;
    }[];
}