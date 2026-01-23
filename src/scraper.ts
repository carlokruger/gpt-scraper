import { chromium, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type { Message, ImageRef, Conversation, ConversationLink } from './types.js';

const USER_DATA_DIR = path.join(process.cwd(), '.browser-data');

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

async function downloadImage(
  page: Page,
  imageUrl: string,
  outputDir: string,
  filename: string
): Promise<string | null> {
  try {
    const response = await page.request.get(imageUrl);
    if (!response.ok()) {
      console.warn(`  ⚠ Failed to download image: ${imageUrl}`);
      return null;
    }

    const buffer = await response.body();
    const imagePath = path.join(outputDir, filename);
    fs.writeFileSync(imagePath, buffer);
    return filename;
  } catch (error) {
    console.warn(`  ⚠ Error downloading image: ${error}`);
    return null;
  }
}

async function extractConversationLinks(page: Page): Promise<ConversationLink[]> {
  // Wait for the conversation list to load
  // ChatGPT renders conversations in a sidebar or project view
  // These selectors may need updating as ChatGPT's UI changes
  await page.waitForTimeout(2000);

  const links = await page.evaluate(() => {
    const conversations: ConversationLink[] = [];

    // Look for conversation links in the project view
    // ChatGPT typically uses data-testid or specific class patterns
    const conversationElements = document.querySelectorAll('a[href*="/c/"]');

    conversationElements.forEach((el) => {
      const href = el.getAttribute('href');
      if (href && href.includes('/c/')) {
        const id = href.split('/c/')[1]?.split('?')[0] || '';
        const title = el.textContent?.trim() || 'Untitled';
        if (id) {
          conversations.push({
            id,
            title,
            url: `https://chatgpt.com${href}`,
          });
        }
      }
    });

    return conversations;
  });

  // Deduplicate by ID
  const uniqueLinks = links.filter(
    (link, index, self) => self.findIndex((l) => l.id === link.id) === index
  );

  return uniqueLinks;
}

async function scrollToLoadAllContent(page: Page): Promise<void> {
  // Scroll through the conversation to trigger lazy-loaded images
  await page.evaluate(async () => {
    const container = document.querySelector('main') || document.body;
    const scrollHeight = container.scrollHeight;
    const viewportHeight = window.innerHeight;

    for (let scrollPos = 0; scrollPos < scrollHeight; scrollPos += viewportHeight) {
      container.scrollTo(0, scrollPos);
      await new Promise((r) => setTimeout(r, 300));
    }

    // Scroll back to top
    container.scrollTo(0, 0);
  });

  await page.waitForTimeout(1000);
}

async function extractMessages(
  page: Page,
  imagesDir: string,
  conversationIndex: number
): Promise<Message[]> {
  await scrollToLoadAllContent(page);

  // Extract message content from the conversation
  // ChatGPT renders messages in article elements or divs with specific data attributes
  const rawMessages = await page.evaluate(() => {
    const messages: Array<{ role: 'user' | 'assistant'; content: string; imageUrls: string[] }> = [];

    // ChatGPT uses data-message-author-role or similar patterns
    // These selectors target the conversation turn structure
    const turnElements = document.querySelectorAll('[data-message-author-role]');

    if (turnElements.length === 0) {
      // Fallback: try to find message groups by common patterns
      const articleElements = document.querySelectorAll('article, [data-testid*="conversation-turn"]');
      articleElements.forEach((article) => {
        const text = article.textContent?.trim() || '';
        // Try to determine role from content or structure
        const isUser = article.querySelector('[data-message-author-role="user"]') !== null ||
                       article.classList.contains('user-message');

        const images = Array.from(article.querySelectorAll('img'))
          .map((img) => img.src)
          .filter((src) => src && !src.includes('avatar') && !src.includes('icon'));

        if (text) {
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: text,
            imageUrls: images,
          });
        }
      });
    } else {
      turnElements.forEach((el) => {
        const role = el.getAttribute('data-message-author-role') as 'user' | 'assistant';

        // Get the message content, preserving code blocks
        const contentEl = el.querySelector('.markdown, .prose, [class*="markdown"]') || el;
        let content = '';

        // Handle code blocks specially
        const codeBlocks = contentEl.querySelectorAll('pre code');
        if (codeBlocks.length > 0) {
          // Clone the element to manipulate
          const clone = contentEl.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('pre').forEach((pre, idx) => {
            const code = pre.querySelector('code');
            const lang = code?.className.match(/language-(\w+)/)?.[1] || '';
            const codeText = code?.textContent || pre.textContent || '';
            pre.textContent = `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`;
          });
          content = clone.textContent?.trim() || '';
        } else {
          content = contentEl.textContent?.trim() || '';
        }

        // Find images in this message
        const images = Array.from(el.querySelectorAll('img'))
          .map((img) => img.src)
          .filter((src) => src && !src.includes('avatar') && !src.includes('icon') && !src.includes('data:image/svg'));

        if (content || images.length > 0) {
          messages.push({ role, content, imageUrls: images });
        }
      });
    }

    return messages;
  });

  // Download images and build final message objects
  const messages: Message[] = [];
  let imageCounter = 1;

  for (const raw of rawMessages) {
    const images: ImageRef[] = [];

    for (const imageUrl of raw.imageUrls) {
      const ext = imageUrl.includes('.png') ? 'png' :
                  imageUrl.includes('.gif') ? 'gif' : 'jpg';
      const filename = `conv${conversationIndex}-img${imageCounter}.${ext}`;

      const downloadedFilename = await downloadImage(page, imageUrl, imagesDir, filename);
      if (downloadedFilename) {
        images.push({
          url: imageUrl,
          localPath: `./images/${downloadedFilename}`,
          filename: downloadedFilename,
        });
        imageCounter++;
      }
    }

    messages.push({
      role: raw.role,
      content: raw.content,
      images,
    });
  }

  return messages;
}

