// ==UserScript==
// @name         Custom Gitlab shortcuts
// @version      2024-07-23
// @description  Add shortcuts to Gitlab
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-shortcuts.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-shortcuts.js
// @grant        none
// ==/UserScript==

const CONFIGURATION_KEY = 'CUSTOM_SHORTCUTS';

// Create an enum with the elements 'GROUP', 'PROJECT', 'OTHER'
const PageType = Object.freeze({
    GROUP: 'GROUP',
    PROJECT: 'PROJECT',
    OTHER: 'OTHER'
});

// Regex that matches :
// Match 1: The project web_url
// Group 1: The full project path
// Group 2: The full group path
// Group 3: The main group name
// Group 4: The project name
const projectPattern = /https?:\/\/[^\/]+\/((([^\/]+)(?:\/[^\/]+)?)\/([^.\/]+))/i;

// Regex that matches :
// Match 1: The group web_url
// Group 1: The full group path
// Group 2: The main group name
const groupPattern = /https?:\/\/[^\/]+\/groups\/(([^\/]+)(?:\/[^\/]+)?)/i;

let uriMatch = undefined;
let dataProjectFullPath = document.querySelector('body').getAttribute('data-project-full-path');
let dataGroupFullPath = document.querySelector('body').getAttribute('data-group-full-path');
let pageType = PageType.OTHER;

if (dataProjectFullPath) {
    if (!dataProjectFullPath.startsWith('/') && !window.location.origin.endsWith('/')) dataProjectFullPath = `/${dataProjectFullPath}`;
    uriMatch = `${window.location.origin}${dataProjectFullPath}`.match(projectPattern);
    pageType = PageType.PROJECT;
} else if (dataGroupFullPath) {
    uriMatch = `${window.location.origin}/groups/${dataGroupFullPath}`.match(groupPattern);
    pageType = PageType.GROUP;
} else {
    console.log('The user is neither on a project or group page.');
    uriMatch = window.location.href.match(projectPattern);
}

window.pageType = pageType;
window.uriMatch = uriMatch;

const timeoutLength = 1000;
var shortcutsTimeout = undefined;


/***********************************/
/****  Custom Gitlab shortcuts  ****/
/***********************************/
const CUSTOM_SHORTCUTS = {
    // Go to run pipeline page
    'r+p': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab project
        if (!uriMatch || !pageType) return;
        if (pageType !== PageType.PROJECT) return;
        // Go to the pipeline page
        window.location.href = `${uriMatch[0]}/-/pipelines/new`;
    },
    // Go to run project variables page
    'v+p': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab project or group
        if (!uriMatch || !pageType) return;
        if (![PageType.PROJECT, PageType.GROUP].includes(pageType)) return;
        // Go to the pipeline page
        window.location.href = `${uriMatch[0]}/-/settings/ci_cd#js-cicd-variables-settings`;
    },
    // Go to run project branches page
    'b+p': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab project
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.PROJECT) return;
        // Go to the pipeline page
        window.location.href = `${uriMatch[0]}/-/branches`;
    },
    // Go to run project new branch page
    'Shift+b+p': (uriMatch, pageType) => new_branch_handler(uriMatch, pageType),
    // Go to run project new branch page
    'n+b+p': (uriMatch, pageType) => new_branch_handler(uriMatch, pageType),
    // Go to run project new merge request page
    'Shift+m+p': (uriMatch) => new_merge_request_handler(uriMatch, pageType),
    // Go to run project new merge request page
    'n+m+p': (uriMatch) => new_merge_request_handler(uriMatch, pageType),
    // Set an issue to review state
    'u+r': {
        needs_shared_configuration: true,
        handler: (uriMatch, pageType) => review_issue_handler(uriMatch, pageType)
    },
    // Close an issue
    'u+c': {
        needs_shared_configuration: true,
        handler: async (uriMatch, pageType) => close_issue_handler(uriMatch, pageType)
    },
}

const new_branch_handler = (uriMatch, pageType) => {
    // Check that the URL is pointing to a Gitlab project
    if (!uriMatch || !pageType) return;
    if (pageType !== PageType.PROJECT) return

    // Go to the pipeline page
    window.location.href = `${uriMatch[0]}/-/branches/new`;
}

const new_merge_request_handler = (uriMatch, pageType) => {
    // Check that the URL is pointing to a Gitlab project
    if (!uriMatch || !pageType) return;
    if (pageType !== PageType.PROJECT) return;
    // Go to the pipeline page
    window.location.href = `${uriMatch[0]}/-/merge_requests/new`;
}

