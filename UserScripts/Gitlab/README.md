# Gitlab scripts

Here are some scripts be injected into Gitlab website to enhance the user experience.

## How to install

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click the script you want to install.
3. Click the `Raw` button to view the script.
4. Copy/paste the script into your userscript manager.

## Scripts

| Name                                                                                         | Description                                                                                                             |
| :------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| [Configuration for Gitlab scripts](./gitlab-scripts-config.js)                               | Script containing the configuration for the other scripts.                                                              |
| [Run pipeline helper](./gitlab-new-pipeline-helper.js)                                       | Autofill variables form when running a new pipeline.                                                                    |
| [Print pipeline variables](./gitlab-print-pipeline-variables.js)                             | Adds a container to the pipeline view to see the variables you had set manually to run the pipeline.                    |
| [Custom Gitlab shortcuts](./gitlab-shortcuts.js)                                             | Adds custom shortcuts to Gitlab.                                                                                        |
| [Create merge request on other projects from an issue](./gitlab-merge-request-from-issue.js) | Allows to create merge requestes on other projects from an issue. It will not create an issue on the selected projects. |

## Configuration

All scripts (except [`Custom Gitlab shortcuts`](./gitlab-shortcuts.js)) use the configuration from [`Configuration for Gitlab scripts`](./gitlab-scripts-config.js).
You can change the configuration to your needs.

### Configuration - Global

> _Configuration is to be defined within the file [`Configuration for Gitlab scripts`](./gitlab-scripts-config.js)_

The `API_PRIVATE_TOKEN` is the private token used to access the Gitlab API. \
It should only have the authorization to read the projects and pipelines. \
Refer to the [Gitlab documentation][gitlab-token] to create a private token.

```javascript
const GITLAB_SCRIPTS_CONFIG = {
    // ...
    API_PRIVATE_TOKEN: "", // replace with your private token
};
```

### Configuration - `Run pipeline helper`

> _Configuration is to be defined within the file [`Configuration for Gitlab scripts`](./gitlab-scripts-config.js)_

The `DICTIONARY` object contains the description for each variable. \
The `DEFAULT` object contains the default value for each projects that do not have a specific configurtion. \
The `PER_PROJECT` object contains the variables that should be added to the pipeline variables for a specific project.

The configuration in the `PER_PROJECT` object has the higher precedence. \
Then the `DEFAULT` object and finally the `DICTIONARY` object.

The script also uses local storage to store the values used the last time you launched a pipeline for the project you're currently working on. \
If you've already run a pipeline with this script in the past, the last variables used are stored in local storage and have the highest precedence.

Which can be summarized as: \
Order of description: `PER_PROJECT` -> `DEFAULT` -> `DICTIONARY` \
Order of value: `Local storage` -> `PER_PROJECT` -> `DEFAULT`

```javascript
const GITLAB_SCRIPTS_CONFIG = {
    // ...
    PIPELINE_VARIABLES: {
        DICTIONARY: {
            variable1: "This is the gloable description of variable 1",
            variable2: "This is the gloable description of variable 2",
            variable3: "This is the gloable description of variable 3",
            variable4: "This is the gloable description of variable 4",
        },
        DEFAULT: {
            variable1: {
                value: "value1",
                description: 'This will override the "DICTIONARY" description fro variable1.',
            },
            variable2: {
                value: "value2",
                description: 'This will override the "DICTIONARY" description fro variable2.',
            },
            variable3: "value3",
        },
        PER_PROJECT: {
            "https://gitlab.com/some-project": {
                // override the default value for the project some-project. It will not override the description and use the DEFAULT one
                variable1: "not value1",
                variable2: {
                    value: "not value2", // override the value for the project some-project
                    description: "This is a description for variable2 for the project some-project", // override the description for the project some-project
                },
                "another-variable": {
                    value: "another-value",
                    description: "This is a description for another-variable for the project some-project",
                },
                variable4: "value4", // Will use the DICIONARY description
                // variable 3 will NOT be inserted in the project some-project pipeline variables
                // If it is manually added, it will have the description from the DICTIONARY
                // DESCRIPTION ORDER MATTERS: DICTIONARY -> DEFAULT -> PER_PROJECT
            },
        },
    },
    // ...
};
```

### Configuration - `Custom Gitlab shortcuts`

> _Configuration is to be defined **within the script** itself ([`Custom Gitlab shortcuts`](./gitlab-shortcuts.js)) and within the file [`Configuration for Gitlab scripts`](./gitlab-scripts-config.js)_  


#### Configuration withinb the global configuration script

This configuration has been added because of the need to access the API token for a shortcut to close an open question.

You can add other configuration that mey be shared with other scripts.


```javascript
const GITLAB_SCRIPTS_CONFIG = {
    // ...
    CUSTOM_SHORTCUTS: {
        ISSUE_STATUS_LABELS: [ // List of all the labels to be removed when closing an issue (see shortcut 'c+u')
            'TODO',
            'Doing',
            'Review',
            'Testing',
            'Done',
        ]
    },
    // ...
};
```

#### Configuration within the script file

