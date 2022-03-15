// @ts-check

const c = require("ansi-colors");
const github = require("@actions/github");
const core = require("@actions/core");

// Set the github token env var before requiring the main module
const githubToken = core.getInput("githubToken");
process.env.GITHUB_TOKEN = githubToken;

const octokit = new github.GitHub(githubToken);
const context = github.context;

const { checkAll } = require("../../../build/index");
const { formatResultsGithub } = require("../../../build/utils");

(async function main() {

	const checkResults = await checkAll();
	const result = `This is the current adapter build status at ${new Date().toISOString()}:

${formatResultsGithub(checkResults)}
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