const review_issue_handler = async (uriMatch, pageType) => {
    // Check that the URL is pointing to a Gitlab project
    if (!uriMatch || !pageType) return;
    if (pageType !== PageType.PROJECT) return;

    const issueMatch = window.location.href.match(/\/-\/issues\/(\d+)$/);
    if (issueMatch.length < 2) return;
    const issueId = issueMatch[1];

    const configuration = window.loadConfigurations(CONFIGURATION_KEY);
    // Check that the configuration is set
    if (!configuration) {
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

    const projectPath = encodeURIComponent(uriMatch[1]);
    const body = {
        "remove_labels": labelsToRemove.join(","),
        "add_labels": "Revue",
    };

    try {
        await editIssue(issueId, projectPath, body);
        location.reload();
    } catch (error) {
        console.error('Error while editing the issue', error);
    }
};

const close_issue_handler = async (uriMatch, pageType) => {
    // Check that the URL is pointing to a Gitlab project
    if (!uriMatch || !pageType) return;
    if (pageType !== PageType.PROJECT) return;

    const issueMatch = window.location.href.match(/\/-\/issues\/(\d+)$/);
    if (issueMatch.length < 2) return;
    const issueId = issueMatch[1];

    const configuration = window.loadConfigurations(CONFIGURATION_KEY);
    // Check that the configuration is set
    if (!configuration) {
        console.error('Error while loading the configuration in the "c+u" shortcut', configuration);
        return;
    }

    // Label to be removed when the issue is closed
    const labelsToRemove = configuration['ISSUE_STATUS_LABELS'];
    // Check if set and is an array
    if (!labelsToRemove || !Array.isArray(labelsToRemove)) {
        console.error(`Error while loading the configuration '${CONFIGURATION_KEY}':'ISSUE_STATUS_LABELS' in the "c+u" shortcut`);
        return;
    }

    const projectPath = encodeURIComponent(uriMatch[1]);
    const body = {
        "remove_labels": labelsToRemove.join(","),
        "state_event": "close",
    }

    try {
        await editIssue(issueId, projectPath, body);
        location.reload();
    } catch (error) {
        console.error('Error while editing the issue', error);
    }
};

const editIssue = async (issueId, projectPath, body) => {
    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
    if (!privateToken) {
        console.error('Error while loading the Gitlab private API token.');
        return;
    }

    const response = await fetch(`${window.location.origin}/api/v4/projects/${projectPath}/issues/${issueId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            "PRIVATE-TOKEN": privateToken
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
    }
}


/**********************************/
/****  Gitlab shortcuts clone  ****/
/**********************************/

const ADDITIONAL_GROUP_SHORTCUTS = {
    'g+o': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the group overview page
        window.location.href = `${uriMatch[0]}`;
    },
    'g+v': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the group activity page
        window.location.href = `${uriMatch[0]}/-/activity`;
    },
    'g+i': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the group issues page
        window.location.href = `${uriMatch[0]}/-/issues`;
    },
    'g+b': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the group boards page
        window.location.href = `${uriMatch[0]}/-/boards`;
    },
    'g+m': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the merge requests page
        window.location.href = `${uriMatch[0]}/-/merge_requests`;
    },
    'g+k': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the group clusters page
        window.location.href = `${uriMatch[0]}/-/clusters`;
    },
    'g+w': (uriMatch, pageType) => {
        // Check that the URL is pointing to a Gitlab group
        if (!uriMatch || !pageType) return;
        if (pageType != PageType.GROUP) return;

        // Go to the group wiki page
        window.location.href = `${uriMatch[0]}/-/wikis/home`;
    },
}


/***************************************/
/****  Shortcuts compute functions  ****/
/***************************************/

const runHandlerWhenConfigurationReady = async (handler, uriMatch, pageType) => {
    if (typeof handler !== 'function') {
        console.error('The handler is not a function.');
        return;
    }

    if (window.loadConfigurations && typeof window.loadConfigurations === 'function') {
        // Check if the function is async
        if (handler.constructor.name === 'AsyncFunction') {
            return await handler(uriMatch, pageType);
        }
        return handler(uriMatch, pageType);
    }

    // Wait until if (window.loadConfigurations && typeof window.loadConfigurations === 'function') is true
    return new Promise((resolve, reject) => {
        var timeout = setTimeout(() => {
            console.error(`Error while waiting for window.loadConfigurations to be defined.
Please make sure that the script "Configuration for Gitlab scripts" is executed before this script.
Check at https://github.com/guillaume-elambert/tools for more information.`);
            reject();
        }, 5000);

        var interval = setInterval(() => {
            if (window.loadConfigurations && typeof window.loadConfigurations === 'function') {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve();
            }
        }, 100);
    }).then(async () => {
        // Check if the function is async
        if (handler.constructor.name === 'AsyncFunction') {
            return await handler(uriMatch, uriMatch);
        }
        return handler(uriMatch, uriMatch);
    });
}


