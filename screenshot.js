import puppeteer from 'puppeteer';
import { setTimeout } from 'timers/promises';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'screenshot1.png' });
  
  await page.click('#btn-slide-next');
  await setTimeout(1000);
  await page.screenshot({ path: 'screenshot2.png' });
  
  await page.click('#btn-slide-next');
  await setTimeout(1000);
  await page.screenshot({ path: 'screenshot3.png' });

  await page.click('#btn-slide-next');
  await setTimeout(1000);
  await page.screenshot({ path: 'screenshot4.png' });
  
  await browser.close();
})();