The keys correspond to the shortcut to be used like `Ctrl+KeyA+KeyB`. \
The value is a function that will be called when the shortcut is pressed or an object like :
```javascript
{
    needs_shared_configuration: true,
    handler: async (projectMatch) => {
        // A function to handle the shortcut
        // ...
    }
}
```

The handlers function can either be async or not, it will correctly handle down the road.

The `projectMatch` object passed to the handlers is the result of a regex that matches:
```
Global match: The project web_url
Group 1: The full project path
Group 2: The full group path
Group 3: The main group name
Group 4: The project name
```

```javascript
const shortcuts = {
    // Go to run pipeline page
    'r+p': (projectUriMatch) => {
        // Check that the URL is pointing to a Gitlab project
        if (!projectUriMatch) return;
        // Go to the pipeline page
        window.location.href = `${projectUriMatch[0]}/-/pipelines/new`;
    },
    // Go to run project variables page
    'v+p': (projectUriMatch) => {
        // Check that the URL is pointing to a Gitlab project
        if (!projectUriMatch) return;
        // Go to the pipeline page
        window.location.href = `${projectUriMatch[0]}/-/settings/ci_cd#js-cicd-variables-settings`;
    },
    // Go to run project branches page
    'b+p': (projectUriMatch) => {
        // Check that the URL is pointing to a Gitlab project
        if (!projectUriMatch) return;
        // Go to the pipeline page
        window.location.href = `${projectUriMatch[0]}/-/branches`;
    },
    // Go to run project new branch page
    'Shift+b+p': (projectUriMatch) => new_branch_handler(projectUriMatch),
    // Go to run project new branch page
    'n+b+p': (projectUriMatch) => new_branch_handler(projectUriMatch),
    // Go to run project new merge request page
    'Shift+m+p': (projectUriMatch) => new_merge_request_handler(projectUriMatch),
    // Go to run project new merge request page
    'n+m+p': (projectUriMatch) => new_merge_request_handler(projectUriMatch),

    'c+u': {
        needs_shared_configuration: true,
        handler: async (projectUriMatch) => {
            // Check that the URL is pointing to a Gitlab project
            if (!projectUriMatch) return;
            const issueMatch = window.location.href.match(/\/issues\/(\d+)$/);
            if (issueMatch.length < 2) return;

            const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
            const configuration = window.loadConfigurations(CONFIGURATION_KEY);

            // Check that the configuration is set
            if (!privateToken || !configuration) {
                console.error('Error while loading the configuration in the "c+u" shortcut');
                return;
            }

            // Label to be removed when the issue is closed
            const labelsToRemove = configuration['ISSUE_STATUS_LABELS'];
            // Check if set and is an array
            if (!labelsToRemove || !Array.isArray(labelsToRemove)) {
                console.error(`Error while loading the configuration '${CONFIGURATION_KEY}':'ISSUE_STATUS_LABELS' in the "c+u" shortcut`);
                return;
            }

            const issueId = issueMatch[1];
            projectPath = encodeURIComponent(projectUriMatch[1]);
            const response = await fetch(`${window.location.origin}/api/v4/projects/${projectPath}/issues/${issueId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    "PRIVATE-TOKEN": privateToken
                },
                body: JSON.stringify({
                    "remove_labels": labelsToRemove.join(","),
                    "state_event": "close",
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
            }
            location.reload();
        }
    },
}
```

### Configuration - `Create merge request on other projects from an issue`

> _Configuration is to be defined within the file [`Configuration for Gitlab scripts`](./gitlab-scripts-config.js)_

```javascript
const GITLAB_SCRIPTS_CONFIG = {
    CREATE_MERGE_REQUESTS_ON_OTHER_PROJECTS_FROM_ISSUE: {
        // The keys are the project where the plugin will be active
        "https://gitlab.com/group/projecton": {
            "branch_name_prefix": "OPS <ISSUE_ID> - ",
            "merge_request_title_prefix": "OPS <ISSUE_ID> - ",
            "remove_source_branch": true,
            "squash": false,
            "include_issue_description": false,
            "open_after_creation": true,
            "excluded_projects": [
                "https://gitlab.com/toexclude/project1",
                "https://gitlab.com/anothergroup/project2",
            ],
            /* 
            If the 'projects' key is not provided, it will show all the projects in the group (including all sub-group) that are not in the 'excluded_projects' list.
            ie. The issue is in the project 'https://gitlab.com/mygroup/asubgroup/project3' and the 'projects' key is not provided, 
                it will show all the projects in the 'mygroup' (including all sub-group) that are not in the 'excluded_projects' list.
            */
            "projects": {
                "https://gitlab.com/toinclude/project1": {
                    "name": "X30",
                    "default_branch": "dev",
                    "remove_source_branch": false, // override the global value
                    "squash": true, // override the global value
                    // Global values will be used for 'include_issue_description' and 'open_after_creation'
                },
                "https://gitlab.com/anothergroup/subgroup/project2": {
                    "name": "C30",
                    "default_branch": "dev",
                    "include_issue_description": true, // override the global value
                    "open_after_creation": false, // override the global value
                    // Global values will be used for 'remove_source_branch' and 'squash'
                },
            }
        }
    }
}
```


<!-- Links -->
[gitlab-token]: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html