/**
 * Checks if the shortcut keys match the keys (partially or fully). 
 * Will return true if the shortcut keys start with the keys.
 * @param {Array} shortcutKeys The keys of the shortcut
 * @param {Array} keys The keys that the user has pressed 
 * @returns True if the shortcut keys start with the keys
 */
function shortcutHasKeys(shortcutKeys, keys) {
    return keys.every((key, index) => key === shortcutKeys[index]);
}

/**
 * Count the number of keys that match between the shortcut keys and the keys
 * @param {Array} shortcutKeys The keys of the shortcut
 * @param {Array} keys The keys that the user has pressed
 * @returns The number of keys that matches.
 */
function shortcutMatchKeysCount(shortcutKeys, keys) {
    // Count the number of keys that match
    return keys.reduce((acc, key, index) => key === shortcutKeys[index] ? acc + 1 : acc, 0);
}

/**
 * Handle the key pressed event to launch the shortcuts
 * @param {Event} event The key pressed event
 * @param {Array} shortcuts The shortcuts to handle
 * @param {Array} pressed_keys The keys that the user has pressed
 * @param {Function} timeoutFunction The function to call when the timeout is reached
 */
async function handleKeyPressed(event, shortcuts, pressed_keys, timeoutFunction) {

    // Ensure that the user is not in a field where he can type
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        timeoutFunction();
        return;
    }

    // Clear the timeout
    clearTimeout(shortcutsTimeout);
    const pressed_key = event.key.toLowerCase().replace('arrow', '')
    pressed_keys.push(pressed_key);

    let completedShortcuts = [];
    let matchingShortCuts = 0;

    for (const preparedShortcut of shortcuts) {
        let keysToBePressed = preparedShortcut.keysToBePressed;

        if (!shortcutHasKeys(keysToBePressed, pressed_keys)) continue;
        matchingShortCuts++;
        // If the keys match, call the handler
        if (pressed_keys.length === keysToBePressed.length) {
            completedShortcuts.push(preparedShortcut);
        }
    }

    if (matchingShortCuts === 0) {
        timeoutFunction();
        pressed_keys = [pressed_key];
        shortcutsTimeout = setTimeout(timeoutFunction, timeoutLength);
        return;
    }

    // Order the completed shortcuts by the number of keys
    completedShortcuts.sort((a, b) => shortcutMatchKeysCount(b.keysToBePressed, pressed_keys) - shortcutMatchKeysCount(a.keysToBePressed, pressed_keys));

    // Call all the handlers until one returns true
    for (const completedShortcut of completedShortcuts) {
        let handler = completedShortcut.handler;
        // Check if the function is async
        if (handler.constructor.name === 'AsyncFunction') {
            if (await handler(uriMatch, pageType)) return;
            continue;
        }
        if (handler(uriMatch, pageType)) return;
    }

    shortcutsTimeout = setTimeout(timeoutFunction, timeoutLength);
}

/**
 * Prepare the shortcuts to be handled
 * @param {Object} shortcuts The shortcuts to handle
 */
function handleShortcuts(shortcuts) {
    // var keysToBePressed = keysToBePressedStr.toLowerCase().split('+');
    var pressed_keys = [];
    const timeoutFunction = () => {
        pressed_keys = [];
    }
    let prepared_shortcuts = [];

    shortcuts['up+up+down+down+left+right+left+right+b+a'] = () => {
        alert('Konami code');
    }

    for (let [keysToBePressedStr, handler] of Object.entries(shortcuts)) {
        let splittedKeys = keysToBePressedStr.toLowerCase().split('+');
        const errorMsg = `The handler for the shortcut ${keysToBePressedStr} is not a function.`;

        if (typeof handler === 'object') {
            let handlerFunction = handler.handler;
            let handlerCopy = {
                ...handler
            };
            if (!handlerFunction || typeof handlerFunction !== 'function') {
                console.error(errorMsg);
                continue;
            }

            if (handler.needs_shared_configuration) {
                handlerFunction = async (uriMatch) => await runHandlerWhenConfigurationReady(handlerCopy.handler, uriMatch, pageType);
            }
            handler = handlerFunction;
        } else if (typeof handler !== 'function') {
            console.error(errorMsg);
            continue;
        }

        prepared_shortcuts.push({
            "keysToBePressed": splittedKeys,
            "handler": handler
        });
    }

    window.addEventListener('keydown', async (event) => await handleKeyPressed(event, prepared_shortcuts, pressed_keys, timeoutFunction));
}

// Add the shortcuts
handleShortcuts(CUSTOM_SHORTCUTS);
if (pageType === PageType.GROUP) handleShortcuts(ADDITIONAL_GROUP_SHORTCUTS);