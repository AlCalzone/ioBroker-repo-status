"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatResultsGithub = exports.formatResultCLI = exports.AdapterCheckStatus = exports.tryGetRateLimitWaitTime = void 0;
const ansi_colors_1 = require("ansi-colors");
/** Checks if the given error indicates a rate limit and retrieves the wait time in milliseconds */
function tryGetRateLimitWaitTime(e) {
    var _a;
    const headers = (_a = e.response) === null || _a === void 0 ? void 0 : _a.headers;
    if (!headers)
        return;
    if ("retry-after" in headers) {
        return parseInt(headers["retry-after"]) * 1000;
    }
    else if (headers["x-ratelimit-remaining"] === "0") {
        let resetTimeout;
        if ("x-ratelimit-reset" in headers) {
            resetTimeout =
                parseInt(headers["x-ratelimit-reset"]) * 1000 - Date.now();
        }
        else {
            // Github's rate limit is reset every hour
            resetTimeout = 60 * 60 * 1000; // 1h in ms
        }
        return resetTimeout;
    }
}
exports.tryGetRateLimitWaitTime = tryGetRateLimitWaitTime;
var AdapterCheckStatus;
(function (AdapterCheckStatus) {
    AdapterCheckStatus[AdapterCheckStatus["Success"] = 0] = "Success";
    AdapterCheckStatus[AdapterCheckStatus["Failure"] = 1] = "Failure";
    AdapterCheckStatus[AdapterCheckStatus["Warning"] = 2] = "Warning";
    AdapterCheckStatus[AdapterCheckStatus["Pending"] = 3] = "Pending";
})(AdapterCheckStatus = exports.AdapterCheckStatus || (exports.AdapterCheckStatus = {}));
function compareCheckResult(r1, r2) {
    let result = Math.sign(r1.status - r2.status);
    if (result === 0) {
        result = r1.adapterName.localeCompare(r2.adapterName);
    }
    return result;
}
function formatResultCLI(r, maxAdapterNameLength) {
    let ret = (r.adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";
    switch (r.status) {
        case AdapterCheckStatus.Success:
            ret += (0, ansi_colors_1.green)("[SUCCESS]");
            break;
        case AdapterCheckStatus.Failure:
            ret += (0, ansi_colors_1.red)("[FAILURE]");
            if (r.comment)
                ret += " " + (0, ansi_colors_1.red)(r.comment);
            ret += `\n· ${r.checkUrl || r.adapterUrl}`;
            break;
        case AdapterCheckStatus.Warning:
            ret += (0, ansi_colors_1.yellow)(`[WARN] ${r.comment || ""}`);
            ret += `\n· ${r.checkUrl || r.adapterUrl}`;
            break;
        case AdapterCheckStatus.Pending:
            ret += (0, ansi_colors_1.blue)("[PENDING]");
            ret += `\n· ${r.adapterUrl}`;
            break;
    }
    return ret;
}
exports.formatResultCLI = formatResultCLI;
function formatResultsGithub(results) {
    results = results.sort(compareCheckResult);
    let ret = `
* TOTAL adapters: ${results.length}
* ✅ SUCCESS:     ${results.filter((r) => r.status === AdapterCheckStatus.Success).length}
* ❌ FAIL:        ${results.filter((r) => r.status === AdapterCheckStatus.Failure).length}
* ⚠ WARN:         ${results.filter((r) => r.status === AdapterCheckStatus.Warning).length}
* ⏳ PENDING:      ${results.filter((r) => r.status === AdapterCheckStatus.Pending).length}

| Adapter | Status | Comment        |
| :------ | :----- | :------------- |
`;
    for (const r of results) {
        ret += `| [${r.adapterName}](${r.adapterUrl}) | `;
        switch (r.status) {
            case AdapterCheckStatus.Success:
                ret += "✅&nbsp;SUCCESS |  |";
                break;
            case AdapterCheckStatus.Failure:
                ret += "❌&nbsp;FAIL | ";
                if (r.comment)
                    ret += r.comment;
                else if (r.checkUrl) {
                    ret += `🧪 [failing check](${r.checkUrl})`;
                }
                ret += ` |`;
                break;
            case AdapterCheckStatus.Warning:
                ret += `⚠&nbsp;WARN | `;
                if (r.comment)
                    ret += r.comment;
                else if (r.checkUrl) {
                    ret += `🧪 [failing check](${r.checkUrl})`;
                }
                ret += ` |`;
                break;
            case AdapterCheckStatus.Pending:
                ret += "⏳&nbsp;PENDING |  |";
                break;
        }
        ret += "\n";
    }
    return ret;
}
exports.formatResultsGithub = formatResultsGithub;
