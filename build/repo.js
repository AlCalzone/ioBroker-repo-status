"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLatestRepo = void 0;
const axios_1 = __importDefault(require("axios"));
const repoRegex = /github(?:usercontent)?\.com\/([^\/]+)\/([^\/]+)\//;
async function readLatestRepo() {
    var _a;
    const ret = new Map();
    const repo = (await (0, axios_1.default)("https://repo.iobroker.live/sources-dist-latest.json")).data;
    for (const [adapter, { readme, meta }] of Object.entries(repo)) {
        // We need to parse github links to figure out the repo URL
        const match = (_a = repoRegex.exec(readme)) !== null && _a !== void 0 ? _a : repoRegex.exec(meta);
        if (match) {
            ret.set(adapter, {
                owner: match[1],
                repo: match[2],
            });
        }
        else {
            console.warn(`Could not find GitHub repo for ${adapter}`);
        }
    }
    console.error(`Found ${ret.size} repositories`);
    return ret;
}
exports.readLatestRepo = readLatestRepo;
