# ChatGPT Project Scraper

Scrape all conversations from a ChatGPT Project and export them as clean markdown files.

## Setup

```bash
npm install
```

## Usage

```bash
npm run scrape -- "https://chatgpt.com/g/xxx/project/yyy"
```

The script will:

1. Open a browser window
2. Navigate to ChatGPT and wait for you to log in manually
3. After you press Enter, it will navigate to your project
4. Extract all conversations and save them as markdown files

## Output Structure

```
output/
└── your-project-name/
    ├── images/
    │   ├── conv1-img1.png
    │   └── ...
    ├── conversation-1-title.md
    ├── conversation-2-title.md
    └── ...
```

## Markdown Format

Each conversation is saved with:
- Title as H1
- **User:** and **Assistant:** prefixes for messages
- Images linked from the `./images/` folder
- Code blocks preserved with syntax highlighting

## Troubleshooting

**No conversations found**: ChatGPT's UI changes frequently. The script may need selector updates. Check the browser window to see if conversations are visible.

**Images not downloading**: Some images may be protected or lazy-loaded. The script will log warnings but continue processing.

**Rate limiting**: If ChatGPT starts blocking requests, try running the script again with fewer conversations or add longer delays.
