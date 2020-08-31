"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const checks_1 = require("./checks");
const repo_1 = require("./repo");
const ansi_colors_1 = require("ansi-colors");
const yargs_1 = __importDefault(require("yargs"));
if (!yargs_1.default.argv.token && !process.env.GITHUB_TOKEN) {
    console.error(ansi_colors_1.red(`ERROR: You need a github token to use this because of rate limits!`));
    console.error(ansi_colors_1.red(`Please pass one with the argument --token=${ansi_colors_1.bold("<your-token>")} or the GITHUB_TOKEN environment variable`));
    process.exit(1);
}
async function main() {
    const repos = await repo_1.readLatestRepo();
    const maxAdapterNameLength = Math.max(...[...repos.keys()].map(key => key.length));
    async function checkRepo(adapterName, repo) {
        var _a;
        const ref = Object.assign(Object.assign({}, repo), { ref: "master" });
        let logMessage = (adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";
        const adapterUrl = `https://github.com/${repo.owner}/${repo.repo}`;
        let result;
        try {
            result = (_a = (await checks_1.getCommitStatus(ref))) !== null && _a !== void 0 ? _a : (await checks_1.getCheckStatus(ref));
        }
        catch (e) {
            logMessage += ansi_colors_1.red("[FAIL] Could not load Github repo!");
            logMessage += `\n· ${adapterUrl}`;
            return logMessage;
        }
        if (result) {
            if (result.status === "failure") {
                logMessage += ansi_colors_1.red("[FAIL]");
                let hasLink = false;
                if (result.checks.length) {
                    for (const { status, url } of result.checks) {
                        if (status === "failure") {
                            hasLink = true;
                            logMessage += `\n· ${ansi_colors_1.red("[FAIL]")} ${url}`;
                        }
                    }
                }
                if (!hasLink) {
                    logMessage += `\n· ${adapterUrl}`;
                }
            }
            else if (result.status === "success") {
                logMessage += ansi_colors_1.green("[SUCCESS]");
            }
            else if (result.status === "pending") {
                logMessage += ansi_colors_1.yellow("[PENDING]");
                logMessage += `\n· ${adapterUrl}`;
            }
        }
        else {
            logMessage += ansi_colors_1.yellow("[WARN] No CI detected or CI not working!");
            logMessage += `\n· ${adapterUrl}`;
        }
        return logMessage;
    }
    // Execute some requests in parallel
    const concurrency = 10;
    const pools = [];
    const all = [...repos];
    while (all.length > 0) {
        pools.push(all.splice(0, concurrency));
    }
    for (const pool of pools) {
        const tasks = pool.map(([adapterName, repo]) => checkRepo(adapterName, repo));
        const lines = await Promise.all(tasks);
        for (const line of lines)
            console.log(line);
    }
}
main();
process.on("uncaughtException", err => {
    console.error(err);
});
process.on("unhandledRejection", r => {
    throw r;
});
