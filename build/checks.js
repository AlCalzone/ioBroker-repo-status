"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const rest_1 = require("@octokit/rest");
const yargs_1 = __importDefault(require("yargs"));
const axios_1 = __importDefault(require("axios"));
const authToken = yargs_1.default.argv.token;
// These Github Apps are recognized as CI services
const allowedCIApps = ["GitHub Actions", "Travis CI", "AppVeyor", "CircleCI"];
const o = new rest_1.Octokit(authToken ? { auth: authToken } : {});
async function getCommitStatus(ref) {
    const url = `https://api.github.com/repos/${ref.owner}/${ref.repo}/commits/${ref.ref}/status`;
    const response = await axios_1.default({
        url,
        headers: Object.assign({}, (authToken ? { Authorization: `token ${authToken}` } : {}))
    });
    if (response.data.state === "pending" &&
        response.data.statuses.length === 0) {
        // This repo is not using the statuses API
        return;
    }
    return {
        status: response.data.state,
        checks: response.data.statuses.map(
        // @ts-ignore
        ({ state, target_url }) => ({ status: state, url: target_url })),
    };
}
exports.getCommitStatus = getCommitStatus;
async function getCheckStatus(ref) {
    let suites = (await o.checks.listSuitesForRef(ref)).data.check_suites;
    suites = suites.filter(s => allowedCIApps.includes(s.app.name));
    if (!suites.length)
        return;
    let cumulativeStatus;
    if (suites.some(s => s.conclusion === "success")) {
        suites = suites.filter(s => s.conclusion === "success");
        cumulativeStatus = "success";
    }
    else if (suites.some(s => s.conclusion === "failure")) {
        suites = suites.filter(s => s.conclusion === "failure");
        cumulativeStatus = "failure";
    }
    else {
        cumulativeStatus = "pending";
    }
    const checkURLs = new Map();
    for (const suite of suites) {
        const runs = await o.checks.listForSuite(Object.assign(Object.assign({}, ref), { check_suite_id: suite.id }));
        if (!runs.data.check_runs.length)
            continue;
        checkURLs.set(suite.id, runs.data.check_runs[0].details_url);
    }
    if (checkURLs.size === 0)
        return;
    return {
        status: cumulativeStatus,
        checks: suites.map(({ id, status, url }) => {
            var _a;
            return ({
                status: status,
                url: (_a = checkURLs.get(id)) !== null && _a !== void 0 ? _a : url,
            });
        }),
    };
}
exports.getCheckStatus = getCheckStatus;
