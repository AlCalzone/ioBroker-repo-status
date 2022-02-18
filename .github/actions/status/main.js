const c = require("ansi-colors");
const github = require("@actions/github");
const core = require("@actions/core");
const { formatResultsGithub } = require("../../../build/index");

const githubToken = core.getInput("githubToken");
const octokit = new github.GitHub(githubToken);
const context = github.context;

(async function main() {

	process.env.GITHUB_TOKEN = githubToken
	const checkResults = await require("../../../build/index").checkAll();
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
