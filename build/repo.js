"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const repoRegex = /github\.com\/([^\/]+)\/([^\/]+)\//;
async function readLatestRepo() {
    const ret = new Map();
    const repo = (await axios_1.default("https://repo.iobroker.live/sources-dist-latest.json")).data;
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
exports.readLatestRepo = readLatestRepo;
