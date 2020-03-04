import { getCommitStatus, getCheckStatus } from "./checks";
import { readLatestRepo } from "./repo";
import { red, yellow, green, bold } from "ansi-colors";

import yargs from "yargs";

if (!yargs.argv.token) {
	console.error(red(`ERROR: You need a github token to use this because of rate limits!`));
	console.error(red(`Please pass one with the argument --token=${bold("<your-token>")}`));
	process.exit(1);
}

async function main() {
	const repos = await readLatestRepo();
	const maxAdapterNameLength = Math.max(
		...[...repos.keys()].map(key => key.length),
	);
	for (const [adapterName, repo] of repos) {
		const ref = {
			...repo,
			ref: "master",
		};
		const adapterUrl = `https://github.com/${repo.owner}/${repo.repo}`;

		const result =
			(await getCommitStatus(ref)) ?? (await getCheckStatus(ref));
		let logMessage =
			(adapterName + ":").padEnd(maxAdapterNameLength + 1, " ") + " ";
		if (result) {
			if (result.status === "failure") {
				logMessage += red("[FAIL]");
				if (result.checks.length) {
					for (const { status, url } of result.checks) {
						if (status === "failure") {
							logMessage += `\n· ${red("[FAIL]")} ${url}`;
						}
					}
				} else {
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
		console.log(logMessage);
	}
}

main();

process.on("uncaughtException", (err) => {
	console.error(err);
})
process.on("unhandledRejection", (r) => {
	throw r;
})
