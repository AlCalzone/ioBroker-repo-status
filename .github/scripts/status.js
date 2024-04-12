// @ts-check
const c = require("ansi-colors");

/** @param {import('github-script').AsyncFunctionArguments} AsyncFunctionArguments */
async function main({ github, context, core }) {
	// Set the github token env var before requiring the main module
	const githubToken = core.getInput("githubToken");
	process.env.GITHUB_TOKEN = githubToken;

	const { checkAll } = require("../../build/index");
	const { formatResultsGithub } = require("../../build/utils");

	const checkResults = await checkAll();
	const result = `This is the current adapter build status at ${new Date().toISOString()}:

${formatResultsGithub(checkResults)}
`;

	const {
		data: { body: oldBody },
	} = await github.rest.issues.get({
		...context.repo,
		issue_number: 2,
	});

	const newBody = result;

	if (oldBody !== newBody) {
		await github.rest.issues.update({
			...context.repo,
			issue_number: 2,
			body: newBody,
		});
		console.error(c.green("The build status issue was updated!"));
	} else {
		console.error(c.yellow("No changes to the build status!"));
	}
}
module.exports = main;
