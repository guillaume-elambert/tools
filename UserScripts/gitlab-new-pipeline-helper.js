// ==UserScript==
// @name         New Gitlab pipeline
// @version      2024-03-05
// @description  Simplify the creation of a new Gitlab pipeline
// @author       Guillaume ELAMBERT
// @match        https://gitlab.com/*/-/pipelines/new
// @grant        none
// ==/UserScript==

var defaultConfig = {
    "VARIABLE1": "value1",
  };
  
  const privateToken = ''; // replace with your private token
  const authorEmails = [
  ]; // replace with your email
  
  window.fillVariables = async (variables = defaultConfig) => {
    var form = document.querySelector("#content-body > form");
    var fieldset = await window.waitForElement(form, fieldsetSelector)
      .catch(error => {
        console.error('Error while waiting for fieldset:', error);
        return null;
      });
  
    if (!fieldset) return;
    var iterated = 0;
  
    for (const [key, value] of Object.entries(variables)) {
        var container = await window.waitForElement(fieldset, `div:nth-of-type(${iterated+1}) > div`)
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
        var prom = window.waitForElement(fieldset, `div:nth-of-type(${iterated+1})`, 1000)
          .catch(error => {
            console.error(`Error while waiting for next container after ${key}:`, error);
          });
  
        inputKey.dispatchEvent(new Event('change', { bubbles: true }));
        inputValue.dispatchEvent(new Event('change', { bubbles: true }));
  
        if(!fieldset.querySelector(`div:nth-of-type(${iterated+1})`)){
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
  window.selectLastBranch = async (authorEmail, projectPath, afterClickCallback = undefined, gitlabApiUrl = 'https://gitlab.com/api/v4') => {
    // Get the last commit you made
    return fetch(`${gitlabApiUrl}/projects/${encodeURIComponent(projectPath)}/repository/commits?all=true&author=${encodeURIComponent(authorEmail)}&per_page=1`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${privateToken}`
      }
    })
    .then(response => response.json())
    .then(commits => {
      if(!commits || commits.length === 0 || !commits[0].id) {
        throw new Error('No commit found');
      }
  
      const lastCommit = commits[0];
  
      // Get the branches associated with that commit
      return fetch(`${gitlabApiUrl}/projects/${encodeURIComponent(projectPath)}/repository/commits/${lastCommit.id}/refs?type=branch`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${privateToken}`
        }
      });
    })
    .then(response => response.json())
    .then(data => {
      if(!data || data.length === 0) {
        throw new Error('No branches found');
      }
  
      var branch = data[0];
      // Click on the branch selector
      var selector = topFieldSet.querySelector(`.ref-selector > .gl-new-dropdown-panel .gl-new-dropdown-contents li[role='option'][data-testid='listbox-item-refs/heads/${branch.name}']`);
      if(!selector) {
        throw new Error('Branch not found');
      }
      selector.click();
      if(afterClickCallback && typeof afterClickCallback === 'function') {
        afterClickCallback();
      }
    });
  }
  
  window.waitForElement = (parent, selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const element = parent.querySelector(selector);
      if(element) {
        resolve(element);
      }
  
      var timeoutObj = null;
  
      if(timeout > 0) {
        timeoutObj = setTimeout(() => {
          observer.disconnect();
          reject(new Error(`Timeout while waiting for ${selector}`));
        }, timeout);
      }
  
      const observer = new MutationObserver(() => {
        const element = parent.querySelector(selector);
        if(element) {
          if(timeoutObj) clearTimeout(timeoutObj);
          resolve(element);
          observer.disconnect();
        }
      });
  
      observer.observe(parent, { childList: true });
    });
  }
  
  
  var form = document.querySelector("#content-body > form");
  var topFieldSet = form.querySelector("fieldset:nth-of-type(1)");
  const fieldsetSelector = "fieldset:nth-of-type(2) > div";
  
  // Add a button to fill the variables
  var btn = document.createElement("a");
  var label = document.createElement("label");
  label.textContent = "▼ Fill default variables ▼";
  label.className = "gl-button-text";
  btn.className = "btn js-no-auto-disable gl-mr-3 btn-confirm btn-md gl-button";
  btn.style = "margin-top: 1em;";
  
  window.fillVariablesUsage();
  window.fillVariables();
  
  btn.onclick = () => {
    fillVariables(defaultConfig);
  }
  
  btn.appendChild(label);
  topFieldSet.appendChild(btn);
  
  // Add default variables to the form each time the fieldset gets modified
  const observer = new MutationObserver(() => {
    if (form.querySelector(fieldsetSelector)) {
        window.fillVariables(defaultConfig);
    }
  });
  observer.observe(form, { childList: true });
  
  
  const projectPattern = /(https:\/\/gitlab.com\/(([^\/]+)\/([^\/]+)\/([^\/]+)))(.*)/i;
  var match = window.location.href.match(projectPattern);
  
  if(match && match.length >= 2) {
    for (const email of authorEmails) {
      var res = await window.selectLastBranch(email, match[2], async() => {
        // Await form to emit a new Mutation event
        await new Promise(resolve => {
          const observer = new MutationObserver(() => {
            resolve();
            observer.disconnect();
          });
          observer.observe(form.querySelector(fieldsetSelector), { childList: true });
        });
  
        window.fillVariables();
      }).then(() => true)
        .catch(error => {
          console.error(`Error while selecting last branch for ${email}:`, error);
          return false;
        });
  
      if(res) {
        break;
      }
    }
  }