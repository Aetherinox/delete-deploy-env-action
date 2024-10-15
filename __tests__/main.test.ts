import anyTest, { TestFn } from 'ava';
import * as github from '@actions/github';
import { Octokit } from '@octokit/core';
import { DeploymentRef, main } from '../src/execute';
import { RequestError } from '@octokit/request-error';

const test = anyTest as TestFn <
{
    token: string;
    ref: string;
    octokit: Octokit;
    repo:
    {
        owner: string;repo: string
    };
} > ;

interface Context
{
    owner: string;
    repo: string;
    ref ? : string;
}

async function createEnvironment(
    octokit: Octokit,
    environmentName: string,
    {
        owner,
        repo
    }: Context,
): Promise < void >
{
    await octokit.request( 'PUT /repos/{owner}/{repo}/environments/{environment_name}',
    {
        owner,
        repo,
        environment_name: environmentName,
    });
}

/*
    Func > delay
*/

function delay(ms: number | 500) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createDeploymentWithStatus(
    octokit: Octokit,
    environment: string,
    {
        owner,
        repo,
        ref = 'main'
    }: Context,
): Promise < void >
{
    await octokit.request('POST /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        ref,
        environment,
        required_contexts: [],
    });

    const { data } = await octokit.request( 'GET /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        environment,
    });

    const [deployment] = data;
    const { id } = deployment;

    await octokit.request( 'POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses',
    {
        owner: owner,
        repo: repo,
        state: 'success',
        deployment_id: id,
    });
}

async function getDeployments(
    octokit: Octokit,
    environment: string,
    {
        owner,
        repo
    }: Context,
): Promise < DeploymentRef[] >
{
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        environment,
    });

    const deploymentRefs: DeploymentRef[] = data.map((deployment) => (
    {
        deploymentId: deployment.id,
        ref: deployment.ref,
    }));

    return deploymentRefs;
}

test.beforeEach((t) =>
{
    process.env.GITHUB_REPOSITORY = `${
    // set owner to enable test on forked repositories
    process.env.OWNER || 'Aetherinox'
  }/delete-deploy-env-action`;
    process.env.GITHUB_REF = 'main';
    github.context.ref = process.env.GITHUB_REF;

    const { GITHUB_TOKEN = '' } = process.env;
    const { repo, ref } = github.context;
    const octokit = new Octokit( { auth: GITHUB_TOKEN });

    t.context = {
        token: GITHUB_TOKEN,
        ref,
        octokit,
        repo,
    };

    process.env.INPUT_TOKEN = process.env.GITHUB_TOKEN;
});

test.serial( ' Successfully remove deployment ref only and not remove environment (multiple)',
    async (t) =>
    {

        const deployAmt = 10;
        const delayAmt = 500;
        const newRef = 'release/v3';
        const environment = 'test-remove-deployment-ref-only';

        const { octokit, repo, ref } = t.context;
        const context: Context = repo;

        await createEnvironment(octokit, environment, context);

        /*
            Create multiple deployments within the environment to test removing them all.
        */

        for (let i = 1; i <= deployAmt; i++) {
            await createDeploymentWithStatus(octokit, environment, { ...context, ref });
            console.log("Creating deployment for multitest")
            await delay(delayAmt);
        }

        /*
            Branch must exist to create a deployment in your other repo branch
        */

        await createDeploymentWithStatus(octokit, environment, { ...context, ref: newRef });

        /*
            Assign env variables
        */

        process.env.INPUT_ENVIRONMENT = environment;
        process.env.INPUT_REF = newRef;
        process.env.INPUT_ONLYREMOVEDEPLOYMENTS = 'true';

        /*
            Run main script
        */

        await main();
        let environmentExists = false;
        let deployments: DeploymentRef[] = [];

        try
        {
            const res = await octokit.request(
                'GET /repos/{owner}/{repo}/environments/{environment_name}',
                {
                    owner: repo.owner,
                    repo: repo.repo,
                    environment_name: environment,
                },
            );

            environmentExists = res.status === 200;
            deployments = await getDeployments(octokit, environment, context);
        }
        catch (err)
        {
            t.log(err);
            t.fail();
        }

        t.truthy(environmentExists);
        t.is(deployments.length, deployAmt);
        t.is(deployments[0].ref, 'main');

        // clean up main
        process.env.INPUT_REF = 'main';
        await main();
        // delete all artifacts
        delete process.env.INPUT_ONLYREMOVEDEPLOYMENTS;
        await main();
    },
);
