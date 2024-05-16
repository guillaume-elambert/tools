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
    
    const pipelineVariables = window.loadConfigurations('PIPELINE_VARIABLES');

    const defaultVariables = pipelineVariables.DEFAULT;
    const variablesDefinition = pipelineVariables.DICTIONARY
    const perProjectVariables = pipelineVariables.PER_PROJECT;

    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
    const authorEmails = window.loadConfigurations('AUTHOR_EMAILS');

    const projectPattern = /(https:\/\/gitlab.com\/(([^\/]+)\/([^\/]+)\/([^\/]+)))(.*)/i;
    const projectUriMatch = window.location.href.match(projectPattern);

    const projectVariables = perProjectVariables[projectUriMatch[1]] || undefined;
    let variablesToUse = projectVariables || defaultVariables;

    const localStorageKey = `GITLAB_SCRIPTS_VARIABLES`;

    // UI constants
    const variablesFormSelector = "#content-body > form";
    const variablesForm = document.querySelector(variablesFormSelector);
    const topFieldSet = variablesForm.querySelector("fieldset:nth-of-type(1)");
    const fieldsetSelector = "fieldset:nth-of-type(2) > div";
    const variableRowSelector = "div[data-testid='ci-variable-row-container']"
    const variableRemoveButtonSelector = "button[data-testid='remove-ci-variable-row']"
    // <button data-testid="run-pipeline-button" type="submit">
    const submitButtonSelector = "button[data-testid='run-pipeline-button'][type='submit']";

    
    window.removeVariables = () => {
        let form = document.querySelector(variablesFormSelector);
        let rows = form.querySelectorAll(`${variableRowSelector}:has(${variableRemoveButtonSelector})`);
        // Invert the array to remove the last added variables first
        rows = Array.from(rows).reverse();
        rows.forEach(row => {
            row.querySelector(variableRemoveButtonSelector).click();
        });
    }

    window.fillVariables = async (variables = defaultVariables) => {
        window.removeVariables();
        var form = document.querySelector(variablesFormSelector);
        var fieldset = await window.waitForElement(form, fieldsetSelector)
            .catch(error => {
                console.error('Error while waiting for fieldset:', error);
                return null;
            });

        if (!fieldset) return;
        let iterated = 0;

        for (const [key, value] of Object.entries(variables)) {
            const container = await window.waitForElement(fieldset, `div:nth-of-type(${iterated + 1}) > div`)
                .catch(error => {
                    console.error(`Error while waiting for container of ${key}:`, error);
                    return null;
                });

            if (!container) continue;

            
            
            let valueToSet = value;
            
            if (typeof valueToSet === 'object') {
                valueToSet = value.value;

                if(value.description) {
                    container.title = value.description;
                }
            }
            
            if(!key || !valueToSet) {
                console.error(`Variable ${key} is empty. Skipping...`);
                continue;
            }
            
            let inputKey = container.querySelector("input");
            let inputValue = container.querySelector("textarea");

            ++iterated;
            
            inputKey.value = key;
            inputValue.value = valueToSet;

            // Wait for fieldset to have new child
            const prom = window.waitForElement(fieldset, `div:nth-of-type(${iterated + 1})`, 1000)
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

    window.updateVariableTitle = (node) => {
        const container = node.closest('div');
        if (!container) return;
        
        // Check if the key is within the project variables and has a description
        if (perProjectVariables[node.value]?.description) {
            container.title = perProjectVariables[node.value].description;
            return;
        }
        
        // Check if the key is within the default variables and has a description
        if (defaultVariables[node.value]?.description) {
            // Set the title of the container
            container.title = defaultVariables[node.value].description;
            return;
        }
        
        // Check if the key is within the global variables
        if(variablesDefinition[node.value]) {
            container.title = variablesDefinition[node.value];
            return;
        }
        
        container.title = '';
    }

    // Detect changes on all 'data-testid="pipeline-form-ci-variable-key-field"' values
    const variablesObserver = new MutationObserver((mutationsList, observer) => {
        for (let mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (let node of mutation.addedNodes) {                    
                    if (node.querySelector && (node = node.querySelector('[data-testid="pipeline-form-ci-variable-key-field"]'))) {
                        ['input', 'paste', 'change', 'keydown']
                            .forEach(event => node.addEventListener(event, () => window.updateVariableTitle(node)));
                    }
                }
            }
        }
    });
    variablesObserver.observe(document.body, { childList: true, subtree: true });

    window.fillVariablesUsage = () => {
        var usage = `padding-bottom: 0.5em;
        font-size: 1.2em;
        text-decoration: underline;
        font-weight: bold;`;
        var code = `color: #333;
        font-family: monospace;
        line-height: 1.6em;`

        console.log(
            `%cUsage:%c
fillVariables({
    "VARIABLE1": "value1",
    "VARIABLE2": {
        value: "value2",
        description: "Description for VARIABLE2"
    }
});`, usage, code
        );
    }


    // Select the last branch you made a commit on
    window.getLastBranchForEmail = async (authorEmail, projectPath, gitlabApiUrl = 'https://gitlab.com/api/v4') => {
        // Get the 10 last commits you made
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

        // Order the commits by date (the earliest first)
        commits.sort((a, b) => {
            return new Date(b.committed_date) - new Date(a.committed_date);
        });

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


    window.loadLatestUsedConfiguration = async (projectPath) => {
        // Load form configuration from the local storage
        const formConfiguration = JSON.parse(await window.localStorage.getItem(localStorageKey));
        if (!formConfiguration) return;
        if(!formConfiguration[projectPath]) return;
        return formConfiguration[projectPath];
    }


    window.addFillVariablesButton = (innerHtml, callback, buttonLevel = 1, title = "") => {
        let buttonClass = "";
        switch (buttonLevel) {
            case -1:
                buttonClass = "btn-danger-secondary";
                break;
            case 1:
                buttonClass = "btn-confirm";
                break;
            case 2:
                buttonClass = "btn-confirm-secondary";
                break;
            case 3:
                buttonClass = "btn-dashed";
                break;
            default:
                buttonClass = "btn-default";
                break;
        }

        // Add a button to fill the variables
        let btn = document.createElement("a");
        let span = document.createElement("span");
        span.innerHTML = innerHtml;
        span.className = "gl-button-text";
        btn.className = "btn js-no-auto-disable gl-mr-3 btn-md gl-button " + buttonClass;
        btn.style = "margin-top: 1em;"
        if (title) btn.title = title;
        
        btn.onclick = callback;
        btn.appendChild(span);
        topFieldSet.appendChild(btn);
    }
    
    let buttonsToAdd = [];
    let localStorageConfiguration = await window.loadLatestUsedConfiguration(projectUriMatch[1]) || undefined;
    let currentBtnCount = 0;
    

    if(localStorageConfiguration) {
        variablesToUse = localStorageConfiguration;

        buttonsToAdd.push({
            innerHtml: "▼ Fill last used variables ▼",
            callback: () => {
                window.fillVariables(localStorageConfiguration);
            },
            level: ++currentBtnCount
        });
    }

    if (projectVariables) {
        buttonsToAdd.push({
            innerHtml: "▼ Fill project variables ▼",
            callback: () => {
                window.fillVariables(projectVariables);
            },
            level: ++currentBtnCount
        });
    }

    buttonsToAdd.push({
        innerHtml: "▼ Fill default variables ▼",
        callback: () => {
            window.fillVariables(defaultVariables);
        },
        level: ++currentBtnCount
    });

    window.getIcon = (slug) => {
        // The slug should be get from https://gitlab-org.gitlab.io/gitlab-svgs/
        let randomIcon = document.querySelector(`.gl-icon[data-testid="${slug}-icon"]`);

        if (randomIcon) return randomIcon;
        randomIcon = document.querySelector(`.gl-icon[data-testid$=-icon]`);
        randomIcon = randomIcon.cloneNode(true);
        randomIcon.setAttribute('data-testid', 'clear-icon');
        // get the <use> tag url
        let useTag = randomIcon.querySelector('use');
        let iconUrl = useTag.getAttribute('href');
        // Replace the url with the correct one
        iconUrl = iconUrl.replace(/#.*$/, `#${slug}`);
        useTag.setAttribute('href', iconUrl);
        return randomIcon;
    }
    
    let clearIcon = window.getIcon('clear');
    clearIcon.className.baseVal = "gl-mr-0! gl-display-none gl-md-display-block gl-icon s16"
    
    buttonsToAdd.push({
        innerHtml: clearIcon.outerHTML,
        callback: window.removeVariables,
        level: -1,
        title: "Clear the form"
    });

    
    window.fillVariablesUsage();
    window.fillVariables(variablesToUse);

    buttonsToAdd.forEach(button => {
        window.addFillVariablesButton(button.innerHtml, button.callback, button.level);
    });


    // Add default variables to the form each time the fieldset gets modified
    const observer = new MutationObserver(() => {
        if (variablesForm.querySelector(fieldsetSelector)) {
            window.fillVariables(variablesToUse);
        }
    });
    observer.observe(variablesForm, { childList: true });



    if (projectUriMatch && projectUriMatch.length >= 2) {
        await window.selectLastBranch(authorEmails, projectUriMatch[2], async () => {
            // Await form to emit a new Mutation event
            await new Promise(resolve => {
                const observer = new MutationObserver(() => {
                    if(!variablesForm.querySelector(fieldsetSelector)) return;
                    resolve();
                    observer.disconnect();
                });

                // Wait for the fieldset to be created
                observer.observe(variablesForm, { childList: true, subtree: true });
            });

            console.log(projectUriMatch[1], perProjectVariables[projectUriMatch[1]])
            window.fillVariables(variablesToUse);
        }).catch(error => {
            console.error(`Error while selecting last branch:`, error);
        });
    }
})/*.catch(() => {
    return;
});*/