/* eslint-disable no-console */
import anyTest, { TestFn } from 'ava'
import * as github from '@actions/github'
import { Octokit } from '@octokit/core'
import { DeploymentRef, main } from '../src/execute'
import { RequestError } from '@octokit/request-error'

const test = anyTest as TestFn <
{
    token: string;
    ref: string;
    octokit: Octokit;
    repo:
    {
        owner: string;repo: string
    };
} >

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
    }: Context
): Promise < void >
{
    await octokit.request( 'PUT /repos/{owner}/{repo}/environments/{environment_name}',
    {
        owner,
        repo,
        environment_name: environmentName
    } )
}

/*
    Func > delay
*/

function delay( ms: number | 500 )
{
    return new Promise( ( resolve ) => setTimeout( resolve, ms ) )
}

/*
    Func > getNum
*/

// eslint-disable-next-line no-unused-vars
function getNum( num: string | '0' )
{
    return Math.floor( Number( num ) ) || 0
}

async function createDeploymentWithStatus(
    octokit: Octokit,
    environment: string,
    {
        owner,
        repo,
        ref = 'main'
    }: Context
): Promise < void >
{
    await octokit.request( 'POST /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        ref,
        environment,
        required_contexts: []
    } )

    const { data } = await octokit.request( 'GET /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        environment
    } )

    const [deployment] = data
    const { id } = deployment

    await octokit.request( 'POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses',
    {
        owner: owner,
        repo: repo,
        state: 'success',
        deployment_id: id
    } )
}

async function getDeployments(
    octokit: Octokit,
    environment: string,
    {
        owner,
        repo
    }: Context
): Promise < DeploymentRef[] >
{
    const { data } = await octokit.request( 'GET /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        environment
    } )

    const deploymentRefs: DeploymentRef[] = data.map( ( deployment ) => (
    {
        deploymentId: deployment.id,
        ref: deployment.ref
    } ) )

    return deploymentRefs
}

test.beforeEach( ( t ) =>
{
    process.env.GITHUB_REPOSITORY = `${
    // set owner to enable test on forked repositories
    process.env.OWNER || 'Aetherinox'
  }/delete-deploy-env-action`
    process.env.GITHUB_REF = 'main'
    github.context.ref = process.env.GITHUB_REF

    const { GITHUB_TOKEN = '' } = process.env
    const { repo, ref } = github.context
    const octokit = new Octokit( { auth: GITHUB_TOKEN } )

    t.context = {
        token: GITHUB_TOKEN,
        ref,
        octokit,
        repo
    }

    process.env.INPUT_TOKEN = process.env.GITHUB_TOKEN
} )

test.serial( ' Should successfully remove environment', async ( t ) =>
{
    t.timeout( 60000 )

    const { octokit, repo, ref } = t.context
    const context: Context = repo
    const environment = 'test-full-env-removal'

    try
    {
        await createEnvironment( octokit, environment, context )
        await createDeploymentWithStatus( octokit, environment,
        {
            ...context,
            ref
        } )
    }
    catch ( err )
    {
        t.log( err )
        t.fail()
    }

    process.env.INPUT_ENVIRONMENT = environment
    await main()
    let environmentExists = true

    try
    {
        await octokit.request(
            'GET /repos/{owner}/{repo}/environments/{environment_name}',
            {
                owner: repo.owner,
                repo: repo.repo,
                environment_name: environment
            }
        )
    }
    catch ( err )
    {
        // status 404 indicates that the environment cannot be found in the repo
        environmentExists = ( err as RequestError ).status === 404 ? false : true
    }
    t.falsy( environmentExists )
} )

test.serial( ' Should successfully remove deployments when environment has not been created',
    async ( t ) =>
    {
        const { octokit, repo, ref } = t.context
        const context: Context = repo
        const environment = 'test-remove-without-creating-environment'
        await createDeploymentWithStatus( octokit, environment, { ...context, ref } )
        process.env.INPUT_ENVIRONMENT = environment
        await main()
        let environmentExists = true

        try
        {
            await octokit.request(
                'GET /repos/{owner}/{repo}/environments/{environment_name}',
                {
                    owner: repo.owner,
                    repo: repo.repo,
                    environment_name: environment
                }
            )
        }
        catch ( err )
        {
            // status 404 indicates that the environment cannot be found in the repo
            environmentExists = ( err as RequestError ).status === 404 ? false : true
        }
        t.falsy( environmentExists )
        const deployments = await getDeployments( octokit, environment, context )
        t.is( deployments.length, 0 )
    }
)

