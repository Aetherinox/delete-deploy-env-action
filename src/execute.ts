/* eslint-disable no-console */
import { getInput, setFailed, info, error } from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/core'
import { RequestError } from '@octokit/request-error'

interface ListDeploymentIDs { owner: string; repo: string; environment: string; ref: string; limit: number }
interface Deployment { owner: string;repo: string;deploymentId: number }
interface Context { owner: string;repo: string }
export interface DeploymentRef { deploymentId: number;ref: string }

/*
    Func > getNum
*/

function getNum( num: string | '0' )
{
    return Math.floor( Number( num ) ) || 0
}

/*
    Func > List Deployments
*/

async function listDeployments( client: Octokit, { owner, repo, environment, ref = '', limit = 100 }: ListDeploymentIDs, page = 0 ): Promise < DeploymentRef[] >
{

    info( `      › 📝 Searching \x1b[38;5;9menv ${ environment }\x1b[0m` )

    const { data } = await client.request( 'GET /repos/{owner}/{repo}/deployments',
    {
        owner,
        repo,
        environment,
        ref,
        per_page: limit, // number of items per page, max 100
        page
    } )

    /*
        Limit not reached || limit set to default 100
            loop function again to page 2+
    */

    const deploymentRefs: DeploymentRef[] = data.map( ( deployment ) => ( { deploymentId: deployment.id, ref: deployment.ref } ) )
    const itemsTotal = deploymentRefs.length

    if ( !limit || limit === 100 )
{
        info( `      › ⚙️ Using default limit of \x1b[38;5;1m${ limit }\x1b[0m` )
        if ( itemsTotal === 100 )
            return deploymentRefs.concat( await listDeployments( client, { owner, repo, environment, ref, limit }, page + 1 ) )

    /*
        user specified custom limit
    */

    }
 else if ( limit >= 100 )
{
        const pagesNeeded = Math.ceil( limit / 100 )

        /*
            if total items is less than limit
            if current page number less than number of pages needed
        */

        if ( itemsTotal < limit && page < pagesNeeded )
{
            info( `      › ⚙️ Using custom limit of \x1b[38;5;1m${ limit }\x1b[0m › reading page \x1b[38;5;32mpage ${ page }/${ pagesNeeded }\x1b[0m` )
            return deploymentRefs.concat( await listDeployments( client, { owner, repo, environment, ref, limit }, page + 1 ) )
        }
    }

    /*
        Done getting items, return deployment list
    */

    info( `      › 📚 Finished fetching deployment results` )

    return deploymentRefs
}

/*
    Func > Deployments > Set Inactive
*/

async function setDeploymentInactive( client: Octokit, { owner, repo, deploymentId }: Deployment ): Promise < void >
{
    info( `      › ✔️ ID \x1b[38;5;8m${ deploymentId }\x1b[0m inactive` )
    await client.request( 'POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses',
    {
        owner,
        repo,
        deployment_id: deploymentId,
        state: 'inactive'
    } )
}

/*
    Func > Deployments > Delete by ID
*/

async function deleteDeploymentById( client: Octokit, { owner, repo, deploymentId }: Deployment ): Promise < void >
{
    info( `      › ✔️ ID \x1b[38;5;8m${ deploymentId }\x1b[0m deleted` )
    await client.request( 'DELETE /repos/{owner}/{repo}/deployments/{deployment_id}',
    {
        owner,
        repo,
        deployment_id: deploymentId
    } )
}

/*
    Func > Environment > Delete
*/

async function deleteTheEnvironment( client: Octokit, environment: string, { owner, repo }: Context ): Promise < void >
{

    let existingEnv = false

    try
    {
        const getEnvResult = await client.request( 'GET /repos/{owner}/{repo}/environments/{environment_name}',
        {
            owner,
            repo,
            environment_name: environment
        } )

        existingEnv = typeof getEnvResult === 'object'
    }
    catch ( err )
    {
        if ( ( err as RequestError ).status !== 404 )
        {
            error( 'Error deleting environment' )
            throw err
        }
    }

    if ( existingEnv )
    {
        info( `   › 🗑️ Deleting \x1b[38;5;9menv ${ environment }\x1b[0m` )
        await client.request( 'DELETE /repos/{owner}/{repo}/environments/{environment_name}',
        {
            owner,
            repo,
            environment_name: environment
        } )

        info( `      › ✔️ Deleted` )
    }
}

/*
    Func > Github Action > Main
*/

