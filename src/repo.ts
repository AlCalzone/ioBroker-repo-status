import axios from "axios";

const repoRegex = /github(?:usercontent)?\.com\/([^\/]+)\/([^\/]+)\//;

export interface Repository {
	owner: string;
	repo: string;
}

export async function readLatestRepo(): Promise<Map<string, Repository>> {
	const ret = new Map<string, Repository>();

	const repo: Record<string, any> = (
		await axios("https://repo.iobroker.live/sources-dist-latest.json")
	).data;
	for (const [adapter, { readme, meta }] of Object.entries(repo)) {
		// We need to parse github links to figure out the repo URL
		const match = repoRegex.exec(readme) ?? repoRegex.exec(meta);
		if (match) {
			ret.set(adapter, {
				owner: match[1],
				repo: match[2],
			});
		} else {
			console.warn(`Could not find GitHub repo for ${adapter}`);
		}
	}
	console.error(`Found ${ret.size} repositories`);
	return ret;
}
