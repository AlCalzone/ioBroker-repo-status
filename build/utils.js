"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetRateLimitWaitTime = void 0;
/** Checks if the given error indicates a rate limit and retrieves the wait time in milliseconds */
function tryGetRateLimitWaitTime(e) {
    var _a;
    const headers = (_a = e.response) === null || _a === void 0 ? void 0 : _a.headers;
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
        return resetTimeout;
    }
}
exports.tryGetRateLimitWaitTime = tryGetRateLimitWaitTime;
