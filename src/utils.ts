/** Checks if the given error indicates a rate limit and retrieves the wait time in milliseconds */
export function tryGetRateLimitWaitTime(e: any): number | undefined {
	const headers = e.response?.headers;
	if (!headers) return;
	if ("retry-after" in headers) {
		return parseInt(headers["retry-after"]) * 1000;
	} else if (headers["x-ratelimit-remaining"] === "0") {
		let resetTimeout: number;
		if ("x-ratelimit-reset" in headers) {
			resetTimeout =
				parseInt(headers["x-ratelimit-reset"]) * 1000 - Date.now();
		} else {
			// Github's rate limit is reset every hour
			resetTimeout = 60 * 60 * 1000; // 1h in ms
		}
		return resetTimeout;
	}
}
