<objective>
Build a Playwright-based TypeScript/JavaScript script that scrapes all conversations from a ChatGPT Project and exports each conversation as a clean markdown file.

The script takes a ChatGPT project URL as input, opens a browser for manual authentication, then parses all conversations in that project and saves them as individual markdown files with any inline images stored separately.
</objective>

<context>
ChatGPT Projects are a feature that groups related conversations together. Each project has multiple conversations that need to be individually accessed and parsed.

The user needs to manually log in because ChatGPT uses complex authentication that's impractical to automate. After login, the script should detect when auth is complete and proceed automatically.

This tool is for personal use to backup/export ChatGPT conversations for archival or analysis purposes.
</context>

<requirements>
<functional>
1. Accept a ChatGPT project URL as a command-line argument
2. Launch a visible (non-headless) Chromium browser via Playwright
3. Navigate to ChatGPT and pause for manual login
   - Display clear console message: "Please log in to ChatGPT. Press Enter when ready..."
   - Wait for user input before continuing
4. Navigate to the project URL after auth confirmation
5. Identify and iterate through all conversations in the project
6. For each conversation:
   - Extract all messages (both user and assistant)
   - Download any inline images (generated images, uploaded images, etc.)
   - Save conversation as markdown with image references
7. Handle pagination if the project has many conversations
8. Provide progress output showing which conversation is being processed
</functional>

<output_structure>
./output/
├── [project-name]/
│   ├── images/
│   │   ├── conv1-img1.png
│   │   ├── conv1-img2.png
│   │   └── ...
│   ├── conversation-1-[title-slug].md
│   ├── conversation-2-[title-slug].md
│   └── ...
</output_structure>

<markdown_format>
Use minimal, clean formatting:
- Conversation title as H1 at the top
- Each message as a paragraph
- Bold **User:** or **Assistant:** prefix for each message
- Images as standard markdown: ![](./images/filename.png)
- No timestamps, no extra metadata, no horizontal rules between messages
- Preserve code blocks with proper syntax highlighting markers
</markdown_format>
</requirements>

<implementation>
<tech_stack>
- Node.js with TypeScript (or JavaScript if simpler)
- Playwright for browser automation
- Native fs/path modules for file operations
</tech_stack>

<approach>
1. Set up Playwright with chromium in headed mode (headless: false)
2. Use page.waitForSelector() and page.evaluate() to extract DOM content
3. ChatGPT conversations are rendered dynamically - wait for content to load fully
4. Images may be lazy-loaded; scroll through conversation to trigger loading
5. For image downloads, intercept the image URLs and download via fetch or Playwright's request context
6. Sanitize conversation titles for use as filenames (remove special chars, limit length)
</approach>

<error_handling>
- If a conversation fails to load, log the error and continue to next
- If an image fails to download, log warning but still save the conversation markdown
- Gracefully handle rate limiting with exponential backoff if detected
</error_handling>

<selectors_note>
ChatGPT's DOM structure changes frequently. The script should:
- Use data-testid attributes when available (more stable)
- Fall back to semantic selectors (role, aria-label)
- Include comments noting which selectors may need updating
- Consider using page.content() and parsing with a library if DOM access is flaky
</selectors_note>
</implementation>

<output>
Create the following files:
- `./src/scraper.ts` - Main scraper script
- `./src/types.ts` - TypeScript interfaces (if using TS)
- `./package.json` - Project dependencies
- `./tsconfig.json` - TypeScript config (if using TS)
- `./README.md` - Usage instructions

Include a simple npm script to run: `npm run scrape -- "https://chatgpt.com/project/xxx"`
</output>

<verification>
Before declaring complete:
1. Ensure the script compiles/runs without errors
2. Test that it launches a browser and waits for login
3. Verify the output directory structure is created correctly
4. Confirm markdown files are properly formatted with image references
</verification>

<success_criteria>
- Script accepts project URL as argument
- Browser opens and waits for manual authentication
- All conversations in the project are discovered and processed
- Each conversation saved as individual .md file
- All images downloaded to images/ folder with correct references in markdown
- Clean, readable markdown output with User/Assistant message attribution
- Error handling prevents single failures from crashing entire scrape
</success_criteria>
