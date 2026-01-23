import { chromium } from 'playwright';
import * as path from 'path';

const USER_DATA_DIR = path.join(process.cwd(), '.browser-data');

async function login(): Promise<void> {
  console.log('🔐 ChatGPT Login Session\n');
  console.log('Opening browser with persistent profile...');
  console.log(`Session data: ${USER_DATA_DIR}\n`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INSTRUCTIONS:');
  console.log('1. Navigate to https://chatgpt.com in the browser');
  console.log('2. Log in with your Google account (or however you login)');
  console.log('3. Once logged in, CLOSE THE BROWSER WINDOW');
  console.log('   (Your session will be saved automatically)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Navigate to ChatGPT
  await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for browser to be closed by user
  await new Promise<void>((resolve) => {
    context.on('close', () => {
      resolve();
    });
  });

  console.log('\n✅ Session saved! You can now run: npm run scrape -- "<project-url>"');
}

login().catch(console.error);
