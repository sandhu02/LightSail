/**
 * Tool / function definitions for autonomous navigation agent.
 * Declares the schema exposed to the LLM for function calling.
 */

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click on an interactive element identified by its index number from the DOM snapshot.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index number of the element to click (from the interactive elements list).'
          }
        },
        required: ['index']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Clear an input/textarea element and type new text into it. Use this for search boxes, form fields, etc.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index number of the input element to type into.'
          },
          text: {
            type: 'string',
            description: 'The text to type into the element.'
          },
          pressEnter: {
            type: 'boolean',
            description: 'Whether to press Enter after typing. Default false.'
          }
        },
        required: ['index', 'text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the browser to a specific URL. Use this when you need to go to a known URL directly.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The full URL to navigate to (must start with http:// or https://).'
          }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Scroll the page up or down to reveal more content.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
            description: 'Direction to scroll.'
          },
          amount: {
            type: 'number',
            description: 'Pixels to scroll. Default is 500.'
          }
        },
        required: ['direction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Wait for the page to load or for dynamic content to appear. Use after navigation or clicking elements that trigger page loads.',
      parameters: {
        type: 'object',
        properties: {
          milliseconds: {
            type: 'number',
            description: 'Time to wait in milliseconds (100-5000). Default is 2000.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'select_option',
      description: 'Select an option from a <select> dropdown element.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index number of the <select> element.'
          },
          value: {
            type: 'string',
            description: 'The value or visible text of the option to select.'
          }
        },
        required: ['index', 'value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'go_back',
      description: 'Navigate back to the previous page (browser back button).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'done',
      description: 'Signal that the task is complete. Call this when the user\'s goal has been fulfilled or when you determine the goal cannot be accomplished.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'A brief summary of what was accomplished or why the task could not be completed.'
          },
          success: {
            type: 'boolean',
            description: 'Whether the task was successfully completed.'
          }
        },
        required: ['summary', 'success']
      }
    }
  }
]

module.exports = { TOOL_DEFINITIONS }
