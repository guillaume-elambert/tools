// ==UserScript==
// @name         Print pipeline variables
// @version      2024-07-18
// @description  Display pipeline variables
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*/-/pipelines/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-print-pipeline-variables.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-print-pipeline-variables.js
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

    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN')

    window.getPipelineVariables = (projectPath, pipelineId) => {
        return fetch(
            `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectPath)}/pipelines/${pipelineId}/variables`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${privateToken}`
                }
            }
        ).then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
            return response.json()
        });
    }


    window.toggleVariablesCardVisibility = (card) => {
        card.classList.toggle('hide-variables');
    }


    window.addVariablesInPipelineHeader = (projectPath, pipelineId) => {
        const pipelineHeader = document.querySelector('#content-body > div.js-pipeline-container > div.gl-my-4 > div > div');

        const card = document.createElement('div');
        card.title = 'Click to show/hide variables';
        card.className = 'gl-card gl-rounded-lg pipeline-variables-card hide-variables';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'stage-column-title gl-font-weight-bold gl-text-truncate gl-leading-36 gl-pl-4 gl-mb-n2 pipeline-variables-header';
        cardHeader.innerHTML = '<span title="Variables" class="gl-text-truncate gl-pr-3 gl-w-85p">Variables</span>';
        cardHeader.addEventListener('click', () => toggleVariablesCardVisibility(card));
        card.appendChild(cardHeader);

        const cardBody = document.createElement('div');
        cardBody.className = 'gl-card-body gl-pt-2 gl-pb-0 gl-border-t gl-px-2 pipeline-variables-body';
        card.appendChild(cardBody);


        getPipelineVariables(projectPath, pipelineId)
            .catch((error) => {
                console.error(error);
            })
            .then((variables) => {
                if (!variables || variables.length === 0) {
                    var text = 'No variables...'

                    if (!variables) text = 'Error while fetching variables...';

                    const p = document.createElement('p');
                    p.innerText = text;
                    p.className = 'gl-m-4 gl-font-style-italic';
                    cardBody.appendChild(p);
                    pipelineHeader.appendChild(card);
                    return;
                }

                const table = document.createElement('table');
                table.className = 'gl-table gl-table-bordered gl-table-striped gl-table-hover gl-mt-4 pipeline-variables-table';
                table.style.marginTop = '0';
                cardBody.appendChild(table);

                const thead = document.createElement('thead');
                table.appendChild(thead);

                const tr = document.createElement('tr');
                thead.appendChild(tr);

                const th1 = document.createElement('th');
                th1.innerText = 'Key';
                tr.appendChild(th1);

                const th2 = document.createElement('th');
                th2.innerText = 'Value';
                th2.style.width = '100%';
                tr.appendChild(th2);

                const tbody = document.createElement('tbody');
                table.appendChild(tbody);

                for (const variable of variables) {
                    const tr = document.createElement('tr');
                    tbody.appendChild(tr);

                    const td1 = document.createElement('td');
                    td1.innerText = variable.key;
                    tr.appendChild(td1);

                    const td2 = document.createElement('td');
                    td2.innerText = variable.value;
                    tr.appendChild(td2);
                }

                pipelineHeader.appendChild(card);
            });
    }


    // Add custom CSS
    const style = document.createElement('style');
    style.innerHTML = `
    .pipeline-variables-card {
        margin-top: 1rem;
    }

    .pipeline-variables-card .pipeline-variables-header {
        cursor: pointer;
    }

    .pipeline-variables-card.hide-variables .pipeline-variables-body {
        display: none;
    }

    .pipeline-variables-card .pipeline-variables-body {
        padding: 0;
    }

    .pipeline-variables-card .pipeline-variables-table {
        width: 100%;
    }

    .pipeline-variables-card .pipeline-variables-table tbody tr:last-child td {
        border-bottom: 0;
    `;
    document.head.appendChild(style);

    // Regex that matches :
    // Group 1: The project web_url
    // Group 2: The full project path
    // Group 3: The full group path
    // Group 4: The main group name
    // Group 5: The project name
    // Group 6: The pipeline ID
    const projectPattern = /(https?:\/\/[^\/]+\/((([^\/]+)(?:\/[^\/]+)?)\/([^.\/]+)))\/-\/pipelines\/(\d+)(\/.*)?/i;
    const projectUriMatch = window.location.href.match(projectPattern);

    if (projectUriMatch && projectUriMatch.length >= 7) {
        // Wait until body has class 'page-initialised'
        const observer = new MutationObserver((mutationsList, observer) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (mutation.target.classList.contains('page-initialised')) {
                        addVariablesInPipelineHeader(projectUriMatch[2], projectUriMatch[6]);
                        observer.disconnect();
                        return;
                    }
                }
            }
        });
        observer.observe(document.body, {
            attributes: true
        });
    }
}).catch(() => {
    return;
});