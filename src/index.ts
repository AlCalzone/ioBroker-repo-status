import { getCommitStatus, getCheckStatus, RepoStatus, getRepoDefaultBranch } from "./checks";
import { readLatestRepo, Repository } from "./repo";
import { red, yellow, green, bold, blue } from "ansi-colors";
import yargs from "yargs";
import { wait } from "alcalzone-shared/async";
import { tryGetRateLimitWaitTime } from "./utils";

if (!yargs.argv.token && !process.env.GITHUB_TOKEN) {
	console.error(
		red(
			`ERROR: You need a github token to use this because of rate limits!`,
		),
	);
	console.error(
		red(
			`Please pass one with the argument --token=${bold(
				"<your-token>",
			)} or the GITHUB_TOKEN environment variable`,
		),
	);
	process.exit(1);
}

async function main() {
	const repos = await readLatestRepo();
	const maxAdapterNameLength = Math.max(
		...[...repos.keys()].map((key) => key.length),
	);

	async function checkRepo(
		adapterName: string,
		repo: Repository,
	): Promise<string> {
		let logMessage =
			(adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";

		const adapterUrl = `https://github.com/${repo.owner}/${repo.repo}`;

		let result: RepoStatus | undefined;
		// If we hit the rate limiter, try up to 3 times
		const retryAttempts = 3;
		for (let i = 0; i < retryAttempts; i++) {
			try {
				// Find the default branch, which could be something different than master
				const ref = {
					...repo,
					ref: await getRepoDefaultBranch(repo.owner, repo.repo),
				};
				// and find the commit/check status for it
				result =
					(await getCommitStatus(ref)) ?? (await getCheckStatus(ref));
				break;
			} catch (e: any) {
				if (i < retryAttempts - 1) {
					const resetTimeout = tryGetRateLimitWaitTime(e);
					if (typeof resetTimeout === "number") {
						console.error(
							blue(
								`Hit the rate limit, waiting ${Math.round(
									resetTimeout / 1000 / 60,
								)} minutes...`,
							),
						);
						// Add one minute buffer
						await wait(resetTimeout + 60 * 1000);
						continue;
					}
				}
				logMessage += red("[FAIL] Could not load Github repo!");
				if (e.response?.status) {
					logMessage += red(
						` (status ${e.response.status}, ${e.response.statusText})`,
					);
				}
				logMessage += `\n· ${adapterUrl}`;

				// Add debug logging so we can see the response headers
				if (e.response?.headers) {
					console.error();
					console.error(blue(`Response headers for ${adapterUrl}:`));
					for (const [h, val] of Object.entries(e.response.headers)) {
						console.error(blue(`· ${h}: ${val}`));
					}
				}

				return logMessage;
			}
		}

		if (result) {
			if (result.status === "failure") {
				logMessage += red("[FAIL]");
				let hasLink = false;
				if (result.checks.length) {
					for (const { status, url } of result.checks) {
						if (status === "failure") {
							hasLink = true;
							logMessage += `\n· ${red("[FAIL]")} ${url}`;
						}
					}
				}
				if (!hasLink) {
					logMessage += `\n· ${adapterUrl}`;
				}
			} else if (result.status === "success") {
				logMessage += green("[SUCCESS]");
			} else if (result.status === "pending") {
				logMessage += yellow("[PENDING]");
				logMessage += `\n· ${adapterUrl}`;
			}
		} else {
			logMessage += yellow("[WARN] No CI detected or CI not working!");
			logMessage += `\n· ${adapterUrl}`;
		}
		return logMessage;
	}

	// Execute some requests in parallel
	const concurrency = 10;
	const pools: [string, Repository][][] = [];
	const all = [...repos];
	while (all.length > 0) {
		pools.push(all.splice(0, concurrency));
	}

	for (const pool of pools) {
		const tasks = pool.map(([adapterName, repo]) =>
			checkRepo(adapterName, repo),
		);
		const lines = await Promise.all(tasks);
		for (const line of lines) console.log(line);
	}
}

main();

process.on("uncaughtException", (err) => {
	console.error(err);
});
process.on("unhandledRejection", (r) => {
	throw r;
});
