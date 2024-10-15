import { getInput, setFailed, info, error } from "@actions/core";
import * as github from '@actions/github';
import { Octokit } from '@octokit/core';
import { RequestError } from '@octokit/request-error';

interface ListDeploymentIDs { owner: string;repo: string;environment: string;ref: string }
interface Deployment { owner: string;repo: string;deploymentId: number }
interface Context { owner: string;repo: string }
export interface DeploymentRef { deploymentId: number;ref: string }

/*
    Func > getTime
*/

function getTime(ms: string | undefined) {
    return Math.floor(Number(ms)) || 0
}

/*
    Func > delay
*/

function delay(ms: string | undefined) {
    return new Promise(resolve => setTimeout(resolve, getTime(ms)));
}

/*
    Func > List Deployments
*/

async function listDeployments(client: Octokit, { owner, repo, environment, ref = '' }: ListDeploymentIDs, page = 0): Promise < DeploymentRef[] >
{

    info(`      › 📝 Searching env ${environment}`);

    const { data } = await client.request('GET /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        environment,
        ref,
        per_page: 100,
        page,
    });

    const deploymentRefs: DeploymentRef[] = data.map((deployment) => ( { deploymentId: deployment.id, ref: deployment.ref }));

    info( `      › 🗳️ Reading ${deploymentRefs.length} deployments on page ${page}` );

    if (deploymentRefs.length === 100)
        return deploymentRefs.concat( await listDeployments( client, { owner, repo, environment, ref }, page + 1 ) );

    return deploymentRefs;
}

/*
    Func > Deployments > Set Inactive
*/

async function setDeploymentInactive( client: Octokit, { owner, repo, deploymentId }: Deployment ): Promise < void >
{
    info(`      › ✔️ ID ${deploymentId} inactive`);

    await client.request( 'POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses',
    {
        owner,
        repo,
        deployment_id: deploymentId,
        state: 'inactive',
    });
}

/*
    Func > Deployments > Delete by ID
*/

async function deleteDeploymentById( client: Octokit, { owner, repo, deploymentId }: Deployment ): Promise < void >
{
    info(`      › ✔️ ID ${deploymentId} deleted`);
    await client.request( 'DELETE /repos/{owner}/{repo}/deployments/{deployment_id}',
    {
        owner,
        repo,
        deployment_id: deploymentId,
    });
}

/*
    Func > Environment > Delete
*/

async function deleteTheEnvironment( client: Octokit, environment: string, { owner, repo }: Context ): Promise < void >
{

    let existingEnv = false;

    try
    {
        const getEnvResult = await client.request( 'GET /repos/{owner}/{repo}/environments/{environment_name}',
        {
            owner,
            repo,
            environment_name: environment,
        });

        existingEnv = typeof getEnvResult === 'object';
    }
    catch (err)
    {
        if ((err as RequestError).status !== 404)
        {
            error('Error deleting environment');
            throw err;
        }
    }

    if (existingEnv)
    {
        info(`   › 🗑️ Deleting env ${environment}`);
        await client.request( 'DELETE /repos/{owner}/{repo}/environments/{environment_name}',
        {
            owner,
            repo,
            environment_name: environment,
        });

        info(`      › ✔️ Deleted`);
    }
}

/*
    Func > Github Action > Main
*/

export async function main(): Promise < void >
{
    let deleteDeployment = true;
    let deleteEnvironment = true;

    const { context } = github;
    const token: string = getInput('token', { required: true });
    const environment: string = getInput('environment', { required: true });
    const onlyRemoveDeployments: string = getInput('onlyRemoveDeployments', { required: false });
    const onlyDeactivateDeployments: string = getInput( 'onlyDeactivateDeployments', { required: false } );
    const delayTime: string = getInput("delay", { required: false }) || "500";
    const ref: string = getInput('ref', { required: false });

    info('\n');
    info(`🛫 Starting Deployment Deletion action`);

    const client: Octokit = github.getOctokit(token,
    {
        throttle:
        {
            onRateLimit: (retryAfter = 0, options: any) =>
            {
                console.warn( `Request quota exhausted for request ${options.method} ${options.url}` );
                if (options.request.retryCount === 0)
                {
                    // only retries once
                    console.log(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
            },
            onAbuseLimit: (retryAfter = 0, options: any) =>
            {
                console.warn( `Abuse detected for request ${options.method} ${options.url}` );
                if (options.request.retryCount === 0)
                {
                    // only retries once
                    console.log(`Retrying after ${retryAfter} seconds!`);
                    return true;
                }
            },
        },
        previews: ['ant-man'],
    });

    if (onlyDeactivateDeployments === 'true')
    {
        deleteDeployment = false;
        deleteEnvironment = false;
    }
    else if (onlyRemoveDeployments === 'true')
    {
        deleteEnvironment = false;
    }

    info(`   › 📋 Collect list of deployments`);

    try
    {
        const deploymentRefs = await listDeployments(client, { ...context.repo, environment, ref });

        info(`      › 🔍 Found ${deploymentRefs.length} deployments`);

        let deploymentIds: number[];
        let deleteDeploymentMessage: string;
        let deactivateDeploymentMessage: string;
        let delayStart = 0;
        const delayIncrement = getTime(delayTime);

        if (ref.length > 0)
        {
            deleteDeploymentMessage = `   › 🗑️ Deleting deployment ref ${ref} in env ${environment}`;
            deactivateDeploymentMessage = `   › 🔴 Deactivating deployment ref ${ref} in env ${environment}`;
            deploymentIds = deploymentRefs
                .filter((deployment) => deployment.ref === ref)
                .map((deployment) => deployment.deploymentId);
        }
        else
        {
            deleteDeploymentMessage = `   › 🗑️ Deleting all ${deploymentRefs.length} deployments in env ${environment}`;
            deactivateDeploymentMessage = `   › 🔴 Deactivating all ${deploymentRefs.length} deployments in env ${environment}`;
            deploymentIds = deploymentRefs.map(
                (deployment) => deployment.deploymentId,
            );
        }

        info(deactivateDeploymentMessage);

        /*
            So that we don't hit the secondary rate limit, add a delay between each action in the promise
        */

        const promises = deploymentIds.map(deploymentId =>
        {
            delayStart += delayIncrement;
            return new Promise(resolve => setTimeout(resolve, delayStart)).then(() =>
                setDeploymentInactive(client, { ...context.repo, deploymentId }));
        })

        /*
            Promise kept
        */

        await Promise.all(promises);

        if (deleteDeployment)
        {
            info(deleteDeploymentMessage);

            /*
                So that we don't hit the secondary rate limit, add a delay between each action in the promise
            */

            const promises = deploymentIds.map(deploymentId =>
            {
                delayStart += delayIncrement;
                return new Promise(resolve => setTimeout(resolve, delayStart)).then(() =>
                    deleteDeploymentById(client, { ...context.repo, deploymentId }));
            })

            /*
                Promise kept
            */

            await Promise.all(promises);
        }

        if (deleteEnvironment)
        {
            await deleteTheEnvironment(client, environment, context.repo);
        }

        info('   › ✔️ Action completed successfully');

    }
    catch (err)
    {
        setFailed((err as RequestError).message);
    }
}
