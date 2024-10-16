"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
/* eslint-disable no-console */
const core_1 = require("@actions/core");
const github = __importStar(require("@actions/github"));
/*
    Func > getNum
*/
function getNum(num) {
    return Math.floor(Number(num)) || 0;
}
/*
    Func > List Deployments
*/
function listDeployments(client, { owner, repo, environment, ref = '', limit = 100 }, page = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, core_1.info)(`      › 📝 Searching \x1b[38;5;9menv ${environment}\x1b[0m`);
        const { data } = yield client.request('GET /repos/{owner}/{repo}/deployments', {
            owner,
            repo,
            environment,
            ref,
            per_page: limit,
            page
        });
        /*
            Limit not reached || limit set to default 100
                loop function again to page 2+
        */
        const deploymentRefs = data.map((deployment) => ({ deploymentId: deployment.id, ref: deployment.ref }));
        const itemsTotal = deploymentRefs.length;
        if (!limit || limit === 100) {
            (0, core_1.info)(`      › ⚙️ Using default limit of \x1b[38;5;1m${limit}\x1b[0m`);
            if (itemsTotal === 100)
                return deploymentRefs.concat(yield listDeployments(client, { owner, repo, environment, ref, limit }, page + 1));
            /*
                user specified custom limit
            */
        }
        else if (limit >= 100) {
            const pagesNeeded = Math.ceil(limit / 100);
            /*
                if total items is less than limit
                if current page number less than number of pages needed
            */
            if (itemsTotal < limit && page < pagesNeeded) {
                (0, core_1.info)(`      › ⚙️ Using custom limit of \x1b[38;5;1m${limit}\x1b[0m › reading page \x1b[38;5;32mpage ${page}/${pagesNeeded}\x1b[0m`);
                return deploymentRefs.concat(yield listDeployments(client, { owner, repo, environment, ref, limit }, page + 1));
            }
        }
        else if (limit !== 100) {
            (0, core_1.info)(`      › ⚙️ Using custom limit of \x1b[38;5;1m${limit}\x1b[0m › not using pagination`);
        }
        /*
            Done getting items, return deployment list
        */
        (0, core_1.info)(`      › 📚 Finished fetching deployment results`);
        return deploymentRefs;
    });
}
/*
    Func > Deployments > Set Inactive
*/
function setDeploymentInactive(client, { owner, repo, deploymentId }) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, core_1.info)(`      › ✔️ ID \x1b[38;5;244m${deploymentId}\x1b[0m inactive`);
        yield client.request('POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses', {
            owner,
            repo,
            deployment_id: deploymentId,
            state: 'inactive'
        });
    });
}
/*
    Func > Deployments > Delete by ID
*/
function deleteDeploymentById(client, { owner, repo, deploymentId }) {
    return __awaiter(this, void 0, void 0, function* () {
        (0, core_1.info)(`      › ✔️ ID \x1b[38;5;244m${deploymentId}\x1b[0m deleted`);
        yield client.request('DELETE /repos/{owner}/{repo}/deployments/{deployment_id}', {
            owner,
            repo,
            deployment_id: deploymentId
        });
    });
}
/*
    Func > Environment > Delete
*/
function deleteTheEnvironment(client, environment, { owner, repo }) {
    return __awaiter(this, void 0, void 0, function* () {
        let existingEnv = false;
        try {
            const getEnvResult = yield client.request('GET /repos/{owner}/{repo}/environments/{environment_name}', {
                owner,
                repo,
                environment_name: environment
            });
            existingEnv = typeof getEnvResult === 'object';
        }
        catch (err) {
            if (err.status !== 404) {
                (0, core_1.error)('Error deleting environment');
                throw err;
            }
        }
        if (existingEnv) {
            (0, core_1.info)(`   › 🗑️ Deleting \x1b[38;5;9menv ${environment}\x1b[0m`);
            yield client.request('DELETE /repos/{owner}/{repo}/environments/{environment_name}', {
                owner,
                repo,
                environment_name: environment
            });
            (0, core_1.info)(`      › ✔️ Deleted`);
        }
    });
}
/*
    Func > Github Action > Main
*/
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        let deleteDeployment = true;
        let deleteEnvironment = true;
        const { context } = github;
        const token = (0, core_1.getInput)('token', { required: true });
        const environment = (0, core_1.getInput)('environment', { required: true });
        const onlyRemoveDeployments = (0, core_1.getInput)('onlyRemoveDeployments', { required: false });
        const onlyDeactivateDeployments = (0, core_1.getInput)('onlyDeactivateDeployments', { required: false });
        const delayTime = getNum((0, core_1.getInput)('delay', { required: false }) || '500');
        const limit = getNum((0, core_1.getInput)('limit', { required: false }) || '100');
        const ref = (0, core_1.getInput)('ref', { required: false });
        (0, core_1.info)('\n');
        (0, core_1.info)(` › 🛫 Starting Deployment Deletion action`);
        const client = github.getOctokit(token, {
            throttle: {
                onRateLimit: (retryAfter = 0, options) => {
                    console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
                    if (options.request.retryCount === 0) {
                        // only retries once
                        console.log(`Retrying after ${retryAfter} seconds!`);
                        return true;
                    }
                },
                onAbuseLimit: (retryAfter = 0, options) => {
                    console.warn(`Abuse detected for request ${options.method} ${options.url}`);
                    if (options.request.retryCount === 0) {
                        // only retries once
                        console.log(`Retrying after ${retryAfter} seconds!`);
                        return true;
                    }
                }
            },
            previews: ['ant-man']
        });
        if (onlyDeactivateDeployments === 'true') {
            deleteDeployment = false;
            deleteEnvironment = false;
        }
        else if (onlyRemoveDeployments === 'true') {
            deleteEnvironment = false;
        }
        (0, core_1.info)(`   › 📋 Collect list of deployments`);
        try {
            const deploymentRefs = yield listDeployments(client, Object.assign(Object.assign({}, context.repo), { environment, ref, limit }));
            (0, core_1.info)(`      › 🔍 Found \x1b[38;5;32m${deploymentRefs.length} deployments\x1b[0m for \x1b[38;5;13mref ${ref}\x1b[0m`);
            let deploymentIds;
            let deleteDeploymentMessage;
            let deactivateDeploymentMessage;
            let delayStart = 0;
            const delayIncrement = delayTime;
            if (ref.length > 0) {
                deleteDeploymentMessage = `   › 🗑️ Deleting deployment \x1b[38;5;13mref ${ref}\x1b[0m in \x1b[38;5;9menv ${environment}\x1b[0m`;
                deactivateDeploymentMessage = `   › 🔴 Deactivating deployment \x1b[38;5;13mref ${ref}\x1b[0m in \x1b[38;5;9menv ${environment}\x1b[0m`;
                deploymentIds = deploymentRefs
                    .filter((deployment) => deployment.ref === ref)
                    .map((deployment) => deployment.deploymentId);
            }
            else {
                deleteDeploymentMessage = `   › 🗑️ Deleting all ${deploymentRefs.length} deployments in \x1b[38;5;9menv ${environment}\x1b[0m`;
                deactivateDeploymentMessage = `   › 🔴 Deactivating all ${deploymentRefs.length} deployments in \x1b[38;5;9menv ${environment}\x1b[0m`;
                deploymentIds = deploymentRefs.map((deployment) => deployment.deploymentId);
            }
            (0, core_1.info)(deactivateDeploymentMessage);
            /*
                So that we don't hit the secondary rate limit, add a delay between each action in the promise
            */
            const promiseInactive = deploymentIds.map((deploymentId) => {
                delayStart += delayIncrement;
                return new Promise((resolve) => setTimeout(resolve, delayStart)).then(() => setDeploymentInactive(client, Object.assign(Object.assign({}, context.repo), { deploymentId })));
            });
            yield Promise.all(promiseInactive);
            /*
                Action > Delete Deployment
            */
            if (deleteDeployment) {
                (0, core_1.info)(deleteDeploymentMessage);
                /*
                    So that we don't hit the secondary rate limit, add a delay between each action in the promise
                */
                const promiseDelete = deploymentIds.map((deploymentId) => {
                    delayStart += delayIncrement;
                    return new Promise((resolve) => setTimeout(resolve, delayStart)).then(() => deleteDeploymentById(client, Object.assign(Object.assign({}, context.repo), { deploymentId })));
                });
                /*
                    Promise kept
                */
                yield Promise.all(promiseDelete);
            }
            if (deleteEnvironment) {
                yield deleteTheEnvironment(client, environment, context.repo);
            }
            (0, core_1.info)('   › ✔️ Action completed successfully');
        }
        catch (err) {
            (0, core_1.setFailed)(err.message);
        }
    });
}
exports.main = main;
//# sourceMappingURL=execute.js.map