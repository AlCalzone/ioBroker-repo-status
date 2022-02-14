import { Octokit } from "@octokit/rest";
import yargs from "yargs";
import axios from "axios";

const authToken = yargs.argv.token || process.env.GITHUB_TOKEN;

// These Github Apps are recognized as CI services
const allowedCIApps = ["GitHub Actions", "Travis CI", "AppVeyor", "CircleCI"];

const o = new Octokit(authToken ? { auth: authToken } : {});

interface Ref {
	owner: string;
	repo: string;
	ref: string;
}

type CheckStatus = "success" | "failure" | "pending";

export interface RepoStatus {
	status: CheckStatus;
	checks: {
		status: CheckStatus;
		url: string;
	}[];
}

export async function getRepoDefaultBranch(
	owner: string,
	repo: string,
): Promise<string> {
	const url = `https://api.github.com/repos/${owner}/${repo}`;
	const response = await axios({
		url,
		headers: {
			...(authToken ? { Authorization: `token ${authToken}` } : {}),
		},
	});
	return response.data.default_branch;
}


export async function getCommitStatus(
	ref: Ref,
): Promise<RepoStatus | undefined> {
	const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/commits/${ref.ref}/status`;
	const response = await axios({
		url,
		headers: {
			...(authToken ? { Authorization: `token ${authToken}` } : {}),
		},
	});
	if (
		response.data.state === "pending" &&
		response.data.statuses.length === 0
	) {
		// This repo is not using the statuses API
		return;
	}
	return {
		status: response.data.state,
		checks: response.data.statuses.map(
			// @ts-ignore
			({ state, target_url }) => ({ status: state, url: target_url }),
		),
	};
}

export async function getCheckStatus(
	ref: Ref,
): Promise<RepoStatus | undefined> {
	let suites = (await o.checks.listSuitesForRef(ref)).data.check_suites;
	suites = suites.filter(s => allowedCIApps.includes(s.app.name));
	if (!suites.length) return;

	let cumulativeStatus: CheckStatus;
	if (suites.some(s => s.conclusion === "success")) {
		suites = suites.filter(s => s.conclusion === "success");
		cumulativeStatus = "success";
	} else if (suites.some(s => s.conclusion === "failure")) {
		suites = suites.filter(s => s.conclusion === "failure");
		cumulativeStatus = "failure";
	} else {
		cumulativeStatus = "pending";
	}

	const checkURLs = new Map<number, string>();
	for (const suite of suites) {
		const runs = await o.checks.listForSuite({
			...ref,
			check_suite_id: suite.id,
		});
		if (!runs.data.check_runs.length) continue;
		checkURLs.set(suite.id, runs.data.check_runs[0].details_url);
	}
	if (checkURLs.size === 0) return;

	return {
		status: cumulativeStatus,
		checks: suites.map(({ id, status, url }) => ({
			status: status as CheckStatus,
			url: checkURLs.get(id) ?? url,
		})),
	};
}
