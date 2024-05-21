# Gitlab scripts

Here are some scripts be injected into Gitlab website to enhance the user experience.

## How to install

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Click the script you want to install.
3. Click the `Raw` button to view the script.
4. Copy/paste the script into your userscript manager.

## Scripts

| Name                                                             | Description                                                                                          |
| :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| [Configuration for Gitlab scripts](./gitlab-scripts-config.js)   | Script containing the configuration for the other scripts.                                           |
| [Run pipeline helper](./gitlab-new-pipeline-helper.js)           | Autofill variables form when running a new pipeline.                                                 |
| [Print pipeline variables](./gitlab-print-pipeline-variables.js) | Adds a container to the pipeline view to see the variables you had set manually to run the pipeline. |
| [Custom Gitlab shortcuts](./gitlab-shortcuts.js)                 | Adds custom shortcuts to Gitlab.                                                                     |

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
  AUTHOR_EMAILS: ["", "", ""], // replace with your email(s)
  // ...
};
```

### Configuration - `Run pipeline helper`

> _Configuration is to be defined within the file [`Configuration for Gitlab scripts`](./gitlab-scripts-config.js)_

The `DICTIONARY` object contains the description for each variable. \
The `DEFAULT` object contains the default value for each projects that do not have a specific configurtion. \
The `PER_PROJECT` object contains the variables that should be added to the pipeline variables for a specific project.

The configuration in the `PER_PROJECT` object has the higher precedence. \
Then the `DEFAULT` object and finally the `DICTIONARY` object.
Which can be summarized as: \
Order of description: `PER_PROJECT` -> `DEFAULT` -> `DICTIONARY` \
Order of value: `PER_PROJECT` -> `DEFAULT`

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
        description:
          'This will override the "DICTIONARY" description fro variable1.',
      },
      variable2: {
        value: "value2",
        description:
          'This will override the "DICTIONARY" description fro variable2.',
      },
      variable3: "value3",
    },
    PER_PROJECT: {
      "https://gitlab.com/some-project": {
        // override the default value for the project some-project. It will not override the description and use the DEFAULT one
        variable1: "not value1",
        variable2: {
          value: "not value2", // override the value for the project some-project
          description:
            "This is a description for variable2 for the project some-project", // override the description for the project some-project
        },
        "another-variable": {
          value: "another-value",
          description:
            "This is a description for another-variable for the project some-project",
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

> _Configuration is to be defined **within the script** itself ([`Custom Gitlab shortcuts`](./gitlab-shortcuts.js))_

The keys correspond to the shortcut to be used. \
The value is a function that will be called when the shortcut is pressed.

```javascript
const shortcuts = {
  // Go to run pipeline page
  "r+p": (projectMatch) => {
    // Check that the URL is pointing to a Gitlab project
    if (!projectMatch) return;
    // Go to the pipeline page
    window.location.href = `${projectMatch[1]}/-/pipelines/new`;
  },
  // Go to run project variables page
  "p+v": (projectMatch) => {
    // Check that the URL is pointing to a Gitlab project
    if (!projectMatch) return;
    // Go to the pipeline page
    window.location.href = `${projectMatch[1]}/-/settings/ci_cd#js-cicd-variables-settings`;
  },
};
```

[gitlab-token]: https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html
