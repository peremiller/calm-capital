import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const start = '/* CALM_TAB_NAV_START */', end = '/* CALM_TAB_NAV_END */';
assert.ok(html.includes(start) && html.includes(end));
const source = html.split(start)[1].split(end)[0];
const panelNames = ['ips','paycheck','networth','meeting','floor','recoveries','bear'];
function fixture(hash = '', saved = 'ips') {
  const data = new Map([['cc_lastView', JSON.stringify(saved)], ['cc_ips_purpose', JSON.stringify('keep')], ['unrelated', 'keep']]);
  const buttons = [], panels = panelNames.map(view => ({ dataset: { view }, id: '', active:false,
    classList: { toggle(_, yes){ this.active = yes; } } }));
  const loc = { hash };
  const history = { calls: [], pushState(_a, _b, url) {this.calls.push(url);loc.hash=url;} };
  const tabs = {appendChild(b){buttons.push(b);}};
  const document = {
    createElement() {
      const attributes = new Map();
      return {dataset:{},attributes, classList:{toggle(_,yes){this.active=yes;}},setAttribute(k,v){attributes.set(k,v);},
        removeAttribute(k){attributes.delete(k);}};
    },
    querySelectorAll(selector) {
      if(selector==='.view')return panels;
      if(selector==='#tabs button')return buttons;
      throw new Error('unknown selector '+selector);
    }
  };
  const context={document,history,location:loc,drawChart(){},
    $(id) { if(id==='tabs')return tabs;throw new Error('bad element '+id);},
    store:{get(k,d){return JSON.parse(data.get('cc_'+k)??JSON.stringify(d));},set(k,v){data.set('cc_'+k,JSON.stringify(v));}}};
  return {...vm.runInNewContext(source+'\n({showView,syncTabFromLocation,TABS})',context),buttons,panels,loc,history,data};
}
test('all seven stable section controls and panels are related, with one current section',()=>{
 const a=fixture('#networth');
 a.syncTabFromLocation();
 assert.equal(a.buttons.length,7);
 for(let i=0;i<7;i++)assert.equal(a.buttons[i].attributes.get('aria-controls'),'calm-view-'+panelNames[i]);
 assert.equal(a.buttons.filter(b=>b.attributes.get('aria-current')==='page').length,1);
 assert.equal(a.buttons[2].attributes.get('aria-current'),'page');
 assert.equal(a.panels[2].classList.active,true);
});
test('click, previous history entry and direct hash navigation stay synchronized',()=>{
 const a=fixture('#ips');
 a.syncTabFromLocation();
 a.buttons[1].onclick();
 assert.deepEqual(a.history.calls,['#paycheck']);
 assert.equal(a.buttons[1].attributes.get('aria-current'),'page');
 a.buttons[1].onclick();
 assert.equal(a.history.calls.length,1);
 a.loc.hash='#ips'; a.syncTabFromLocation();
 assert.equal(a.buttons[0].attributes.get('aria-current'),'page');
 a.loc.hash='#bear';a.syncTabFromLocation();
 assert.equal(a.panels[6].classList.active,true);
});
test('root restores known saved view and never modifies unrelated or financial data',()=>{
 const a=fixture('', 'meeting');a.syncTabFromLocation();
 assert.equal(a.buttons[3].attributes.get('aria-current'),'page');
 a.loc.hash='#unknown';a.syncTabFromLocation();
 assert.equal(a.buttons[3].attributes.get('aria-current'),'page');
 assert.equal(a.data.get('cc_ips_purpose'),JSON.stringify('keep'));
 assert.equal(a.data.get('unrelated'),'keep');
});
