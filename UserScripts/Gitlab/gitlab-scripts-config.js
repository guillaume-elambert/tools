// ==UserScript==
// @name         Configuration for Gitlab scripts
// @version      2024-07-18
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
};

const variablePrefix = 'GITLAB_SCRIPTS_CONFIG_';

// Load the configuration to the local storage
for (const [key, value] of Object.entries(GITLAB_SCRIPTS_CONFIG)) {
    window.localStorage.setItem(`${variablePrefix}${key}`, JSON.stringify(value));
}

window.loadConfigurations = (key) => {
    return JSON.parse(window.localStorage.getItem(`${variablePrefix}${key}`));
}