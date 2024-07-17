// ==UserScript==
// @name         Create merge request on other projects from issue
// @version      2024-07-03
// @description  Create a merge request on a related but different projects from an issue
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*/-/issues/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-issue-merge-request.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-issue-merge-request.js
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

    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
    const scriptConfig = window.loadConfigurations('CUSTOM_MERGE_REQUESTS_FROM_ISSUE');
    if (!privateToken || !scriptConfig) {
        console.error('Error while loading the configuration');
        return;
    }

    const projectPattern = /(https:\/\/gitlab.com\/((([^\/]+)(\/([^\/]+))?)\/([^\/]+)))(.*)/i;
    const projectUriMatch = window.location.href.match(projectPattern);

    if (!projectUriMatch) {
        console.error('Error while matching the project URI');
        return;
    }

    // Check if the object has a key with the value of the project URIMatch[1]
    const projectConfig = scriptConfig[projectUriMatch[1]];
    if (!projectConfig) {
        console.error('No configuration found for the project');
        return;
    }


    window.getOrganizationRepositories = async (organization) => {
        organization = encodeURIComponent(organization);
        const response = await fetch(`https://gitlab.com/api/v4/groups/${organization}/projects?private_token=${privateToken}`);
        return await response.json();
    }

    window.getRepository = async (project) => {
        project = encodeURIComponent(project);
        const response = await fetch(`https://gitlab.com/api/v4/projects/${project}?private_token=${privateToken}`);
        return await response.json();
    }

    window.checkBranchAvailability = async (project, branch) => {
        // Check if the project has a branch with the same name
        project = encodeURIComponent(project);
        branch = encodeURIComponent(branch);
        const response = await fetch(`https://gitlab.com/api/v4/projects/${project}/repository/branches?private_token=${privateToken}`)
        return (await response.json()).find(branch => branch.name === branch) ? true : false;
    }

    window.createBranch = async (project, branch, source) => {
        project = encodeURIComponent(project);
        branch = encodeURIComponent(branch);
        source = encodeURIComponent(source);
        const response = await fetch(`https://gitlab.com/api/v4/projects/${project}/repository/branches?private_token=${privateToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                branch,
                ref: source,
            }),
        });

        return await response.json();
    }

    window.createMergeRequest = async (project, source, target, title) => {
        project = encodeURIComponent(project);
        source = encodeURIComponent(source);
        target = encodeURIComponent(target);
        title = encodeURIComponent(title);
        const response = await fetch(`https://gitlab.com/api/v4/projects/${project}/merge_requests?private_token=${privateToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_branch: source,
                target_branch: target,
                title,
            }),
        });

        return await response.json();
    }

    async function computeProjectsCheckboxes() {

        let checkboxes = '';
        
        // If the projectConfig has no 
        for (const [key, value] of Object.entries(projectConfig.projects)) {
            let targetProjectUri = key;
            let projectName = value.name;
            let sourceBranch = value.source;

            // Check if the value has a property 'name'
            if (!projectName) {
                projectName = targetProjectUri.match(projectPattern)[7];
            }

            // Check if the value has a property 'originBranch'
            if (!sourceBranch) {
                sourceBranch = (await window.getRepository(targetProjectUri.match(projectPattern)[2])).default_branch;
            }

            checkboxes += `
                <div class="gl-form-checkbox">
                    <input type="checkbox" id="create-branch-${targetProjectUri}" name="create-branch-${targetProjectUri}" value="${targetProjectUri}">
                    <label for="create-branch-${targetProjectUri}">
                        <span class="gl-form-checkbox-text">
                            <span>${projectName}</span>
                            <span class="gl-italic gl-text-secondary gl-text-sm gl-ml-2">${sourceBranch}</span>
                        </span>
                    </label>
                </div>
            `;
        }

        return checkboxes;
    }

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

    // Add a style tag to the head
    const style = document.createElement('style');
    style.innerHTML = `
    .gl-form-checkbox-text .gl-form-checkbox-description {
        margin-left: 0.2rem;
        font-style: italic;
    }`;


    const chevronIcon = window.getIcon('chevron-lg-up');
    const mergeRequestIcon = window.getIcon('merge-request');

    window.chevronIcon = chevronIcon;
    // Add div before #tasks
    const tasks = document.getElementById('tasks');
    const div = document.createElement('div');
    let widget = `
    <div id="custom-merge-requests" class="gl-new-card">
        <div class="gl-new-card-header">
            <div class="gl-new-card-title-wrapper">
                <h2 class="gl-new-card-title">
                    <div aria-hidden="true">
                        <a id="user-content-tasks-links" href="#tasks"
                            class="gl-link gl-text-decoration-none gl-display-none"></a>
                    </div>
                    Create branches and merge requests
                </h2>
                <span class="gl-new-card-count">
                    <svg role="img" aria-hidden="true" class="gl-mr-2 gl-icon s16 gl-fill-current">
                        <use href="${mergeRequestIcon.querySelector('use').getAttribute('href')}">
                        </use>
                    </svg>
                </span>
            </div>
            <div class="gl-new-card-toggle">
                <button aria-label="Collapse" data-testid="widget-toggle" aria-expanded="true" type="button"
                    class="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">
                    <svg role="img" aria-hidden="true"
                        class="gl-button-icon gl-icon s16 gl-fill-current">
                        <use href="${chevronIcon.querySelector('use').getAttribute('href')}"></use>
                    </svg>
                </button>
            </div>
        </div>

        <div data-testid="widget-body" class="gl-new-card-body">
            <div id="custom-merge-requests-checkboxes-container" class="gl-new-card-content gl-px-0">
                <div class="gl-spinner-container js-create-mr-spinner gl-button-icon" role="status">
                    <span aria-label="Loading"
                        class="gl-spinner gl-spinner-sm gl-spinner-dark gl-vertical-align-text-bottom!"></span>
                </div>
            </div>
        </div>
    </div>`;
    div.innerHTML = widget;
    
    tasks.parentElement.insertBefore(div, tasks);
    
    const checkboxesContainer = document.getElementById('custom-merge-requests-checkboxes-container');

    // If projectConfig.projects is not defined or empty
    if ( ! projectConfig.projects || ! Object.keys(projectConfig.projects).length ) {
        // Get the organization
        const organization = projectUriMatch[3];
        const repositories = await window.getOrganizationRepositories(organization);
        projectConfig.projects = {};

        for (const repository of repositories) {
            if (repository.archived) continue;
            if ( repository.merge_requests_enabled === false ) continue;
            if ( ! repository.default_branch ) continue;
            if ( repository.web_url === projectUriMatch[1] ) continue;

            projectConfig.projects[repository.web_url] = {
                name: repository.name,
                source: repository.default_branch,
            }
        }

    }
    const checkboxes = await computeProjectsCheckboxes();

    
    // Check that there is at least one checkbox
    if (!checkboxes) {
        console.error('No checkbox found');
        checkboxesContainer.innerHTML = '<p class="gl-new-card-empty">No projects to create branches and merge requests.<br/>Check configuration and console.<br/>You might also need to reload the page.</p>';
        return;
    }

    
    const issueId = window.location.href.match(/\/issues\/(\d+)/)[1];

    let issueTitle = document.querySelector('.title').innerText
    let branchesName = `${projectConfig['branch-name-prefix'] ?? ''}${issueTitle}`;
    branchesName = branchesName.replace('<ISSUE_ID>', issueId).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
    issueTitle = `${projectConfig['merge-request-title-prefix'] ?? ''}${issueTitle}`.replace('<ISSUE_ID>', issueId);

    checkboxesContainer.innerHTML = checkboxes + `
    <div class="gl-flex gl-flex-col gl-mt-4">
        <div class="form-group">
            <label for="merge-requests-name">Merge request title</label>
            <input type="text" id="merge-requests-title" name="merge-requests-title" value="${issueTitle}" class="gl-form-input gl-w-full gl-show-field-errors" placeholder="${issueTitle}">
            <p class="gl-field-error hidden" id="field-error-mr">This field is required.</p>
        </div>

        <div class="form-group">
            <label for="branches-title">Branches name</label>
            <input type="text" id="branches-name" name="branches-title" value="${branchesName}" class="gl-form-input gl-w-full gl-show-field-errors" placeholder="${branchesName}">
            <p class="gl-field-error hidden" id="field-error-br">This field is required.</p>
            <span id="branch-availability" class="js-branch-message form-text gl-font-sm hidden"></span>
        </div>

        <div class="form-group">
            <button id="create-branches" class="btn btn-primary gl-mt-4" disabled>
                <span class="gl-button-text">Create branch and merge request on selected projects</span>
            </button>
        </div>
    </div>
    `;

    window.checkAllBranchAvailabilityForProjects = async (projects, branch) => {
        let availability = {};
        for (const project of projects) {
            availability[project] = await window.checkBranchAvailability(project.match(projectPattern)[2], branch);
        }
        return availability;
    }

    window.getSelectedProjects = () => {
        const checkboxes = document.querySelectorAll('#custom-merge-requests-checkboxes-container input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(checkbox => checkbox.value);
    }

    window.validateBrMrForm = async () => {
        const button = document.getElementById('create-branches');
        button.disabled = true;

        const branchNameInput = document.getElementById('branches-name');
        const branchesName = branchNameInput.value;
        const mergeRequestInput = document.getElementById('merge-requests-title');
        const mergeRequestTitle = mergeRequestInput.value;
        const fieldErrorBr = document.getElementById('field-error-br');
        const fieldErrorMr = document.getElementById('field-error-mr');
        const branchAvailability = document.getElementById('branch-availability');

        let isValid = true;
        if (!branchesName || branchesName.trim() === '') {
            fieldErrorBr.classList.remove('hidden');
            isValid = false;
        } else {
            fieldErrorBr.classList.add('hidden');
            const branchesAvailability = await window.checkAllBranchAvailabilityForProjects(window.getSelectedProjects(), branchesName);

            // Get a string of all the projects that have the branch already taken separated by a comma
            let projectsWithBranch = Object.keys(branchesAvailability).filter(project => branchesAvailability[project]).map(project => `\"${projectConfig.projects[project].name}\"`).join(', ');
            if (projectsWithBranch) {
                branchAvailability.classList.remove('hidden');
                branchAvailability.classList.remove('gl-text-green-500');
                branchAvailability.classList.add('gl-text-red-500');
                branchAvailability.innerText = `Branch is already taken on ${projectsWithBranch}`;
                branchNameInput.classList.add('gl-field-error-outline');
                branchNameInput.classList.remove('gl-field-success-outline');
                isValid = false;
            } else {
                branchAvailability.classList.remove('hidden');
                branchAvailability.classList.add('gl-text-green-500');
                branchAvailability.classList.remove('gl-text-red-500');
                branchAvailability.innerText = `Branch is available on all selected projects`;
                branchNameInput.classList.remove('gl-field-error-outline');
                branchNameInput.classList.add('gl-field-success-outline');
            }
        }

        if (!mergeRequestTitle || mergeRequestTitle.trim() === '') {
            fieldErrorMr.classList.remove('hidden');
            mergeRequestInput.classList.add('gl-field-error-outline');
            mergeRequestInput.classList.remove('gl-field-success-outline');
            isValid = false;
        } else {
            fieldErrorMr.classList.add('hidden');
            mergeRequestInput.classList.remove('gl-field-error-outline');
        }

        button.disabled = !isValid;

        return isValid;
    }
    
    const branchNameInput = document.getElementById('branches-name');
    const mergeRequestInput = document.getElementById('merge-requests-title');
    window.projectConfig = projectConfig;

    branchNameInput.addEventListener('input', window.validateBrMrForm);
    mergeRequestInput.addEventListener('input', window.validateBrMrForm);
    document.querySelectorAll('#custom-merge-requests-checkboxes-container input[type="checkbox"]').forEach(checkbox => checkbox.addEventListener('change', window.validateBrMrForm));


    // gl-field-success-outline   gl-text-green-500
    // gl-field-error-outline   gl-text-red-500
});