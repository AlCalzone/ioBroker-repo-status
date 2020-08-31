const c = require("ansi-colors");
const exec = require("@actions/exec");
const github = require("@actions/github");
const core = require("@actions/core");

const githubToken = core.getInput("githubToken");
const octokit = new github.GitHub(githubToken);
const context = github.context;

(async function main() {
	let result = "";

	/** @type {import("@actions/exec").ExecOptions} */
	const options = {
		env: {
			...process.env,
			GITHUB_TOKEN: githubToken
		}, 
		listeners: {
			stdout: data => {
				result += data.toString();
			},
		}
	};

	await exec.exec("node", ["./bin/iobroker-repo-status.js"], options);

	// TODO: Convert to table
	result = c.stripColor(result);
	result = `This is the current adapter build status at ${new Date().toISOString()}:

\`\`\`
${result}
\`\`\`
`;

	const { data: { body: oldBody } } = await octokit.issues.get({
		...context.repo,
		issue_number: 2,
	});

	const newBody = result;

	if (oldBody !== newBody) {
		await octokit.issues.update({
			...context.repo,
			issue_number: 2,
			body: newBody,
		});
		console.error(c.green("The build status issue was updated!"));
	} else {
		console.error(c.yellow("No changes to the build status!"));
	}
})();
