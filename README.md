<div align="center">
<h6>Github action which allows you to delete deployments and environments</h6>
<h1>♾️ Delete Deployments and Environment ♾️</h1>

<br />

<p>

A github action which allows you to delete deployments and environments.

</p>

<br />
<br />

</div>

<div align="center">

<!-- prettier-ignore-start -->
[![Version][github-version-img]][github-version-uri]
[![Downloads][github-downloads-img]][github-downloads-uri]
[![Size][github-size-img]][github-size-img]
[![Last Commit][github-commit-img]][github-commit-img]
[![Contributors][contribs-all-img]](#contributors-)
<!-- prettier-ignore-end -->

<br />

</div>

<br />

---

<br />

- [About](#about)
  - [Obtain A Token](#obtain-a-token)
    - [Example](#example)
- [Inputs](#inputs)
- [Usage](#usage)
  - [Deactivate / Remove Deployment Environment (also from settings)](#deactivate--remove-deployment-environment-also-from-settings)
  - [Deactivate / Remove Deployment Environment](#deactivate--remove-deployment-environment)
  - [Deactivates and removes a deployment ref of a given environment](#deactivates-and-removes-a-deployment-ref-of-a-given-environment)
  - [Deactivates deployment environment](#deactivates-deployment-environment)
  - [Avoid Secondary Rate Limiting](#avoid-secondary-rate-limiting)
  - [Limit Deployments Removed](#limit-deployments-removed)
- [Rate Limits](#rate-limits)
- [Contributors ✨](#contributors-)


<br />

---

<br />

## About

GitHub action that will find and delete all deployments by deployment name as well as the GitHub environment
they are deployed to. It will first find and mark all deployments as `inactive` and then delete all deployments and then the environment.

- To only delete deployments and the not environment, add `onlyRemoveDeployments: true`.
- To keep deployments but inactivate all deployments, add `onlyDeactivateDeployments: true`
- To only delete a deployment ref and not all deployments of a given environment, add `ref: my-branch`

Note if you pass `onlyDeactivateDeployments: true` and `onlyRemoveDeployments: true`, `onlyRemoveDeployments` will override
`onlyDeactivateDeployments` and all deployments will be removed.

Also note that if you are planning on deleting a created environment, your `GITHUB_TOKEN` must have permissions with repo scope. The token provided by the workflow, `github.token` does not have the permissions to delete created environments. _(See [Delete an environment REST API docs](https://docs.github.com/en/rest/reference/repos#delete-an-environment))_

If you see a `Resource not accessible by integration` error, you'll likely need to follow the instructions below to obtain the proper token.

<br />

### Obtain A Token

For certain operations _(like deleting an environment)_, your GitHub Action will need additional permissions that your `github.token` simply doesn't have.

<br />

In this case, a [GitHub App](https://docs.github.com/en/developers/apps/getting-started-with-apps/about-apps) can be created to assume the required permissions, and ultimately your own Actions will use a [Private Key](https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#generating-a-private-key) to later exchange for a JWT token, which this Action can use to execute operations.

<br />

1. [Create a GitHub app](https://docs.github.com/en/developers/apps/building-github-apps/creating-a-github-app).
2. [Generate a Private Key](https://docs.github.com/en/developers/apps/building-github-apps/authenticating-with-github-apps#generating-a-private-key)
3. Add your GitHub App's "App ID" to your repo's [Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) _(ex: `GH_APP_ID`)_
4. Add your Private Key to your repo's [Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) _(ex: `GH_APP_PRIVATE_KEY`)_
5. Use [navikt/github-app-token-generator](https://github.com/navikt/github-app-token-generator) before using this action to generate a JWT

   <br />

   #### Example

   `cleanup-pr.yml`

   ```yml
   #
   # Cleans up a GitHub PR
   #
   name: 🧼 Clean up environment
   on:
   pull_request:
     types:
       - closed

   jobs:
     cleanup:
       runs-on: ubuntu-latest
       permissions: write-all

       steps:
         - uses: actions/checkout@v3

         # Points to a recent commit instead of `main` to avoid supply chain attacks. (The latest tag is very old.)
         - name: 🎟 Get GitHub App token
           uses: navikt/github-app-token-generator@a3831f44404199df32d8f39f7c0ad9bb8fa18b1c
           id: get-token
           with:
             app-id: ${{ secrets.GH_APP_ID }}
             private-key: ${{ secrets.GH_APP_PRIVATE_KEY }}

         - name: 🗑 Delete deployment environment
           uses: Aetherinox/delete-deploy-env-action@v2.2.3
           with:
             # Use a JWT created with your GitHub App's private key
             token: ${{ steps.get-token.outputs.token }}
             environment: pr-${{ github.event.number }}
             ref: ${{ github.ref_name }}
   ```

<br />

---

<br />

## Inputs

| name                        | description                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `token`                     | GitHub token like `${{ github.token }}` or `${{ secrets.GITHUB_TOKEN }}`                |
| `environment`               | The Name of the environment to delete                                                   |
| `onlyRemoveDeployments`     | Delete deployments and not the environment. Default `false`                             |
| `onlyDeactivateDeployments` | Deactivate the deployments but don't remove deployments or environment. Default `false` |
| `ref`                       | The name of the deployment ref to delete                                                |
| `delay`                     | Milliseconds to wait between each action.  Avoids secondary rate limit. Default: `500`  |
| `limit`                     | Allows you to target deleting X deployments under the max of `100`. Default: `100`      |

<br />

---

<br />

## Usage
To use this workflow, view the following examples below:

<br />

### Deactivate / Remove Deployment Environment (also from settings)
The example below will be triggered on a delete event.
- ✔️ Deactivates deployment
- ✔️ Removes from deployments tab
- ✔️ Removes from environment tab in settings

<br />

```yaml
name: Delete Environment (default settings)

on:
  delete:
    branches-ignore:
      - main

jobs:
  delete:
    runs-on: ubuntu-latest
    steps:
      - uses: Aetherinox/delete-deploy-env-action@v2
        with:
          # ⚠️ The provided token needs permission for admin write:org
          token: ${{ secrets.GITHUB_TOKEN }}
          environment: my-environment-name
```

<br />

### Deactivate / Remove Deployment Environment
The example below will be triggered on a delete event.
- ✔️ Deactivates deployment
- ✔️ Removes from deployments tab
- ❌ Removes from environment tab in settings

<br />

```yaml
name: Delete Deployments

on:
  delete:
    branches-ignore:
      - main

jobs:
  delete:
    runs-on: ubuntu-latest
    steps:
      - uses: Aetherinox/delete-deploy-env-action@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          environment: my-environment-name
          onlyRemoveDeployments: true
```

<br />

### Deactivates and removes a deployment ref of a given environment

The example below will be triggered on a delete event.

- ✔️ Deactivates deployment
- ✔️ Removes from deployments tab
- ✔️ Removes only a deployment ref
- ❌ Removes from environment tab in settings

<br />

```yaml
name: Delete Deployments Ref

on:
  delete:
    branches-ignore:
      - main

jobs:
  delete:
    runs-on: ubuntu-latest
    steps:
      - uses: Aetherinox/delete-deploy-env-action@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          environment: my-environment-name
          ref: my-branch
          onlyRemoveDeployments: true
```

<br />

### Deactivates deployment environment
The example below will be triggered on a delete event.
- ✔️ Deactivates deployment
- ❌ Removes from deployments tab
- ❌ Removes from environment tab in settings

<br />

```yaml
name: Set deployements to inactive

on:
  delete:
    branches-ignore:
      - main

jobs:
  delete:
    runs-on: ubuntu-latest
    steps:
      - uses: Aetherinox/delete-deploy-env-action@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          environment: my-environment-name
          onlyDeactivateDeployments: true
```

<br />

### Avoid Secondary Rate Limiting
No more than 100 concurrent requests are allowed. and mo more than 900 points per minute are allowed for REST API endpoints. This limit is shared across the Github REST API and GraphQL API. To handle this rate limiting issue, we've implemented a delay that be specified within your workflow. In the example below, we add the property `delay`, and set it to `500 milliseconds`.  This means that if you have a large number of deployments you wish to erase, it will take longer than a minute, but you can easily walk away and the workflow will complete successfully without throwing a **Secondary rate limit** error.

```yml
jobs:
    cleanup:
        runs-on: ubuntu-latest
        permissions: write-all

        steps:
          - name: >-
              ⚙️ Deployments › Clean
            uses: Aetherinox/delete-deploy-env-action@v3.0.0
            with:
              token: ${{ secrets.GITHUB_TOKEN }}
              environment: orion
              onlyRemoveDeployments: true
              delay: "500"
```

<br />

### Limit Deployments Removed
You may specify a custom value to represent how many deployments you want to remove from your deployment history. The default value is `100` which is the max that is allowed by the Github REST API. The following example will delete **43** deployments from your history:

```yml
jobs:
    cleanup:
        runs-on: ubuntu-latest
        permissions: write-all

        steps:
          - name: >-
              ⚙️ Deployments › Clean
            uses: Aetherinox/delete-deploy-env-action@v3.0.0
            with:
              token: ${{ secrets.GITHUB_TOKEN }}
              environment: orion
              onlyRemoveDeployments: true
              limit: 43
```

<br />

If you wish to delete more than the `100` max limit, you must combine the property `limit` with `delay`. The example below will delete `165 deployments`, but with a delay of `500 milliseconds` between each deployment removed from your history.

```yml
jobs:
    cleanup:
        runs-on: ubuntu-latest
        permissions: write-all

        steps:
          - name: >-
              ⚙️ Deployments › Clean
            uses: Aetherinox/delete-deploy-env-action@v3.0.0
            with:
              token: ${{ secrets.GITHUB_TOKEN }}
              environment: orion
              onlyRemoveDeployments: true
              delay: 500
              limit: 165
```

<br />

---

<br />

## Rate Limits
Remember that Github has implemented rate limits on how many actions you can perform. If you would like to see your current limits, open up a Command Prompt / Terminal, and run the following CURL command. Replace `<YOUR-TOKEN>` with your Github API token.

```
curl -L -H "Accept: application/vnd.github+json" -H "Authorization: Bearer <YOUR-TOKEN>" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/rate_limit
```

<br />

You should see the following:
```json
{
  "resources": {
    "core": {
      "limit": 10000,
      "used": 27,
      "remaining": 9973,
      "reset": 1729024173
    },
    "search": {
      "limit": 30,
      "used": 0,
      "remaining": 30,
      "reset": 1729020821
    },
    "graphql": {
      "limit": 5000,
      "used": 1,
      "remaining": 4999,
      "reset": 1729022213
    },
    "integration_manifest": {
      "limit": 5000,
      "used": 0,
      "remaining": 5000,
      "reset": 1729024361
    },
    "source_import": {
      "limit": 100,
      "used": 0,
      "remaining": 100,
      "reset": 1729020821
    },
    "code_scanning_upload": {
      "limit": 1000,
      "used": 0,
      "remaining": 1000,
      "reset": 1729024361
    },
    "actions_runner_registration": {
      "limit": 10000,
      "used": 0,
      "remaining": 10000,
      "reset": 1729024361
    },
    "scim": {
      "limit": 15000,
      "used": 0,
      "remaining": 15000,
      "reset": 1729024361
    },
    "dependency_snapshots": {
      "limit": 100,
      "used": 0,
      "remaining": 100,
      "reset": 1729020821
    },
    "audit_log": {
      "limit": 1750,
      "used": 0,
      "remaining": 1750,
      "reset": 1729024361
    },
    "audit_log_streaming": {
      "limit": 15,
      "used": 0,
      "remaining": 15,
      "reset": 1729024361
    },
    "code_search": {
      "limit": 10,
      "used": 0,
      "remaining": 10,
      "reset": 1729020821
    }
  },
  "rate": {
    "limit": 10000,
    "used": 27,
    "remaining": 9973,
    "reset": 1729024173
  }
}
```

<br />

To see your rate limit for mangaging your repo environment and deleting deployments with tools such as this Github action, view the `core` object.

<br />

> [!NOTE]
> The `rate` object is deprecated. If you're writing new API client code or updating existing code, you should use the `core` object instead of the rate object. The `core` object contains the same information that is present in the rate object.

<br />

You may also see your rate limit by accessing the Github REST API and calling the headers for your repo. Replace `<YOUR-TOKEN>` with your Github API token:

```shell
curl -I -L -H "Accept: application/vnd.github+json" -H "Authorization: Bearer <YOUR-TOKEN>" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/repos/OWNER/REPO/environments/ENVIRONMENT_NAME
```

<br />

You will see:
```console
x-github-api-version-selected: 2022-11-28
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9967
X-RateLimit-Reset: 1729024173
X-RateLimit-Used: 33
X-RateLimit-Resource: core
```

<br />



<br />

---

<br />

## Contributors ✨
We are always looking for contributors. If you feel that you can provide something useful to Gistr, then we'd love to review your suggestion. Before submitting your contribution, please review the following resources:

- [Pull Request Procedure](.github/PULL_REQUEST_TEMPLATE.md)
- [Contributor Policy](CONTRIBUTING.md)

<br />

Want to help but can't write code?
- Review [active questions by our community](https://github.com/Aetherinox/delete-deploy-env-action/labels/help%20wanted) and answer the ones you know.

<br />

![Alt](https://repobeats.axiom.co/api/embed/affb6023065a4021a21bb3bcc958eb77765ff0ea.svg "Repobeats analytics image")

<br />

The following people have helped get this project going:

<br />

<div align="center">

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![Contributors][contribs-all-img]](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top"><a href="https://gitlab.com/Aetherinox"><img src="https://avatars.githubusercontent.com/u/118329232?v=4?s=40" width="80px;" alt="Aetherinox"/><br /><sub><b>Aetherinox</b></sub></a><br /><a href="https://github.com/Aetherinox/delete-deploy-env-action/commits?author=Aetherinox" title="Code">💻</a> <a href="#projectManagement-Aetherinox" title="Project Management">📆</a> <a href="#fundingFinding-Aetherinox" title="Funding Finding">🔍</a></td>
    </tr>
  </tbody>
</table>
</div>
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

<br />
<br />

<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- BADGE > GENERAL -->
  [general-npmjs-uri]: https://npmjs.com
  [general-nodejs-uri]: https://nodejs.org
  [general-npmtrends-uri]: http://npmtrends.com/delete-deploy-env-action

<!-- BADGE > VERSION > GITHUB -->
  [github-version-img]: https://img.shields.io/github/v/tag/Aetherinox/delete-deploy-env-action?logo=GitHub&label=Version&color=ba5225
  [github-version-uri]: https://github.com/Aetherinox/delete-deploy-env-action/releases

<!-- BADGE > VERSION > NPMJS -->
  [npm-version-img]: https://img.shields.io/npm/v/delete-deploy-env-action?logo=npm&label=Version&color=ba5225
  [npm-version-uri]: https://npmjs.com/package/delete-deploy-env-action

<!-- BADGE > VERSION > PYPI -->
  [pypi-version-img]: https://img.shields.io/pypi/v/delete-deploy-env-action-plugin
  [pypi-version-uri]: https://pypi.org/project/delete-deploy-env-action-plugin/

<!-- BADGE > LICENSE > MIT -->
  [license-mit-img]: https://img.shields.io/badge/MIT-FFF?logo=creativecommons&logoColor=FFFFFF&label=License&color=9d29a0
  [license-mit-uri]: https://github.com/Aetherinox/delete-deploy-env-action/blob/main/LICENSE

<!-- BADGE > GITHUB > DOWNLOAD COUNT -->
  [github-downloads-img]: https://img.shields.io/github/downloads/Aetherinox/delete-deploy-env-action/total?logo=github&logoColor=FFFFFF&label=Downloads&color=376892
  [github-downloads-uri]: https://github.com/Aetherinox/delete-deploy-env-action/releases

<!-- BADGE > NPMJS > DOWNLOAD COUNT -->
  [npmjs-downloads-img]: https://img.shields.io/npm/dw/%40aetherinox%2Fcsf-firewall?logo=npm&&label=Downloads&color=376892
  [npmjs-downloads-uri]: https://npmjs.com/package/delete-deploy-env-action

<!-- BADGE > GITHUB > DOWNLOAD SIZE -->
  [github-size-img]: https://img.shields.io/github/repo-size/Aetherinox/delete-deploy-env-action?logo=github&label=Size&color=59702a
  [github-size-uri]: https://github.com/Aetherinox/delete-deploy-env-action/releases

<!-- BADGE > NPMJS > DOWNLOAD SIZE -->
  [npmjs-size-img]: https://img.shields.io/npm/unpacked-size/delete-deploy-env-action/latest?logo=npm&label=Size&color=59702a
  [npmjs-size-uri]: https://npmjs.com/package/delete-deploy-env-action

<!-- BADGE > CODECOV > COVERAGE -->
  [codecov-coverage-img]: https://img.shields.io/codecov/c/github/Aetherinox/delete-deploy-env-action?token=MPAVASGIOG&logo=codecov&logoColor=FFFFFF&label=Coverage&color=354b9e
  [codecov-coverage-uri]: https://codecov.io/github/Aetherinox/delete-deploy-env-action

<!-- BADGE > ALL CONTRIBUTORS -->
  [contribs-all-img]: https://img.shields.io/github/all-contributors/Aetherinox/delete-deploy-env-action?logo=contributorcovenant&color=de1f6f&label=contributors
  [contribs-all-uri]: https://github.com/all-contributors/all-contributors

<!-- BADGE > GITHUB > BUILD > NPM -->
  [github-build-img]: https://img.shields.io/github/actions/workflow/status/Aetherinox/delete-deploy-env-action/npm-release.yml?logo=github&logoColor=FFFFFF&label=Build&color=%23278b30
  [github-build-uri]: https://github.com/Aetherinox/delete-deploy-env-action/actions/workflows/npm-release.yml

<!-- BADGE > GITHUB > BUILD > Pypi -->
  [github-build-pypi-img]: https://img.shields.io/github/actions/workflow/status/Aetherinox/delete-deploy-env-action/release-pypi.yml?logo=github&logoColor=FFFFFF&label=Build&color=%23278b30
  [github-build-pypi-uri]: https://github.com/Aetherinox/delete-deploy-env-action/actions/workflows/pypi-release.yml

<!-- BADGE > GITHUB > TESTS -->
  [github-tests-img]: https://img.shields.io/github/actions/workflow/status/Aetherinox/delete-deploy-env-action/npm-tests.yml?logo=github&label=Tests&color=2c6488
  [github-tests-uri]: https://github.com/Aetherinox/delete-deploy-env-action/actions/workflows/npm-tests.yml

<!-- BADGE > GITHUB > COMMIT -->
  [github-commit-img]: https://img.shields.io/github/last-commit/Aetherinox/delete-deploy-env-action?logo=conventionalcommits&logoColor=FFFFFF&label=Last%20Commit&color=313131
  [github-commit-uri]: https://github.com/Aetherinox/delete-deploy-env-action/commits/main/

<!-- prettier-ignore-end -->
<!-- markdownlint-restore -->
