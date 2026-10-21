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
      name: 'read_text',
      description: 'Read and extract readable text content from the current page, an element by index, or a CSS selector. Use this to read news articles, blog posts, documentation, emails, or specific sections in detail for reading, summarizing, or copying.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'Optional index number of an element from the snapshot to read text from.'
          },
          selector: {
            type: 'string',
            description: 'Optional CSS selector to read text from (e.g. "article", "main", ".story-content", "h1, p"). If neither index nor selector is provided, extracts the main article or readable page content.'
          },
          maxLength: {
            type: 'number',
            description: 'Maximum characters to read (default 8000, max 20000).'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'copy_to_clipboard',
      description: 'Copy text to the system clipboard. You can provide explicit text (such as an article summary, report, or draft message) or specify an element index/selector to extract and copy directly from the page.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to copy to the system clipboard. If provided, this text will be copied directly.'
          },
          index: {
            type: 'number',
            description: 'Optional element index number from the snapshot to extract text from and copy to clipboard.'
          },
          selector: {
            type: 'string',
            description: 'Optional CSS selector to extract text from and copy to clipboard.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'paste_text',
      description: 'Paste text into an input field, textarea, or rich text editor (such as Gmail compose, Google Docs, search boxes, forms). If text is omitted, pastes whatever is currently stored in the system clipboard.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The index number of the target element to paste into.'
          },
          text: {
            type: 'string',
            description: 'Optional text to paste. If omitted, pastes whatever is currently in the system clipboard.'
          }
        },
        required: ['index']
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
