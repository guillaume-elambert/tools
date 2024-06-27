// ==UserScript==
// @name         Configuration for Gitlab scripts
// @version      2024-06-27
// @description  Configuration for Gitlab scripts
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-scripts-config.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-scripts-config.js
// @grant        none
// ==/UserScript==


const GITLAB_SCRIPTS_CONFIG = {
    API_PRIVATE_TOKEN: '', // replace with your private token
    AUTHOR_EMAILS: [
        '',
        '',
    ], // replace with your email(s)
    PIPELINE_VARIABLES: {
        DICTIONARY: {
            "variable1": "This is the gloable description of variable 1",
            "variable2": "This is the gloable description of variable 2",
            "variable3": "This is the gloable description of variable 3",
            "variable4": "This is the gloable description of variable 4",
        },
        DEFAULT: {
            "variable1": {
                "value": "value1",
                "description": "This will override the \"DICTIONARY\" description fro variable1.",
            },
            "variable2": {
                "value": "value2",
                "description": "This will override the \"DICTIONARY\" description fro variable2.",
            },
            "variable3": "value3",
        },
        PER_PROJECT: {
            "https://gitlab.com/some-project": {
                // override the default value for the project some-project. It will not override the description and use the DEFAULT one
                "variable1": "not value1",
                "variable2": {
                    "value": "not value2", // override the value for the project some-project
                    "description": "This is a description for variable2 for the project some-project", // override the description for the project some-project
                },
                "another-variable": {
                    "value": "another-value",
                    "description": "This is a description for another-variable for the project some-project",
                },
                "variable4": "value4", // Will use the DICIONARY description
                // variable 3 will NOT be inserted in the project some-project pipeline variables
                // If it is manually added, it will have the description from the DICTIONARY
                // DESCRIPTION ORDER MATTERS: DICTIONARY -> DEFAULT -> PER_PROJECT
            },
        }
    },
};

const variablePrefix = 'GITLAB_SCRIPTS_CONFIG_';

// Load the configuration to the local storage
for (const [key, value] of Object.entries(GITLAB_SCRIPTS_CONFIG)) {
    window.localStorage.setItem(`${variablePrefix}${key}`, JSON.stringify(value));
}

window.loadConfigurations = (key) => {
    return JSON.parse(window.localStorage.getItem(`${variablePrefix}${key}`));
}