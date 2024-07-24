// ==UserScript==
// @name         Create merge request on other projects from issue
// @version      2024-07-23
// @description  Create a merge request on a related but different projects from an issue
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*/-/issues/*
// @downloadURL  https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-merge-request-from-issue.js
// @updateURL    https://raw.githubusercontent.com/guillaume-elambert/tools/master/UserScripts/Gitlab/gitlab-merge-request-from-issue.js
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

    const GITLAB_DEVELOPER_ACCESS = 30;

    const privateToken = window.loadConfigurations('API_PRIVATE_TOKEN');
    const scriptConfig = window.loadConfigurations('CREATE_MERGE_REQUESTS_ON_OTHER_PROJECTS_FROM_ISSUE');
    if (!privateToken || !scriptConfig) {
        console.error('Error while loading the configuration');
        return;
    }

    const DEFAULT_CONFIG = {
        branch_name_prefix: "issue-<ISSUE_ID>-",
        merge_request_title_prefix: "Issue <ISSUE_ID>: ",
        squash: false,
        remove_source_branch: false,
        include_issue_description: false,
    }


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

    if (!projectUriMatch) {
        console.error('Error while matching the project URI');
        return;
    }

    // Check if the object has a key with the value of the project URIMatch[0]
    const projectConfig = scriptConfig[projectUriMatch[0]];
    if (!projectConfig) {
        console.error('No configuration found for the project');
        return;
    }

    const getGroupProjects = async (group) => {
        group = encodeURIComponent(group);
        const endpointsToCheck = {
            group_endpoint: {
                endpoint: `/api/v4/groups/${group}/projects`,
                additional_args: {
                    order_by: 'path',
                    sort: 'asc'
                },
            },
            user_endpoint: {
                endpoint: `/api/v4/projects`,
                additional_args: {
                    owned: true,
                },
            }
        }

        const additionalArgs = {
            min_access_level: GITLAB_DEVELOPER_ACCESS,
            include_subgroups: true,
            with_merge_requests_enabled: true,
            archived: false,
            per_page: 100,
            private_token: privateToken
        };

        let response = undefined;
        for (const [key, endpoint] of Object.entries(endpointsToCheck)) {
            response = await fetch(`${window.location.origin}${endpoint.endpoint}?${new URLSearchParams({ ...additionalArgs, ...endpoint.additional_args })}`);
            if (!response.ok) continue;
            return await response.json();
        }

        throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
    }

    const getProject = async (project) => {
        project = encodeURIComponent(project);
        const response = await fetch(`${window.location.origin}/api/v4/projects/${project}?private_token=${privateToken}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
        }
        return await response.json();
    }

    const checkBranchAvailability = async (project, branchName) => {
        // Check if the project has a branch with the same name
        project = encodeURIComponent(project);
        const response = await fetch(`${window.location.origin}/api/v4/projects/${project}/repository/branches?private_token=${privateToken}`)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
        }
        // Return false if the branch is found
        return (await response.json()).find(branch => branch.name === branchName) === undefined;
    }

    const createBranch = async (project, branch, source_branch) => {
        project = encodeURIComponent(project);
        const response = await fetch(`${window.location.origin}/api/v4/projects/${project}/repository/branches?private_token=${privateToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "branch": branch,
                "ref": source_branch,
            }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
        }
        return await response.json();
    }

    const createMergeRequest = async (project, source_branch, target_branch, title, description = '', assignee_ids = [], remove_source_branch = false, squash = false) => {
        project = encodeURIComponent(project);
        const response = await fetch(`${window.location.origin}/api/v4/projects/${project}/merge_requests?private_token=${privateToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "source_branch": source_branch,
                "target_branch": target_branch,
                "title": title,
                "description": description,
                "assignee_ids": assignee_ids,
                "remove_source_branch": remove_source_branch,
                "squash": squash,
            }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
        }
        return await response.json();
    }

    const getIssue = async (project, issue) => {
        project = encodeURIComponent(project);
        issue = encodeURIComponent(issue);
        const response = await fetch(`${window.location.origin}/api/v4/projects/${project}/issues/${issue}?private_token=${privateToken}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}. ${response.statusText}`);
        }
        return await response.json();
    }

    const isValidProject = async (apiLoadedProject) => {
        if (!apiLoadedProject.permissions) {
            apiLoadedProject = await getProject(apiLoadedProject.id);
        }

        let hasDeveloperAccess = false;
        for (const [_, permission] of Object.entries(apiLoadedProject.permissions)) {
            if (!permission) continue;
            hasDeveloperAccess = (permission.access_level ?? 0) >= GITLAB_DEVELOPER_ACCESS;
            if (hasDeveloperAccess) break;
        }

        return (
            !apiLoadedProject.archived &&
            apiLoadedProject.merge_requests_enabled &&
            (apiLoadedProject.default_branch ? true : false) &&
            apiLoadedProject.web_url !== projectUriMatch[0] &&
            hasDeveloperAccess
        )
    }

    const computeProjectsCheckboxes = (projects) => {

        let checkboxes = [];

        // If the projectConfig has no 
        for (const project of projects) {
            let targetProjectUri = project.web_url;
            let projectName = project.name;
            let sourceBranch = project.default_branch;
            let checkbox = document.createElement('div');
            checkbox.innerHTML = `
                <input type="checkbox" id="create-branch-${targetProjectUri}" name="create-branch-${targetProjectUri}" value="${targetProjectUri}">
                <label for="create-branch-${targetProjectUri}" class="gl-ml-2 gl-mb-0!">
                    <span class="gl-form-checkbox-text">
                        <span>${projectName}</span>
                        <span class="gl-italic gl-text-secondary gl-text-sm gl-ml-2">${sourceBranch}</span>
                    </span>
                </label>
            `;
            checkbox.classList = "gl-form-checkbox gl-mb-3";
            checkbox.title = `Create new branch and merge request on "${projectName}" based on the branch "${sourceBranch}".`;
            checkboxes.push(checkbox);
        }

        return checkboxes;
    }

    const getIcon = (slug) => {
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

    const getProjectsWhereBranchNameUnavailable = async (projects, branch) => {
        let projectsWithBranchesUnavailable = [];
        for (const project of projects) {
            try {
                if (!await checkBranchAvailability(project.web_url.match(projectPattern)[1], branch)) {
                    projectsWithBranchesUnavailable.push(project);
                }
            } catch (error) {
                console.error(`Error while checking the branch availability on ${project}`, error);
                projectsWithBranchesUnavailable.push(project);
            }
        }
        return projectsWithBranchesUnavailable;
    }

    const getSelectedProjects = () => {
        let checkboxes = document.querySelectorAll('#custom-merge-requests-checkboxes-container input[type="checkbox"]:checked');
        if (!checkboxes || !checkboxes.length) return {};
        checkboxes = Array.from(checkboxes).map(checkbox => checkbox.value);
        return apiLoadedProjects.filter(project => checkboxes.includes(project.web_url));
    }

    const validateBrMrForm = async () => {
        const button = document.getElementById('create-branches');
        button.disabled = true;

        const branchNameInput = document.getElementById('branches-name');
        const branchesName = branchNameInput.value;
        const mergeRequestInput = document.getElementById('merge-requests-title');
        const mergeRequestTitle = mergeRequestInput.value;
        const fieldErrorBr = document.getElementById('field-error-br');
        const fieldErrorMr = document.getElementById('field-error-mr');
        const branchAvailability = document.getElementById('branch-availability');

        const selectedProjects = getSelectedProjects();
        if (!selectedProjects.length) {
            button.disabled = true;
            return false;
        }

        let isValid = true;
        if (!branchesName || branchesName.trim() === '') {
            fieldErrorBr.classList.remove('hidden');
            branchAvailability.classList.add('hidden');
            branchNameInput.classList.add('gl-field-error-outline');
            branchNameInput.classList.remove('gl-field-success-outline');
            isValid = false;
        } else {
            fieldErrorBr.classList.add('hidden');
            const projectsWithBranchesUnavailable = await getProjectsWhereBranchNameUnavailable(selectedProjects, branchesName);

            // Get a string of all the projects that have the branch already taken separated by a comma
            let projectsWithBranch = projectsWithBranchesUnavailable.map(project => `\"${project.name}\"`).join(', ');

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


    const chevronIcon = getIcon('chevron-lg-up');
    const mergeRequestIcon = getIcon('merge-request');
    const checkCircleIcon = getIcon('check-circle');
    const closeIcon = getIcon('close');
    const errorIcon = getIcon('error');

    // Add div before #tasks
    const tasks = document.getElementById('tasks');
    const div = document.createElement('div');
    // Detect theme used html element has class gl-dark
    let theme = document.querySelector('html').classList.contains('gl-dark') ? 'dark' : 'light';
    let widgetInnerHtml = `
    <div id="custom-merge-requests" class="gl-card gl-new-card">
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
                <button id="toggle-custom-merge-requests-button" type="button"
                    class="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">
                    <svg role="img" aria-hidden="true"
                        class="gl-button-icon gl-icon s16 gl-fill-current">
                        <use href="${chevronIcon.querySelector('use').getAttribute('href')}"></use>
                    </svg>
                </button>
            </div>
        </div>

        <div id="custom-merge-requests-widget-body" class="gl-new-card-body">
            <div id="custom-merge-requests-checkboxes-container" class="gl-new-card-content gl-px-0">
                <div class="gl-spinner-container js-create-mr-spinner gl-button-icon" role="status">
                    <span aria-label="Loading" class="gl-spinner gl-spinner-sm ${theme == "dark" ? "gl-spinner-dark" : ""} gl-vertical-align-text-bottom!">
                    </span>
                </div>
            </div>
        </div>
    </div>`;
    div.innerHTML = widgetInnerHtml;

    tasks.parentElement.insertBefore(div, tasks);
    const widget = document.getElementById("custom-merge-requests");
    const widgetBody = document.getElementById("custom-merge-requests-widget-body");

    const checkboxesContainer = widgetBody.querySelector('#custom-merge-requests-checkboxes-container');
    let apiLoadedProjects = [];
    let areProjectsLoadedFromGroup = false;

    const group = projectUriMatch[3];

    // If projectConfig.projects is not defined or empty
    if (!projectConfig.projects || !Object.keys(projectConfig.projects).length) {
        let projects = undefined;
        areProjectsLoadedFromGroup = true;

        try {
            projects = await getGroupProjects(group);
        } catch (error) {
            console.error(`Error while fetching the projects for the group ${group}`, error);
            return;
        }

        // Check projectValidity for each project using the async function isValidProject
        for (const project of projects) {
            // We know that the user has developer access to the project
            project.permissions = {
                "forced_access_level": {
                    "access_level": GITLAB_DEVELOPER_ACCESS
                }
            };

            try {
                if (!(await isValidProject(project))) {
                    continue;
                }

                apiLoadedProjects.push(project);
            } catch (error) {
                console.error(`Error while checking the project ${project}`, error);
                continue;
            }
        }

    } else {
        let projects = {
            ...projectConfig.projects
        };

        // Remove the projects that do not exists or that the user does not have access or that are archived or that do not have merge requests enabled
        for (const probjectWebUrl in projects) {
            try {
                const project = await getProject(probjectWebUrl.match(projectPattern)[1]);

                if (!(await isValidProject(project))) {
                    // Remove the project from the list
                    delete projectConfig.projects[probjectWebUrl];
                    continue;
                }

                if (projects[probjectWebUrl].name) project.name = projects[probjectWebUrl].name;
                if (projects[probjectWebUrl].default_branch) project.default_branch = projects[probjectWebUrl].default_branch;
                if (projects[probjectWebUrl].squash) project.squash = projects[probjectWebUrl].squash;
                if (projects[probjectWebUrl].remove_source_branch) project.remove_source_branch = projects[probjectWebUrl].remove_source_branch;
                if (projects[probjectWebUrl].include_issue_description) project.include_issue_description = projects[probjectWebUrl].include_issue_description;

                apiLoadedProjects.push(project);
            } catch (error) {
                console.error(`Error while fetching the project ${probjectWebUrl}`, error);
                // Remove the project from the list
                delete projectConfig.projects[probjectWebUrl];
                continue;
            }
        }
    }

    // Check if the projectConfig has the exlude_projects key
    if (projectConfig.excluded_projects) {
        for (const project of projectConfig.excluded_projects) {
            // Find in apiLoaded the project that match the project
            const projectIndex = apiLoadedProjects.findIndex(p => p.web_url === project);
            if (projectIndex === -1) continue;
            // Remove the project from the list
            apiLoadedProjects.splice(projectIndex, 1);
        }
    }

    const setNoProjectError = () => {
        checkboxesContainer.innerHTML = `<p class="gl-new-card-empty">
            No projects to create branches and merge requests.<br/>
            Check configuration and console.<br/>
            You may also need to reload the page.
        </p>`;
    }

    if (!apiLoadedProjects.length) {
        setNoProjectError();
        return;
    }

    const countIncludeDescriptionCheckbox = apiLoadedProjects.filter(project =>
        areProjectsLoadedFromGroup ??
        project.include_issue_description ??
        projectConfig.include_issue_description ??
        false
    ).length;

    const checkboxes = computeProjectsCheckboxes(apiLoadedProjects);


    // Check that there is at least one checkbox
    if (!checkboxes) {
        setNoProjectError();
        return;
    }

    const replaceSpecialCharsBranchName = (branchName) =>
        branchName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-');


    const issueId = window.location.href.match(/\/issues\/(\d+)/)[1];

    const issueTitle = document.querySelector('.title').innerText
    let branchesName = `${projectConfig.branch_name_prefix ?? DEFAULT_CONFIG.branch_name_prefix}${issueTitle}`;
    branchesName = replaceSpecialCharsBranchName(branchesName.replace('<ISSUE_ID>', issueId)).toLowerCase();
    const mergeRequestTitle = `Draft: ${projectConfig.merge_request_title_prefix ?? DEFAULT_CONFIG.merge_request_title_prefix}${issueTitle}`.replace('<ISSUE_ID>', issueId);

    checkboxesContainer.innerHTML = '';
    for (const checkbox of checkboxes) {
        checkboxesContainer.appendChild(checkbox)
    }

    const divider = document.createElement('div');
    divider.classList = "divider gl-m-0!";
    widgetBody.appendChild(divider);

    const inputs = document.createElement('div');
    inputs.innerHTML = `
    <div class="gl-flex gl-flex-col gl-mt-4 gl-show-field-errors">
        <div class="form-group">
            <label for="merge-requests-name">Merge request title</label>
            <input type="text" id="merge-requests-title" name="merge-requests-title" value="${mergeRequestTitle}" class="gl-form-input gl-w-full" placeholder="${mergeRequestTitle}">
            <span class="form-text gl-font-sm gl-field-error hidden" id="field-error-mr">This field is required.</span>
            <div class="gl-form-checkbox gl-mt-4 gl-mb-3">
                <input type="checkbox" id="include-description-in-merge-requests" name="include-description-in-merge-requests">
                <label for="include-description-in-merge-requests" class="gl-ml-2 gl-mb-0!">
                    <span class="gl-form-checkbox-text">
                        <span>Include issue description in merge requests</span>
                    </span>
                </label>
            </div>
        </div>

        <div class="form-group">
            <label for="branches-title">Branches name</label>
            <input type="text" id="branches-name" name="branches-title" value="${branchesName}" class="gl-form-input gl-w-full" placeholder="${branchesName}">
            <span class="form-text gl-font-sm gl-field-error hidden" id="field-error-br">This field is required.</span>
            <span id="branch-availability" class="form-text gl-font-sm hidden"></span>

        </div>

        <div class="form-group">
            <button id="create-branches" class="btn btn-primary" disabled>
                <span class="gl-button-text">Create branch and merge request on selected projects</span>
            </button>
        </div>
    </div>
    `;
    widgetBody.appendChild(inputs);

    const resultAlertContainer = document.createElement('div');
    resultAlertContainer.id = 'result-alert-container';
    widgetBody.appendChild(resultAlertContainer);


    const branchNameInput = inputs.querySelector('#branches-name');
    const mergeRequestInput = inputs.querySelector('#merge-requests-title');
    let validateBrMrFormTimeout = undefined;


    const disableIncludeDescriptionCheckbox = countIncludeDescriptionCheckbox !== apiLoadedProjects.length;
    const includeDescriptionCheckbox = inputs.querySelector('#include-description-in-merge-requests');
    if (disableIncludeDescriptionCheckbox) {
        includeDescriptionCheckbox.disabled = true;
        includeDescriptionCheckbox.checked = true;
        includeDescriptionCheckbox.parentElement.title = 'The "include_issue_description" has been set for at least one project in the configuration.';
    } else {
        includeDescriptionCheckbox.checked = projectConfig.include_issue_description ?? DEFAULT_CONFIG.include_issue_description;
        includeDescriptionCheckbox.disabled = false;
        includeDescriptionCheckbox.addEventListener('change', () => {
            projectConfig.include_issue_description = includeDescriptionCheckbox.checked;
        });
    }
    // Add a custom style element
    const style = document.createElement('style');
    style.innerHTML = `
    #custom-merge-requests .gl-form-checkbox {
        width: fit-content;
    }
    
    #custom-merge-requests .gl-form-checkbox,
    #custom-merge-requests .gl-form-checkbox * {
        cursor: pointer;
        vertical-align: middle;
    }
    /* Chanche cursor of all elements inside .gl-form-checkbox if it contains a checkbox that is disabled */ 
    #custom-merge-requests .gl-form-checkbox:has(input[type="checkbox"]:disabled),
    #custom-merge-requests .gl-form-checkbox:has(input[type="checkbox"]:disabled) * {
        cursor: not-allowed;
    }
    `;
    document.head.appendChild(style);

    let widgetContent = widgetBody.children;
    widget.querySelector("#toggle-custom-merge-requests-button").addEventListener('click', () => {
        if (widget.classList.contains("is-collapsed") || widgetBody.classList.contains("hidden")) {
            for (const child of widgetContent) {
                widgetBody.appendChild(child);
            }
            widget.classList.remove("is-collapsed");
            widgetBody.classList.remove("hidden");
            return
        }

        widgetContent = widgetBody.children
        widgetBody.innerHtml = ''
        widget.classList.add("is-collapsed")
        widgetBody.classList.add("hidden")
    });

    const validateOnInput = () => {
        const button = document.getElementById('create-branches');
        button.disabled = true;
        clearTimeout(validateBrMrFormTimeout);
        validateBrMrFormTimeout = setTimeout(validateBrMrForm, 1000);
    }

    // When the input is changed (at least 0.2s after the last input)
    branchNameInput.addEventListener('input', validateOnInput);
    mergeRequestInput.addEventListener('input', validateOnInput);
    document.querySelectorAll('#custom-merge-requests-checkboxes-container input[type="checkbox"]').forEach(checkbox => checkbox.addEventListener('change', () => validateBrMrForm(apiLoadedProjects)));

    // Create an event listener for the button
    const createBranchesButton = document.getElementById('create-branches');
    createBranchesButton.addEventListener('click', async () => {
        const selectedProjects = getSelectedProjects();
        const branchName = branchNameInput.value;
        const mergeRequestTitle = mergeRequestInput.value;

        if (!await validateBrMrForm()) return;
        if (!selectedProjects.length) return;
        createBranchesButton.disabled = true;

        const includeDescriptionCheckbox = document.getElementById('include-description-in-merge-requests');
        projectConfig.include_issue_description = includeDescriptionCheckbox.checked;

        let issue = undefined;
        try {
            issue = await getIssue(projectUriMatch[1], issueId);
        } catch (error) {
            console.error(`Error while fetching the issue ${issueId}`, error);
            return;
        }

        let assignee_ids = issue.assignees.map(assignee => assignee.id);
        let description = issue.description ?? '';
        const hrefCheckCircleIcon = checkCircleIcon.querySelector('use').getAttribute('href');
        const hrefCloseIcon = closeIcon.querySelector('use').getAttribute('href');
        const hrefErrorIcon = errorIcon.querySelector('use').getAttribute('href');


        const editAlertForError = (alert, project, gitlabObjectName, gitlabObjectType = "merge request") => {
            const container = alert.querySelector('.gl-alert');
            container.classList.remove('gl-alert-success');
            container.classList.add('gl-alert-danger');
            alert.querySelector('svg.gl-alert-icon use').setAttribute('href', hrefErrorIcon);
            alert.querySelector('.gl-alert-body').innerHTML = `Error while creating the ${gitlabObjectType.trim()} "<span class="gl-italic">${gitlabObjectName}</span>" on ${project.name}`;
            container.classList.remove('hidden');
        }

        const editAlertForSuccess = (alert, project, mergeRequest) => {
            const container = alert.querySelector('.gl-alert');
            container.classList.remove('gl-alert-danger');
            container.classList.add('gl-alert-success');
            alert.querySelector('svg.gl-alert-icon use').setAttribute('href', hrefCheckCircleIcon);
            alert.querySelector('.gl-alert-body').innerHTML = `
            Merge request "<span class="gl-italic">${mergeRequest.title}</span>" created on <a href="${mergeRequest.web_url}" class="gl-link">${project.name}</a>
            `;
            container.classList.remove('hidden');
        }

        resultAlertContainer.innerHTML = '';

        for (const project of selectedProjects) {
            const projectPath = project.web_url.match(projectPattern)[1];
            const sourceBranch = project.default_branch;
            const remove_source_branch = project.remove_source_branch ?? projectConfig.remove_source_branch ?? DEFAULT_CONFIG.remove_source_branch;
            const squash = project.squash ?? projectConfig.squash ?? DEFAULT_CONFIG.squash;
            const include_issue_description = project.include_issue_description ?? projectConfig.include_issue_description ?? DEFAULT_CONFIG.include_issue_description;

            let mergeRequestDescription = `Related to ${window.location.href}`;
            if (include_issue_description && description.trim() !== '') {
                mergeRequestDescription += `\n\n${description}`
            }

            const alert = document.createElement('div');
            alert.innerHTML = `
                <div class="gl-m-4 gl-p-3! gl-pl-9! gl-border-bottom-0 gl-alert hidden">
                    <div class="gl-top-3 gl-alert-icon-container">
                        <svg data-testid="check-circle-icon" role="img" aria-hidden="true"
                            class="gl-alert-icon gl-icon s16 gl-fill-current">
                            <use href="">
                            </use>
                        </svg>
                    </div>
                    <div role="alert" aria-live="polite" class="gl-alert-content">
                        <div class="gl-alert-body"></div>
                    </div>
                    <button aria-label="Dismiss" type="button" style="top: .4rem;"
                        class="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">
                        <svg data-testid="close-icon" role="img" aria-hidden="true" class="gl-button-icon gl-icon s16 gl-fill-current">
                            <use href="${hrefCloseIcon}"></use>
                        </svg>
                    </button>
                </div>
            `;
            alert.querySelector('.gl-dismiss-btn').addEventListener('click', () => alert.remove());
            resultAlertContainer.appendChild(alert);


            try {
                const branch = await createBranch(projectPath, branchName, sourceBranch);
                // Or the branch id is not defined
                if (!branch || branch.id === 1) {
                    throw new Error();
                }

            } catch (error) {
                editAlertForError(alert, project, branchName, "branch");
                console.error(`Error while creating the branch on`, project, error);
                continue;
            }

            try {
                const mergeRequest = await createMergeRequest(projectPath, branchName, sourceBranch, mergeRequestTitle, mergeRequestDescription, assignee_ids, remove_source_branch, squash).catch(() => undefined);
                if (!mergeRequest) throw new Error();
                editAlertForSuccess(alert, project, mergeRequest);

            } catch (error) {
                editAlertForError(alert, project, mergeRequestTitle);;
                console.error(`Error while creating the merge request on`, project, error);
                continue;
            }
        }
        validateBrMrForm();
    });


})