// ==UserScript==
// @name         Run pipeline helper
// @version      2024-04-12
// @description  Simplify the creation of a new Gitlab pipeline
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*/-/pipelines/new
// @grant        none
// ==/UserScript==

// Wait for window.loadConfigurations to be defined
// After 5s, log an error and stop the script
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

    var defaultVariables = window.loadConfigurations('DEFAULT_PIPELINE_VARIABLES');

    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
    const authorEmails = window.loadConfigurations('AUTHOR_EMAILS');

    window.fillVariables = async (variables = defaultVariables) => {
        var form = document.querySelector("#content-body > form");
        var fieldset = await window.waitForElement(form, fieldsetSelector)
            .catch(error => {
                console.error('Error while waiting for fieldset:', error);
                return null;
            });

        if (!fieldset) return;
        var iterated = 0;

        for (const [key, value] of Object.entries(variables)) {
            var container = await window.waitForElement(fieldset, `div:nth-of-type(${iterated + 1}) > div`)
                .catch(error => {
                    console.error(`Error while waiting for container of ${key}:`, error);
                    return null;
                });

            if (!container) continue;

            ++iterated;
            var inputKey = container.querySelector("input");
            var inputValue = container.querySelector("textarea");


            // Simulate user typing
            inputKey.value = key;
            inputValue.value = value;

            // Wait for fieldset to have new child
            var prom = window.waitForElement(fieldset, `div:nth-of-type(${iterated + 1})`, 1000)
                .catch(error => {
                    console.error(`Error while waiting for next container after ${key}:`, error);
                });

            inputKey.dispatchEvent(new Event('change', { bubbles: true }));
            inputValue.dispatchEvent(new Event('change', { bubbles: true }));

            if (!fieldset.querySelector(`div:nth-of-type(${iterated + 1})`)) {
                await prom;
            }
        }
    }

    window.fillVariablesUsage = () => {
        var usage = `padding-bottom: 0.5em;
        font-size: 1.2em;
        text-decoration: underline;
        font-weight: bold;`;
        var code = `color: #333;
        font-family: monospace;
        line-height: 1.6em;`

        console.log(
            `%cUsage:
    %cfillVariables({
        "VARIABLE1": "value1",
        "VARIABLE2": "value2"
    });`, usage, code
        );
    }


    // Select the last branch you made a commit on
    window.getLastBranchForEmail = async (authorEmail, projectPath, gitlabApiUrl = 'https://gitlab.com/api/v4') => {
        // Get the last commit you made
        const commits = await fetch(`${gitlabApiUrl}/projects/${encodeURIComponent(projectPath)}/repository/commits?all=true&author=${encodeURIComponent(authorEmail)}&per_page=10`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${privateToken}`
                }
            }
        ).then(response => response.json())

        if (!commits || commits.length == 0 || !commits[Symbol.iterator]) {
            throw new Error('No commit found');
        }

        for (const commit of commits) {
            // Get the branches associated with that commit
            const branches = await fetch(`${gitlabApiUrl}/projects/${encodeURIComponent(projectPath)}/repository/commits/${commit.id}/refs?type=branch`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${privateToken}`
                }
            }).then(response => response.json())

            if (branches && branches.length > 0 && branches[0].name) {
                const branch = branches[0];
                branch.commit = commit;
                return branch;
            }
        }

        throw new Error('No branch found');
    }

    window.getLastBranch = async (authorEmails, projectPath, gitlabApiUrl = 'https://gitlab.com/api/v4') => {
        if (!Array.isArray(authorEmails)) {
            authorEmails = [authorEmails];
        }

        const branches = [];

        for (const email of authorEmails) {
            try {
                const branch = await window.getLastBranchForEmail(email, projectPath, gitlabApiUrl);
                branches.push(await branch);
            } catch (error) {
                console.error(`Error while selecting last branch for ${email}:`, error);
            }
        }

        if (!branches || branches.length == 0 || !branches[Symbol.iterator]) {
            throw new Error('No branch found');
        }

        // Check which branch is the one with the latest commit from the email
        branches.sort((a, b) => {
            return new Date(b.commit.committed_date) - new Date(a.commit.committed_date);
        });

        return branches[0];
    }

    window.selectLastBranch = async (authorEmails, projectPath, afterClickCallback = undefined, gitlabApiUrl = 'https://gitlab.com/api/v4') => {
        const branch = await window.getLastBranch(authorEmails, projectPath, gitlabApiUrl)
            .catch(error => {
                console.error(`Error while selecting last branch for ${authorEmails}:`, error);
                return null;
            });

        if (!branch) return;

        // Click on the branch selector
        const selector = topFieldSet.querySelector(`.ref-selector > .gl-new-dropdown-panel .gl-new-dropdown-contents li[role='option'][data-testid='listbox-item-refs/heads/${branch.name}']`);
        if (!selector) {
            console.error(`Branch ${branch.name} not found`, branch);
            throw new Error('Branch not found');
        }

        selector.click();
        if (afterClickCallback && typeof afterClickCallback === 'function') {
            afterClickCallback();
        }
    }

    window.waitForElement = (parent, selector, timeout = 5000) => {
        return new Promise((resolve, reject) => {
            const element = parent.querySelector(selector);
            if (element) {
                resolve(element);
            }

            let timeoutObj = null;

            if (timeout > 0) {
                timeoutObj = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout while waiting for ${selector}`));
                }, timeout);
            }

            const observer = new MutationObserver(() => {
                const element = parent.querySelector(selector);
                if (element) {
                    if (timeoutObj) clearTimeout(timeoutObj);
                    resolve(element);
                    observer.disconnect();
                }
            });

            observer.observe(parent, { childList: true });
        });
    }


    let form = document.querySelector("#content-body > form");
    let topFieldSet = form.querySelector("fieldset:nth-of-type(1)");
    const fieldsetSelector = "fieldset:nth-of-type(2) > div";

    // Add a button to fill the variables
    let btn = document.createElement("a");
    let label = document.createElement("label");
    label.textContent = "▼ Fill default variables ▼";
    label.className = "gl-button-text";
    btn.className = "btn js-no-auto-disable gl-mr-3 btn-confirm btn-md gl-button";
    btn.style = "margin-top: 1em;";

    window.fillVariablesUsage();
    window.fillVariables();

    btn.onclick = () => {
        fillVariables(defaultVariables);
    }

    btn.appendChild(label);
    topFieldSet.appendChild(btn);

    // Add default variables to the form each time the fieldset gets modified
    const observer = new MutationObserver(() => {
        if (form.querySelector(fieldsetSelector)) {
            window.fillVariables(defaultVariables);
        }
    });
    observer.observe(form, { childList: true });


    const projectPattern = /(https:\/\/gitlab.com\/(([^\/]+)\/([^\/]+)\/([^\/]+)))(.*)/i;
    let match = window.location.href.match(projectPattern);

    if (match && match.length >= 2) {
        await window.selectLastBranch(authorEmails, match[2], async () => {
            // Await form to emit a new Mutation event
            await new Promise(resolve => {
                const observer = new MutationObserver(() => {
                    resolve();
                    observer.disconnect();
                });
                observer.observe(form.querySelector(fieldsetSelector), { childList: true });
            });

            window.fillVariables();
        }).catch(error => {
            console.error(`Error while selecting last branch:`, error);
        });
    }
}).catch(() => {
    return;
});