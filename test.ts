import { Octokit } from "@octokit/rest";
import axios from "axios";

const o = new Octokit();

interface Ref {
	owner: string;
	repo: string;
	ref: string;
}


type CommitStatus = "success" | "failure" | "pending";

async function getCommitStatus(ref: Ref): Promise<CommitStatus | undefined> {
	const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/commits/${ref.ref}/status`;
	const response = await axios(url);
	if (response.data.state === "pending" && response.data.statuses.length === 0) {
		// This repo is not using the statuses API
		return;
	}
	return response.data.state;
}

const allowedCIApps = ["GitHub Actions", "Travis CI", "AppVeyor", "CircleCI"];

async function getCheckStatus(ref: Ref): Promise<CommitStatus | undefined> {
	let suites = (await o.checks.listSuitesForRef(ref)).data.check_suites;
	suites = suites.filter(s => allowedCIApps.includes(s.app.name));
	if (!suites.length) return;

	const result = suites.some(s => s.status === "queued" || s.status === "in_progress") ? "pending" :
		suites.some(s => s.conclusion !== "success") ? "failure"
			: "success";
	return result;
}

async function main() {

	const ref = {
		owner: "AlCalzone",
		repo: "ioBroker.zwave2",
		ref: "master"
	};
	const result = (await getCommitStatus(ref)) ?? (await getCheckStatus(ref));
	console.dir(result)

	// const commit = await o.repos.getCommit(ref);
	// console.dir(commit.data, { depth: 100 });

	// const suites = await o.checks.listSuitesForRef(ref);
	// const suites2 = suites.data.check_suites.map(({ status, conclusion, url, app }) => ({ status, conclusion, url, appName: app.name }))
	// console.dir(suites2, { depth: 100 });
	// const checks = await o.checks.listForRef(ref);
	// const runs = checks.data.check_runs.map(({ status, conclusion, url, app }) => ({ status, conclusion, url, appName: app.name }));
	// console.dir(runs, { depth: 100 });

}

main();