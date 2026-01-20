/**
 * Prompt Loader Utility
 * Loads and templates AI prompts from text files
 */
const fs = require('fs');
const path = require('path');

/**
 * Load a prompt template from file
 * @param {string} name - Prompt file name (without .txt extension)
 * @returns {string} Prompt template content
 */
function loadPrompt(name) {
  const filePath = path.join(__dirname, `${name}.txt`);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Load and populate a prompt template with variables
 * @param {string} name - Prompt file name (without .txt extension)
 * @param {Object} variables - Key-value pairs to substitute in the template
 * @returns {string} Populated prompt
 */
function loadPromptWithVariables(name, variables = {}) {
  let template = loadPrompt(name);

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    template = template.split(placeholder).join(value);
  }

  return template;
}

module.exports = {
  loadPrompt,
  loadPromptWithVariables
};