test.serial( ' Should successfully remove deployments and not remove environment',
    async ( t ) =>
    {

        const { octokit, repo, ref } = t.context
        const context: Context = repo
        const environment = 'test-remove-deployments-only'

        await createEnvironment( octokit, environment, context )
        await createDeploymentWithStatus( octokit, environment, { ...context, ref } )

        process.env.INPUT_ENVIRONMENT = environment
        process.env.INPUT_ONLYREMOVEDEPLOYMENTS = 'true'

        await main()
        let environmentExists = false
        try
        {
            const res = await octokit.request( 'GET /repos/{owner}/{repo}/environments/{environment_name}',
            {
                owner: repo.owner,
                repo: repo.repo,
                environment_name: environment
            } )

            environmentExists = res.status === 200 ? true : false
        }
        catch ( err )
        {
            t.log( err )
            t.fail()
        }

        t.truthy( environmentExists )
        const deployments = await getDeployments( octokit, environment, context )
        t.is( deployments.length, 0 )

        // delete all artifacts
        console.log( ` › 🗑️ Clean up remaining trash & artifacts` )
        delete process.env.INPUT_ONLYREMOVEDEPLOYMENTS
        delete process.env.INPUT_LIMIT
        await main()
    }
)

/*
    Tests > Remove Deployments Only

    creates an environment and deployments.
    only removes the deployment and keep the environment behind.
*/

test.serial( ' Successfully remove deployment ref only and not remove environment',
    async ( t ) =>
    {
        const environment = 'test-remove-deployment-ref-only'
        const { octokit, repo, ref } = t.context
        const context: Context = repo

        await createEnvironment( octokit, environment, context )
        await createDeploymentWithStatus( octokit, environment, { ...context, ref } )

        // make sure this branch exists to create another deployment
        const newRef = 'release/v3'
        await createDeploymentWithStatus( octokit, environment, { ...context, ref: newRef } )

        process.env.INPUT_ENVIRONMENT = environment
        process.env.INPUT_REF = newRef
        process.env.INPUT_ONLYREMOVEDEPLOYMENTS = 'true'

        await main()
        let environmentExists = false
        let deployments: DeploymentRef[] = []

        try
        {
            const res = await octokit.request(
                'GET /repos/{owner}/{repo}/environments/{environment_name}',
                {
                    owner: repo.owner,
                    repo: repo.repo,
                    environment_name: environment
                }
            )

            environmentExists = res.status === 200
            deployments = await getDeployments( octokit, environment, context )
        }
        catch ( err )
        {
            t.log( err )
            t.fail()
        }

        t.truthy( environmentExists )
        t.is( deployments.length, 1 )
        t.is( deployments[ 0 ].ref, 'main' )

        // clean up main
        process.env.INPUT_REF = 'main'
        await main()

        // delete all artifacts
        console.log( ` › 🗑️ Clean up remaining trash & artifacts` )
        delete process.env.INPUT_ONLYREMOVEDEPLOYMENTS
        delete process.env.INPUT_LIMIT
        await main()
    }
)

/*
    Tests > Remove Multiple Deployments

    Generates multiple deployments in the same environment and deletes them.
    Also tests a delay between each deployment deleted.
*/

