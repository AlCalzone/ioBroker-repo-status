import { red, yellow, green, blue } from "ansi-colors";

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

export enum AdapterCheckStatus {
	Success,
	Failure,
	Warning,
	Pending,
}

export interface AdapterCheckResult {
	adapterName: string;
	adapterUrl: string;
	status: AdapterCheckStatus;
	comment?: string;
	checkUrl?: string;
}

function compareCheckResult(
	r1: AdapterCheckResult,
	r2: AdapterCheckResult,
): number {
	let result = Math.sign(r1.status - r2.status);
	if (result === 0) {
		result = r1.adapterName.localeCompare(r2.adapterName);
	}
	return result;
}

export function formatResultCLI(
	r: AdapterCheckResult,
	maxAdapterNameLength: number,
): string {
	let ret = (r.adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";
	switch (r.status) {
		case AdapterCheckStatus.Success:
			ret += green("[SUCCESS]");
			break;
		case AdapterCheckStatus.Failure:
			ret += red("[FAILURE]");
			if (r.comment) ret += " " + red(r.comment);
			ret += `\n· ${r.checkUrl || r.adapterUrl}`;
			break;
		case AdapterCheckStatus.Warning:
			ret += yellow(`[WARN] ${r.comment || ""}`);
			ret += `\n· ${r.checkUrl || r.adapterUrl}`;
			break;
		case AdapterCheckStatus.Pending:
			ret += blue("[PENDING]");
			ret += `\n· ${r.adapterUrl}`;
			break;
	}
	return ret;
}

export function formatResultsGithub(results: AdapterCheckResult[]): string {
	results = results.sort(compareCheckResult);
	let ret = `
* TOTAL adapters: ${results.length}
* ✅ SUCCESS:     ${
		results.filter((r) => r.status === AdapterCheckStatus.Success).length
	}
* ❌ FAIL:        ${
		results.filter((r) => r.status === AdapterCheckStatus.Failure).length
	}
* ⚠ WARN:         ${
		results.filter((r) => r.status === AdapterCheckStatus.Warning).length
	}
* ⏳ PENDING:      ${
		results.filter((r) => r.status === AdapterCheckStatus.Pending).length
	}

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
				if (r.comment) ret += r.comment;
				else if (r.checkUrl) {
					ret += `🧪 [failing check](${r.checkUrl})`;
				}
				ret += ` |`;
				break;
			case AdapterCheckStatus.Warning:
				ret += `⚠&nbsp;WARN | ${r.comment || ""} |`;
				ret += `\n· ${r.checkUrl || r.adapterUrl}`;
				break;
			case AdapterCheckStatus.Pending:
				ret += "⏳&nbsp;PENDING |  |";
				break;
		}
		ret += "\n";
	}

	return ret;
}