function formatConversationAsMarkdown(conversation: Conversation): string {
  let md = `# ${conversation.title}\n\n`;

  for (const message of conversation.messages) {
    const prefix = message.role === 'user' ? '**User:**' : '**Assistant:**';
    md += `${prefix} ${message.content}\n`;

    // Add images after the message content
    for (const image of message.images) {
      md += `\n![](${image.localPath})\n`;
    }

    md += '\n';
  }

  return md;
}

async function scrapeProject(projectUrl: string): Promise<void> {
  console.log('🚀 Starting ChatGPT Project Scraper\n');

  // Validate URL
  if (!projectUrl.includes('chatgpt.com')) {
    console.error('❌ Invalid URL. Please provide a ChatGPT project URL.');
    process.exit(1);
  }

  // Launch browser with persistent context (saves cookies/session)
  console.log('📂 Launching browser with persistent profile...');
  console.log(`   Session data: ${USER_DATA_DIR}\n`);

  const context: BrowserContext = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 50,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate directly to the project URL
    console.log(`🌐 Navigating to: ${projectUrl}\n`);
    await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);

    // Get current URL
    const currentUrl = page.url();
    console.log(`✅ Connected!`);
    console.log(`📍 Current page: ${currentUrl}`);

    // Check if we got redirected to login
    if (currentUrl.includes('auth') || currentUrl.includes('login')) {
      console.log('\n❌ Not logged in! Run "npm run login" first to authenticate.');
      return;
    }

    // Extract project name from URL or page
    const projectName = await page.evaluate(() => {
      // Try to find project name in the UI
      const titleEl = document.querySelector('h1, [data-testid="project-title"], [class*="project"] h1');
      return titleEl?.textContent?.trim() || 'chatgpt-project';
    });

    const sanitizedProjectName = sanitizeFilename(projectName);
    console.log(`📋 Project: ${projectName}\n`);

    // Create output directories
    const outputDir = path.join(process.cwd(), 'output', sanitizedProjectName);
    const imagesDir = path.join(outputDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });

    // Extract conversation links
    console.log('\n🔍 Scanning page for conversations...');
    const conversationLinks = await extractConversationLinks(page);
    console.log(`   Found ${conversationLinks.length} conversation link(s) in DOM`);

    if (conversationLinks.length === 0) {
      console.log('⚠ No conversations found in this project.');
      console.log('  This might be due to:');
      console.log('  - UI changes in ChatGPT (selectors need updating)');
      console.log('  - The page not being a project page');
      console.log('  - Content still loading');
      console.log('\n  Check the browser window to see what\'s there.');
      await page.waitForTimeout(10000); // Give user time to see the browser
      return;
    }

    console.log(`📝 Found ${conversationLinks.length} conversation(s)\n`);

    // Process each conversation
    for (let i = 0; i < conversationLinks.length; i++) {
      const link = conversationLinks[i];
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[${i + 1}/${conversationLinks.length}] Processing: ${link.title}`);
      console.log(`   URL: ${link.url}`);
      console.log(`   Loading conversation...`);

      try {
        await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1500);
        console.log(`   Page loaded, extracting messages...`);

        const messages = await extractMessages(page, imagesDir, i + 1);
        console.log(`   Extracted ${messages.length} message(s)`);

        const conversation: Conversation = {
          id: link.id,
          title: link.title,
          messages,
        };

        // Save markdown file
        const filename = `conversation-${i + 1}-${sanitizeFilename(link.title)}.md`;
        const filepath = path.join(outputDir, filename);
        const markdown = formatConversationAsMarkdown(conversation);
        fs.writeFileSync(filepath, markdown);

        console.log(`  ✓ Saved: ${filename}`);
        console.log(`    Messages: ${messages.length}, Images: ${messages.reduce((acc, m) => acc + m.images.length, 0)}`);
      } catch (error) {
        console.error(`  ❌ Failed to process conversation: ${error}`);
      }

      // Small delay between conversations to avoid rate limiting
      if (i < conversationLinks.length - 1) {
        await page.waitForTimeout(1000);
      }
    }

    console.log(`\n✅ Done! Output saved to: ${outputDir}`);
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await context.close();
  }
}

// Main entry point
const projectUrl = process.argv[2];

if (!projectUrl) {
  console.log('Usage: npm run scrape -- "https://chatgpt.com/g/xxx/project/yyy"');
  console.log('       npm run scrape -- "https://chatgpt.com/project/xxx"');
  process.exit(1);
}

scrapeProject(projectUrl);
