// ==UserScript==
// @name         Gitlab timelogs autofiller
// @version      2024-07-28
// @description  Autofill the timelogs with the current user and dates
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/-/timelogs
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-timelogs.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-timelogs.js
// @grant        none
// ==/UserScript==
await new Promise((resolve, reject) => {
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
    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
    const gitlabApiUrl = window.location.origin + '/api/v4';

    if (!privateToken) {
        console.error('Error while loading the configuration');
        return;
    }

    const getUser = async (gitlabApiUrl = 'https://gitlab.com/api/v4') => {
        const response = await fetch(`${gitlabApiUrl}/user?private_token=${privateToken}`)
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
        return await response.json();
    }

    let user = undefined;

    try {
        user = getUser(gitlabApiUrl);
    } catch (error) {
        console.error('Error while fetching the user', error);
        return;
    }
    if (!user) {
        console.error('User not found');
        return;
    }

    const contentBodySelector = '#content-body > div';
    const formSelector = `${contentBodySelector} > form`;

    let waitForElementResolve = undefined;
    const waitForElement = new Promise((resolve) => {
        waitForElementResolve = resolve;
    });

    const observer = new MutationObserver((mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (mutation.target.classList.contains('page-initialised')) {
                    // Wait 0.1s to make sure the page is fully loaded
                    setTimeout(() => {
                        waitForElementResolve();
                    }, 100);
                    observer.disconnect();
                    return;
                }
            }
        }
    });
    observer.observe(document.body, {
        attributes: true
    });

    // Wait until the promise is resolved
    await waitForElement;
    // Await user to be fetched
    user = await user;

    const form = document.querySelector(formSelector);
    if (!form) {
        console.error('Form not found');
        return;
    }

    const usernameInput = form.querySelector('#timelog-form-username');
    // Div with attribut data-testid="form-from-date"
    const fromDateInput = document.querySelector(`${formSelector} fieldset div[data-testid="form-from-date"] input`);
    // Div with attribut data-testid="form-to-date"
    const toDateInput = document.querySelector(`${formSelector} fieldset div[data-testid="form-to-date"] input`);

    if (!usernameInput || !fromDateInput || !toDateInput) {
        console.error('Inputs not found');
        return;
    }

    const current = new Date();
    const firstDayOfMonth = new Date(current.getFullYear(), current.getMonth(), 1, 12, 0, 0);
    const lastDayOfMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    usernameInput.value = user.username;
    usernameInput.dispatchEvent(new Event('change'));

    fromDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
    fromDateInput.dispatchEvent(new Event('change'));

    toDateInput.value = lastDayOfMonth.toISOString().split('T')[0];
    toDateInput.dispatchEvent(new Event('change'));
    toDateInput.blur();

    const submitButton = document.querySelector(formSelector + '> button.btn-confirm');

    if (!submitButton) {
        console.error('Submit button not found');
        return;
    }

    submitButton.click();
});