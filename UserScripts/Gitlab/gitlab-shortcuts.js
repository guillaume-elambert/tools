// ==UserScript==
// @name         Custom Gitlab shortcuts
// @version      2024-07-17
// @description  Add shortcuts to Gitlab
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-shortcuts.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-shortcuts.js
// @grant        none
// ==/UserScript==

// Regex that matches :
// Match 1: The project web_url
// Group 1: The full project path
// Group 2: The full group path
// Group 3: The main group name
// Group 4: The project name
const projectPattern = /https?:\/\/[^\/]+\/((([^\/]+)(?:\/[^\/]+)?)\/([^.\/]+))/i;
let dataProjectFullPath = document.querySelector('body').getAttribute('data-project-full-path');
if (!dataProjectFullPath) {
    console.error('Error while fetching the project full path. Maybe the user is not on a project page.');
    return;
}

if (!dataProjectFullPath.startsWith('/') && !window.location.origin.endsWith('/')) dataProjectFullPath = `/${dataProjectFullPath}`;
const projectUriMatch = `${window.location.origin}${dataProjectFullPath}`.match(projectPattern);

const timeoutLength = 1000;
var shortcutsTimeout = undefined;

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
    'Shift+b+p': (projectUriMatch) => new_branch_callback(projectUriMatch),
    // Go to run project new branch page
    'n+b+p': (projectUriMatch) => new_branch_callback(projectUriMatch),
    // Go to run project new merge request page
    'Shift+m+p': (projectUriMatch) => new_merge_request_callback(projectUriMatch),
    // Go to run project new merge request page
    'n+m+p': (projectUriMatch) => new_merge_request_callback(projectUriMatch),
}

const new_branch_callback = (projectUriMatch) => {
    // Check that the URL is pointing to a Gitlab project
    if (!projectUriMatch) return;
    // Go to the pipeline page
    window.location.href = `${projectUriMatch[0]}/-/branches/new`;
}

const new_merge_request_callback = (projectUriMatch) => {
    // Check that the URL is pointing to a Gitlab project
    if (!projectUriMatch) return;
    // Go to the pipeline page
    window.location.href = `${projectUriMatch[0]}/-/merge_requests/new`;
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
function handleKeyPressed(event, shortcuts, pressed_keys, timeoutFunction) {

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
        // If the keys match, call the callback
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

    // Call all the callbacks until one returns true
    for (const completedShortcut of completedShortcuts) {
        let callback = completedShortcut.callback;
        if (callback(projectUriMatch)) return;
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

    for (const [keysToBePressedStr, callback] of Object.entries(shortcuts)) {
        let splittedKeys = keysToBePressedStr.toLowerCase().split('+');
        prepared_shortcuts.push({
            "keysToBePressed": splittedKeys,
            "callback": callback
        });
    }

    window.addEventListener('keydown', (event) => handleKeyPressed(event, prepared_shortcuts, pressed_keys, timeoutFunction));
}

// Add the shortcuts
handleShortcuts(shortcuts);