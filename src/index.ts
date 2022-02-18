import {
	getCommitStatus,
	getCheckStatus,
	RepoStatus,
	getRepoDefaultBranch,
} from "./checks";
import { readLatestRepo, Repository } from "./repo";
import { red, yellow, green, bold, blue } from "ansi-colors";
import yargs from "yargs";
import { wait } from "alcalzone-shared/async";
import {
	AdapterCheckResult,
	AdapterCheckStatus,
	formatResultCLI,
	tryGetRateLimitWaitTime,
} from "./utils";

export async function checkAll() {
	const repos = await readLatestRepo();

	const maxAdapterNameLength = Math.max(
		...[...repos.keys()].map((key) => key.length),
	);

	async function checkRepo(
		adapterName: string,
		repo: Repository,
	): Promise<AdapterCheckResult> {
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
				let comment = "Could not load Github repo!";
				if (e.response?.status) {
					comment += ` (status ${e.response.status}, ${e.response.statusText})`;
				}

				// Add debug logging so we can see the response headers
				if (e.response?.headers) {
					console.error();
					console.error(blue(`Response headers for ${adapterUrl}:`));
					for (const [h, val] of Object.entries(e.response.headers)) {
						console.error(blue(`· ${h}: ${val}`));
					}
				}

				return {
					adapterName,
					adapterUrl,
					status: AdapterCheckStatus.Failure,
					comment,
				};
			}
		}

		if (result) {
			if (result.status === "failure") {
				const checkUrl = result.checks.find(
					(c) => c.status === "failure",
				)?.url;
				return {
					adapterName,
					adapterUrl,
					status: AdapterCheckStatus.Failure,
					checkUrl,
				};
			} else if (result.status === "success") {
				return {
					adapterName,
					adapterUrl,
					status: AdapterCheckStatus.Success,
				};
			} /*if (result.status === "pending")*/ else {
				return {
					adapterName,
					adapterUrl,
					status: AdapterCheckStatus.Pending,
				};
			}
		} else {
			return {
				adapterName,
				adapterUrl,
				status: AdapterCheckStatus.Warning,
				comment: "No CI detected or CI not working!",
			};
		}
	}

	// Execute some requests in parallel
	const concurrency = 10;
	const pools: [string, Repository][][] = [];
	const all = [...repos];
	while (all.length > 0) {
		pools.push(all.splice(0, concurrency));
	}

	let results: AdapterCheckResult[] = [];

	for (const pool of pools) {
		const tasks = pool.map(([adapterName, repo]) =>
			checkRepo(adapterName, repo),
		);
		const chunk = await Promise.all(tasks);
		results.push(...chunk);
		for (const result of chunk) {
			console.log(formatResultCLI(result, maxAdapterNameLength));
		}
	}

	console.log(`
Statistics
==========
TOTAL adapters: ${results.length}
✅ SUCCESS:     ${
		results.filter((r) => r.status === AdapterCheckStatus.Success).length
	}
❌ FAIL:        ${
		results.filter((r) => r.status === AdapterCheckStatus.Failure).length
	}
⚠ WARN:         ${
		results.filter((r) => r.status === AdapterCheckStatus.Warning).length
	}
⏳ PENDING:     ${
		results.filter((r) => r.status === AdapterCheckStatus.Pending).length
	}
`);

	return results;
}

if (require.main === module) {
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

	checkAll();
}

process.on("uncaughtException", (err) => {
	console.error(err);
});
process.on("unhandledRejection", (r) => {
	throw r;
});
