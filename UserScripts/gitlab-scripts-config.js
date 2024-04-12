// ==UserScript==
// @name         Configuration for Gitlab scripts
// @version      2024-04-12
// @description  Configuration for Gitlab scripts
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*
// @grant        none
// ==/UserScript==


const GITLAB_SCRIPTS_CONFIG = {
    API_PRIVATE_TOKEN: '', // replace with your private token
    AUTHOR_EMAILS: [
    ], // replace with your email
    DEFAULT_PIPELINE_VARIABLES: {
        "VARIABLE1": "value1",
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