export async function main(): Promise < void >
{
    let deleteDeployment = true
    let deleteEnvironment = true

    const { context } = github
    const token: string = getInput( 'token', { required: true } )
    const environment: string = getInput( 'environment', { required: true } )
    const onlyRemoveDeployments: string = getInput( 'onlyRemoveDeployments', { required: false } )
    const onlyDeactivateDeployments: string = getInput( 'onlyDeactivateDeployments', { required: false } )
    const delayTime: number = getNum( getInput( 'delay', { required: false } ) || '500' )
    const limit: number = getNum( getInput( 'limit', { required: false } ) || '100' )
    const ref: string = getInput( 'ref', { required: false } )

    info( '\n' )
    info( ` › 🛫 Starting Deployment Deletion action` )

    const client: Octokit = github.getOctokit( token,
    {
        throttle:
        {
            onRateLimit: ( retryAfter = 0, options: any ) =>
            {
                console.warn( `Request quota exhausted for request ${ options.method } ${ options.url }` )
                if ( options.request.retryCount === 0 )
                {
                    // only retries once
                    console.log( `Retrying after ${ retryAfter } seconds!` )
                    return true
                }
            },
            onAbuseLimit: ( retryAfter = 0, options: any ) =>
            {
                console.warn( `Abuse detected for request ${ options.method } ${ options.url }` )
                if ( options.request.retryCount === 0 )
                {
                    // only retries once
                    console.log( `Retrying after ${ retryAfter } seconds!` )
                    return true
                }
            }
        },
        previews: ['ant-man']
    } )

    if ( onlyDeactivateDeployments === 'true' )
    {
        deleteDeployment = false
        deleteEnvironment = false
    }
    else if ( onlyRemoveDeployments === 'true' )
    {
        deleteEnvironment = false
    }

    info( `   › 📋 Collect list of deployments` )

    try
    {
        const deploymentRefs = await listDeployments( client, { ...context.repo, environment, ref, limit } )

        info( `      › 🔍 Found \x1b[38;5;32m${ deploymentRefs.length } deployments\x1b[0m for \x1b[38;5;13mref ${ ref }\x1b[0m` )

        let deploymentIds: number[]
        let deleteDeploymentMessage: string
        let deactivateDeploymentMessage: string
        let delayStart = 0
        const delayIncrement = delayTime

        if ( ref.length > 0 )
        {
            deleteDeploymentMessage = `   › 🗑️ Deleting deployment \x1b[38;5;13mref ${ ref }\x1b[0m in \x1b[38;5;9menv ${ environment }\x1b[0m`
            deactivateDeploymentMessage = `   › 🔴 Deactivating deployment \x1b[38;5;13mref ${ ref }\x1b[0m in \x1b[38;5;9menv ${ environment }\x1b[0m`
            deploymentIds = deploymentRefs
                .filter( ( deployment ) => deployment.ref === ref )
                .map( ( deployment ) => deployment.deploymentId )
        }
        else
        {
            deleteDeploymentMessage = `   › 🗑️ Deleting all ${ deploymentRefs.length } deployments in \x1b[38;5;9menv ${ environment }\x1b[0m`
            deactivateDeploymentMessage = `   › 🔴 Deactivating all ${ deploymentRefs.length } deployments in \x1b[38;5;9menv ${ environment }\x1b[0m`
            deploymentIds = deploymentRefs.map(
                ( deployment ) => deployment.deploymentId
            )
        }

        info( deactivateDeploymentMessage )

        /*
            So that we don't hit the secondary rate limit, add a delay between each action in the promise
        */

        const promiseInactive = deploymentIds.map( ( deploymentId ) =>
        {
            delayStart += delayIncrement
            return new Promise( ( resolve ) => setTimeout( resolve, delayStart ) ).then( () =>
                setDeploymentInactive( client, { ...context.repo, deploymentId } ) )
        } )

        await Promise.all( promiseInactive )

        /*
            Action > Delete Deployment
        */

        if ( deleteDeployment )
        {
            info( deleteDeploymentMessage )

            /*
                So that we don't hit the secondary rate limit, add a delay between each action in the promise
            */

            const promiseDelete = deploymentIds.map( ( deploymentId ) =>
            {
                delayStart += delayIncrement
                return new Promise( ( resolve ) => setTimeout( resolve, delayStart ) ).then( () =>
                    deleteDeploymentById( client, { ...context.repo, deploymentId } ) )
            } )

            /*
                Promise kept
            */

            await Promise.all( promiseDelete )
        }

        if ( deleteEnvironment )
        {
            await deleteTheEnvironment( client, environment, context.repo )
        }

        info( '   › ✔️ Action completed successfully' )

    }
    catch ( err )
    {
        setFailed( ( err as RequestError ).message )
    }
}