test.serial( ' Successfully remove multiple deployments only and not remove environment using delay',
    async ( t ) =>
    {

        const deployAmt = 10                   // number of deployments to create
        const delayAmt = 500                   // delay between each deployment removed
        const newRef = 'release/v3'
        const environment = 'test-remove-deployment-ref-only'

        const { octokit, repo, ref } = t.context
        const context: Context = repo

        await createEnvironment( octokit, environment, context )

        /*
            Create multiple deployments within the environment to test removing them all.
        */

        console.log( `\n` )
        for ( let i = 1; i <= deployAmt; i++ )
        {
            await createDeploymentWithStatus( octokit, environment, { ...context, ref } )
            console.log( ` › ➕ Create test deployment for multitest › \x1b[38;5;13mref ${ ref }\x1b[0m` )
            await delay( delayAmt )
        }

        /*
            Branch must exist to create a deployment in your other repo branch
        */

        await createDeploymentWithStatus( octokit, environment, { ...context, ref: newRef } )

        /*
            Assign env variables
        */

        process.env.INPUT_ENVIRONMENT = environment
        process.env.INPUT_REF = newRef
        process.env.INPUT_ONLYREMOVEDEPLOYMENTS = 'true'

        /*
            Run main script
        */

        await main()
        let environmentExists = false
        let deployments: DeploymentRef[] = []

        try
        {
            const res = await octokit.request(
                'GET /repos/{owner}/{repo}/environments/{environment_name}',
                {
                    owner: repo.owner,
                    repo: repo.repo,
                    environment_name: environment
                }
            )

            environmentExists = res.status === 200
            deployments = await getDeployments( octokit, environment, context )
        }
        catch ( err )
        {
            t.log( err )
            t.fail()
        }

        t.truthy( environmentExists )
        t.is( deployments.length, deployAmt )
        t.is( deployments[ 0 ].ref, 'main' )

        // clean up main
        process.env.INPUT_REF = 'main'
        await main()

        // delete all artifacts
        console.log( ` › 🗑️ Clean up remaining trash & artifacts` )
        delete process.env.INPUT_ONLYREMOVEDEPLOYMENTS
        delete process.env.INPUT_LIMIT
        await main()
    }
)

/*
    Test > Delete limited number of items

    addds 10 deployments to an environment and then deletes 4.
    A remaining 6 should return left over which will be checked against the test results
*/

test.serial( ' Successfully deleted limited results',
    async ( t ) =>
    {

        const deployAmt = 10                   // number of deployments to create
        const delayAmt = 500                   // delay between each deployment removed
        const environment = 'test-remove-deployment-ref-only'
        process.env.INPUT_REF = 'main'

        const { octokit, repo, ref } = t.context
        const context: Context = repo

        /*
            Create Environment
        */

        await createEnvironment( octokit, environment, context )

        /*
            Create multiple deployments within the environment to test removing them a certain number.
        */

        console.log( `\n` )
        for ( let i = 1; i <= deployAmt; i++ )
        {
            await createDeploymentWithStatus( octokit, environment, { ...context, ref } )
            console.log( ` › ➕ Create test deployment for multitest › \x1b[38;5;13mref ${ ref }\x1b[0m` )
            await delay( delayAmt )
        }

        /*
            Assign env variables
        */

        process.env.INPUT_ENVIRONMENT = environment
        process.env.INPUT_ONLYREMOVEDEPLOYMENTS = 'true'
        process.env.INPUT_LIMIT = '4'

        /*
            Run script to remove LIMIT number of deployments. This should mean 6 remain
        */

        await main()

        /*
            Prepare to fetch deployments left over
        */

        let deploymentStatus = false
        let deployments: DeploymentRef[] = []

        /*
            Get remaining deployments
        */

        try
        {
            const res = await octokit.request( 'GET /repos/{owner}/{repo}/deployments',
            {
                owner: repo.owner,
                repo: repo.repo,
                environment_name: environment
            } )

            deploymentStatus = res.status === 200
            deployments = await getDeployments( octokit, environment, context )
        }
        catch ( err )
        {
            t.log( err )
            t.fail()
        }

        /*
            Test Results
        */

        t.truthy( deploymentStatus )
        t.is( deployments.length, 6 )
        t.is( deployments[ 0 ].ref, 'main' )

        /*
            Clean up remaining stuff left over
        */

        // delete all artifacts
        console.log( ` › 🗑️ Clean up remaining trash & artifacts` )
        delete process.env.INPUT_ONLYREMOVEDEPLOYMENTS
        delete process.env.INPUT_LIMIT
        await main()
    }
)
