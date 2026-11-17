import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const server = createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!['index.html','favicon.svg','manifest.webmanifest','offline-client.js','sw.js'].includes(name)) {
    res.writeHead(404);res.end();return;
  }
  const type=name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'application/javascript':'text/plain';
  res.setHeader('Content-Type',type);
  res.end(readFileSync(new URL('../'+name,import.meta.url)));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/';
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(const width of [320,390,1280]) {
    for(const colorScheme of ['dark','light']) {
      const page=await browser.newPage({viewport:{width,height:850},colorScheme});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(url+'#networth');
      await page.getByRole('navigation',{name:'Calm Capital sections'}).waitFor();
      const current=page.locator('#tabs button[aria-current="page"]');
      if(await current.count()!==1||await current.getAttribute('data-target')!=='networth')throw Error('Direct hash failed');
      if(await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+1))throw Error('Horizontal overflow at '+width);
      await page.evaluate(()=>localStorage.setItem('cc_ips_purpose',JSON.stringify('Preserved')));
      const paycheck=page.locator('#tabs button[data-target="paycheck"]');
      await paycheck.hover(); await paycheck.focus();await paycheck.press('Enter');
      await page.waitForURL('**/#paycheck');
      if(await paycheck.getAttribute('aria-current')!=='page')throw Error('Keyboard tab nav failed');
      await page.goBack();
      if(await current.getAttribute('data-target')!=='networth')throw Error('Browser Back failed');
      await page.goForward();
      if(await page.locator('#tabs button[aria-current="page"]').getAttribute('data-target')!=='paycheck')throw Error('Browser Forward failed');
      await page.reload();
      if(await page.locator('#tabs button[aria-current="page"]').getAttribute('data-target')!=='paycheck')throw Error('Refresh deep link failed');
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('cc_ips_purpose')));
      if(stored!=='Preserved')throw Error('Local record lost');
      if(errors.length)throw Error('Page JS error: '+errors.join(','));
      await page.close();
    }
  }
  console.log('PASS: 6 real Chromium size/color-scheme matrices with keyboard, hover, focus, hash, history, refresh, local data and console checks');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
