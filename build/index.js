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
const utils_1 = require("./utils");
if (!yargs_1.default.argv.token && !process.env.GITHUB_TOKEN) {
    console.error((0, ansi_colors_1.red)(`ERROR: You need a github token to use this because of rate limits!`));
    console.error((0, ansi_colors_1.red)(`Please pass one with the argument --token=${(0, ansi_colors_1.bold)("<your-token>")} or the GITHUB_TOKEN environment variable`));
    process.exit(1);
}
async function main() {
    const repos = await (0, repo_1.readLatestRepo)();
    const maxAdapterNameLength = Math.max(...[...repos.keys()].map((key) => key.length));
    async function checkRepo(adapterName, repo) {
        // let logMessage =
        // 	(adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";
        var _a, _b, _c;
        const adapterUrl = `https://github.com/${repo.owner}/${repo.repo}`;
        let logMessage = `| [${adapterName}](${adapterUrl}) | `;
        let result;
        // If we hit the rate limiter, try up to 3 times
        const retryAttempts = 3;
        for (let i = 0; i < retryAttempts; i++) {
            try {
                // Find the default branch, which could be something different than master
                const ref = Object.assign(Object.assign({}, repo), { ref: await (0, checks_1.getRepoDefaultBranch)(repo.owner, repo.repo) });
                // and find the commit/check status for it
                result =
                    (_a = (await (0, checks_1.getCommitStatus)(ref))) !== null && _a !== void 0 ? _a : (await (0, checks_1.getCheckStatus)(ref));
                break;
            }
            catch (e) {
                if (i < retryAttempts - 1) {
                    const resetTimeout = (0, utils_1.tryGetRateLimitWaitTime)(e);
                    if (typeof resetTimeout === "number") {
                        console.error((0, ansi_colors_1.blue)(`Hit the rate limit, waiting ${Math.round(resetTimeout / 1000 / 60)} minutes...`));
                        // Add one minute buffer
                        await (0, async_1.wait)(resetTimeout + 60 * 1000);
                        continue;
                    }
                }
                logMessage += ` ❌&nbsp;FAIL | Could not load Github repo! `;
                // logMessage += red("[FAIL] Could not load Github repo!");
                if ((_b = e.response) === null || _b === void 0 ? void 0 : _b.status) {
                    logMessage += ` (status ${e.response.status}, ${e.response.statusText})`;
                }
                // if (e.response?.status) {
                // 	logMessage += red(
                // 		` (status ${e.response.status}, ${e.response.statusText})`,
                // 	);
                // }
                logMessage += ` |`;
                // logMessage += `\n· ${adapterUrl}`;
                // Add debug logging so we can see the response headers
                if ((_c = e.response) === null || _c === void 0 ? void 0 : _c.headers) {
                    console.error();
                    console.error((0, ansi_colors_1.blue)(`Response headers for ${adapterUrl}:`));
                    for (const [h, val] of Object.entries(e.response.headers)) {
                        console.error((0, ansi_colors_1.blue)(`· ${h}: ${val}`));
                    }
                }
                return logMessage;
            }
        }
        if (result) {
            if (result.status === "failure") {
                // logMessage += red("[FAIL]");
                logMessage += `❌&nbsp;FAIL | `;
                let hasLink = false;
                if (result.checks.length) {
                    for (const { status, url } of result.checks) {
                        if (status === "failure") {
                            // logMessage += `\n· ${red("[FAIL]")} ${url}`;
                            logMessage += `${hasLink ? "<br />" : ""}🧪 [failing check](${url})`;
                            hasLink = true;
                        }
                    }
                }
                logMessage += " |";
            }
            else if (result.status === "success") {
                logMessage += "✅&nbsp;SUCCESS |  |";
                // logMessage += green("[SUCCESS]");
            }
            else if (result.status === "pending") {
                logMessage += `⏳&nbsp;PENDING |  |`;
                // logMessage += yellow("[PENDING]");
                // logMessage += `\n· ${adapterUrl}`;
            }
        }
        else {
            logMessage += `⚠&nbsp;WARN | No CI detected or CI not working! |`;
            // logMessage += yellow("[WARN] No CI detected or CI not working!");
            // logMessage += `\n· ${adapterUrl}`;
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
    console.log("| Adapter | Status | Comment        |");
    console.log("| :------ | :----- | :------------- |");
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
