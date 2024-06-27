// ==UserScript==
// @name         Custom Gitlab shortcuts
// @version      2024-03-01
// @description  Add shortcuts to Gitlab
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*
// @grant        none
// ==/UserScript==

const projectPattern = /(https:\/\/gitlab.com\/(([^\/]+)\/([^\/]+)\/([^\/]+)))(.*)/i;
const timeoutLength = 1000;
var shortcutsTimeouts = {};

const shortcuts = {
    // Go to run pipeline page
    'r+p': (projectMatch) => {
        // Check that the URL is pointing to a Gitlab project
        if (!projectMatch) return;
        // Go to the pipeline page
        window.location.href = `${projectMatch[1]}/-/pipelines/new`;
    },
    // Go to run project variables page
    'p+v': (projectMatch) => {
        // Check that the URL is pointing to a Gitlab project
        if (!projectMatch) return;
        // Go to the pipeline page
        window.location.href = `${projectMatch[1]}/-/settings/ci_cd#js-cicd-variables-settings`;
    }
}

// Add the shortcuts
for (const shortcut in shortcuts) {
    handleShortcut(shortcut, shortcuts[shortcut]);
}

function handleShortcut(keysToBePressedStr, callback) {
    var keysToBePressed = keysToBePressedStr.toLowerCase().split('+');
    var keys = [];
    const timeoutFunction = () => keys = [];

    window.addEventListener('keydown', function (e) {

        // Ensure that the user is not in a field where he can type
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // If the key is the first one, create a timeout to clear the keys array
        if (keys.length === 0) {
            if (shortcutsTimeouts[keysToBePressedStr]) clearTimeout(shortcutsTimeouts[keysToBePressedStr]);
            shortcutsTimeouts[keysToBePressedStr] = setTimeout(timeoutFunction, timeoutLength);
        }

        keys.push(e.key.toLowerCase());

        // Clear the timeout
        clearTimeout(shortcutsTimeouts[keysToBePressedStr]);

        if (!keys.every((key, index) => key === keysToBePressed[index])) {
            keys = [];
            return;
        }

        if (keys.length === keysToBePressed.length) {
            callback(window.location.href.match(projectPattern));
            keys = [];
            return;
        }

        shortcutsTimeouts[keysToBePressedStr] = setTimeout(timeoutFunction, timeoutLength);
    });

    // After 1 second, clear the keys array
    setInterval(function () {
        keys = [];
    }, 1000);
}