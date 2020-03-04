import axios from "axios";

const repoRegex = /github\.com\/([^\/]+)\/([^\/]+)\//;

export interface Repository {
	owner: string;
	repo: string;
}

export async function readLatestRepo(): Promise<Map<string, Repository>> {
	const ret = new Map<string, Repository>();

	const repo: Record<string, any> = (
		await axios("https://repo.iobroker.live/sources-dist-latest.json")
	).data;
	for (const [adapter, { readme }] of Object.entries(repo)) {
		const match = repoRegex.exec(readme);
		if (match) {
			ret.set(adapter, {
				owner: match[1],
				repo: match[2],
			});
		}
	}
	return ret;
}
