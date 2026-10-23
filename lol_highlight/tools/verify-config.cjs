const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const config=fs.readFileSync(path.join(root,'measurement-config.js'),'utf8');
const analytics=fs.readFileSync(path.join(root,'analytics.js'),'utf8');
function check(protocol,hostname){
  const scripts=[];
  const state={URL,Set,Map,Date,console,setTimeout,clearTimeout,innerWidth:390,innerHeight:844,scrollY:0,
    location:{protocol,hostname,href:`${protocol}//${hostname}/index.html`},
    document:{body:{dataset:{pageType:'landing',pageId:'home'}},querySelectorAll:()=>[],addEventListener(){},createElement(){return {};},head:{appendChild(script){scripts.push(script);}}},
    addEventListener(){},requestAnimationFrame(){}};
  state.window=state;vm.createContext(state);vm.runInContext(config,state);vm.runInContext(analytics,state);
  assert.equal(state.HIGHLIGHT_MEASUREMENT.gtmContainerId,'GTM-52LH3239');
  assert.equal(state.HIGHLIGHT_MEASUREMENT.ga4MeasurementId,'G-1JYDDSLXG8');
  assert.equal(state.dataLayer[0].ga4_measurement_id,'G-1JYDDSLXG8');
  assert.equal(state.HIGHLIGHT_MEASUREMENT.debug,false);
  return scripts;
}
const production=check('https:','example.com');
assert.equal(production.length,1);
assert.equal(production[0].src,'https://www.googletagmanager.com/gtm.js?id=GTM-52LH3239');
assert.equal(check('http:','localhost').length,0);
assert.equal(check('file:','').length,0);
console.log('PASS: supplied GTM and GA4 IDs, dataLayer context, production loader URL, debug=false, local restrictions. VM test only; no network requests.');
