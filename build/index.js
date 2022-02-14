"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const checks_1 = require("./checks");
const repo_1 = require("./repo");
const ansi_colors_1 = require("ansi-colors");
const yargs_1 = __importDefault(require("yargs"));
const async_1 = require("alcalzone-shared/async");
if (!yargs_1.default.argv.token && !process.env.GITHUB_TOKEN) {
    console.error((0, ansi_colors_1.red)(`ERROR: You need a github token to use this because of rate limits!`));
    console.error((0, ansi_colors_1.red)(`Please pass one with the argument --token=${(0, ansi_colors_1.bold)("<your-token>")} or the GITHUB_TOKEN environment variable`));
    process.exit(1);
}
async function main() {
    const repos = await (0, repo_1.readLatestRepo)();
    const maxAdapterNameLength = Math.max(...[...repos.keys()].map((key) => key.length));
    async function checkRepo(adapterName, repo) {
        var _a, _b, _c;
        const ref = Object.assign(Object.assign({}, repo), { ref: "master" });
        let logMessage = (adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";
        const adapterUrl = `https://github.com/${repo.owner}/${repo.repo}`;
        let result;
        // If we hit the rate limiter, try up to 3 times
        const retryAttempts = 3;
        for (let i = 0; i < retryAttempts; i++) {
            try {
                result =
                    (_a = (await (0, checks_1.getCommitStatus)(ref))) !== null && _a !== void 0 ? _a : (await (0, checks_1.getCheckStatus)(ref));
                continue;
            }
            catch (e) {
                const responseCode = (_b = e.response) === null || _b === void 0 ? void 0 : _b.code;
                if (i < retryAttempts - 1) {
                    const headers = (_c = e.response) === null || _c === void 0 ? void 0 : _c.headers;
                    if (headers && headers["x-ratelimit-remaining"] === "0") {
                        let resetTimeout;
                        if ("x-ratelimit-reset" in headers) {
                            resetTimeout =
                                parseInt(headers["x-ratelimit-reset"]) * 1000 -
                                    Date.now();
                        }
                        else {
                            // Github's rate limit is reset every hour
                            resetTimeout = 60 * 60 * 1000; // 1h in ms
                        }
                        console.error((0, ansi_colors_1.blue)(`Hit the rate limit, waiting ${Math.round(resetTimeout / 1000 / 60)} minutes...`));
                        await (0, async_1.wait)(resetTimeout);
                        continue;
                    }
                }
                logMessage += (0, ansi_colors_1.red)("[FAIL] Could not load Github repo!");
                if (responseCode) {
                    logMessage += (0, ansi_colors_1.red)(` (code ${responseCode})`);
                }
                logMessage += `\n· ${adapterUrl}`;
                return logMessage;
            }
        }
        if (result) {
            if (result.status === "failure") {
                logMessage += (0, ansi_colors_1.red)("[FAIL]");
                let hasLink = false;
                if (result.checks.length) {
                    for (const { status, url } of result.checks) {
                        if (status === "failure") {
                            hasLink = true;
                            logMessage += `\n· ${(0, ansi_colors_1.red)("[FAIL]")} ${url}`;
                        }
                    }
                }
                if (!hasLink) {
                    logMessage += `\n· ${adapterUrl}`;
                }
            }
            else if (result.status === "success") {
                logMessage += (0, ansi_colors_1.green)("[SUCCESS]");
            }
            else if (result.status === "pending") {
                logMessage += (0, ansi_colors_1.yellow)("[PENDING]");
                logMessage += `\n· ${adapterUrl}`;
            }
        }
        else {
            logMessage += (0, ansi_colors_1.yellow)("[WARN] No CI detected or CI not working!");
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
process.on("uncaughtException", (err) => {
    console.error(err);
});
process.on("unhandledRejection", (r) => {
    throw r;
});
