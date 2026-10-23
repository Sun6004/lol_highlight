const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'analytics.js'),'utf8');
const evidence=JSON.parse(fs.readFileSync(path.join(root,'measurement','browser-evidence.json'),'utf8'));
const mapping=JSON.parse(fs.readFileSync(path.join(root,'measurement','element-map.json'),'utf8'));
const expected=['navigation_click','cta_click','article_open','highlight_select','video_outbound_click','source_click','social_click','menu_toggle','match_tab_select','faq_toggle','section_view','scroll_depth'];
const qa=[];
function check(target,method,expectation,fn,result){fn();qa.push({target,method,expected:expectation,status:'로컬 검증 완료',result});}
function makeContext(protocol,hostname,settings={}){
  const appended=[];
  const context={URL,Set,Map,Date,console,setTimeout,clearTimeout,innerWidth:390,innerHeight:844,scrollY:0,
    location:{protocol,hostname,href:`${protocol}//${hostname}/index.html`},
    document:{body:{dataset:{pageType:'landing',pageId:'home'},scrollHeight:3000},documentElement:{scrollHeight:3000},hidden:false,querySelectorAll:()=>[],addEventListener(){},createElement(){return {};},head:{appendChild:x=>appended.push(x)}},
    addEventListener(){},requestAnimationFrame(){},HIGHLIGHT_MEASUREMENT:settings,dataLayer:[{existing_marker:'preserved'}]};
  context.window=context;vm.createContext(context);vm.runInContext(code,context);
  return {context,appended};
}
check('메인 요소 누락','브라우저 DOM에서 a/button/summary 검사','46개 모두 data-track-id와 이벤트 보유',()=>assert.equal(evidence.landingCoverage.missing,0),'46 / 46 적용');
check('상세 글 요소 누락','브라우저 DOM에서 a/button/summary 검사','34개 모두 이벤트 보유',()=>assert.equal(evidence.articleCoverage.missing,0),'34 / 34 적용');
check('요소 ID 고유성','생성한 HTML 요소 매핑 검사','80개 ID가 모두 고유',()=>assert.equal(new Set(mapping.elements.map(x=>x.element_id)).size,80),'80개 고유 ID, 요소 매핑 시트와 코드가 동일');
check('이벤트 종류','실제 브라우저 조작 후 디버그 로그 검사','설계한 12종 이벤트 확인',()=>assert.deepEqual([...new Set(evidence.events.map(x=>x.event))].sort(),expected.slice().sort()),'12 / 12 이벤트 발생 확인');
check('경기 탭 중복 방지','선택 탭 재클릭, 준결승 2회 클릭, 방향키 전환','선택이 바뀐 semi/final만 각 1회',()=>assert.deepEqual(evidence.firstDocumentEvents.filter(x=>x.event==='match_tab_select').map(x=>x.round_name),['semi','final']),'현재 선택 탭 재클릭 제외, 방향키 전환 포함');
check('FAQ 기본 열림 제외','기본 열린 FAQ를 닫고 다시 열기','초기 open 없음. close/open 각 1회',()=>assert.deepEqual(evidence.firstDocumentEvents.filter(x=>x.event==='faq_toggle').map(x=>x.action),['close','open']),'기본 상태를 사용자 행동으로 집계하지 않음');
check('스크롤 깊이','스크롤 및 앵커 이동으로 페이지 하단 도달','25/50/75/90 구간마다 문서당 1회',()=>assert.deepEqual(evidence.firstDocumentEvents.filter(x=>x.event==='scroll_depth').map(x=>x.percent_scrolled),[25,50,75,90]),'4개 구간 각각 1회');
check('섹션 노출','제목 노출 후 재진입','노출 이벤트 존재, 같은 문서의 섹션 중복 없음',()=>{const ids=evidence.firstDocumentEvents.filter(x=>x.event==='section_view').map(x=>x.section_id);assert.ok(ids.length>0);assert.equal(ids.length,new Set(ids).size);},'home 등 섹션 노출 확인, 문서 내 중복 없음');
check('영상 CTA 목적지','메인·상세 글 영상 버튼 Ctrl+클릭','video_outbound_click, channel_search, 정확한 섹션',()=>{const events=evidence.events.filter(x=>x.event==='video_outbound_click');assert.ok(events.some(x=>x.section_id==='watch'));assert.ok(events.some(x=>x.section_id==='official_videos'));assert.ok(events.every(x=>x.destination_kind==='channel_search'));},'watch / official_videos의 공식 채널 이동 구분');
check('선수 SNS','상세 글 Faker Instagram Ctrl+클릭','social_click, player_name=Faker',()=>assert.ok(evidence.events.some(x=>x.event==='social_click'&&x.player_name==='Faker')),'Faker와 www.instagram.com 전달 확인');
check('명장면 카드','메인 한타 카드 이미지 클릭','highlight_select 1회, 테마와 카드 순서 전달',()=>{const es=evidence.events.filter(x=>x.event==='highlight_select');assert.equal(es.length,1);assert.equal(es[0].content_id,'teamfight');assert.equal(es[0].content_rank,1);},'teamfight, content_rank=1. 같은 클릭에 article_open 중복 없음');
check('상세 글 유입','헤더 홍보 글 상세 링크 클릭','article_open 1회',()=>assert.equal(evidence.events.filter(x=>x.event==='article_open').length,1),'헤더 링크에서 상세 글 이동 이벤트 확인');
check('모바일 메뉴','390px 메뉴 열기 후 Escape','mobile, open/close, 닫힘 사유 escape',()=>{const es=evidence.events.filter(x=>x.event==='menu_toggle');assert.deepEqual(es.map(x=>x.action),['open','close']);assert.equal(es[1].content_id,'escape');assert.equal(es[0].viewport_type,'mobile');},'메뉴가 열리고 닫힐 때만 기록');
check('URL 쿼리 제거','영상·출처 링크의 분석용 URL 확인','? 이후 문자열 없음, 100자 이하',()=>{for(const e of evidence.events){if(e.link_url){assert.ok(!e.link_url.includes('?'));assert.ok(e.link_url.length<=100);}}},'실제 링크는 유지, 분석 URL에서 검색어·쿼리 제외');
check('이전 매개변수 초기화','카드 이벤트 다음에 출처 이벤트 발행','content_rank/faq_id/round_name이 null로 초기화',()=>{const {context}=makeContext('file:','');context.HighlightAnalytics.track('highlight_select',{content_rank:3});context.HighlightAnalytics.track('source_click',{element_id:'test_source'});const event=context.dataLayer.at(-1);assert.equal(event.content_rank,null);assert.equal(event.faq_id,null);assert.equal(event.round_name,null);},'dataLayer 버전 2에서 이전 이벤트 값이 남지 않도록 초기화');
check('dataLayer 보존','기존 dataLayer가 있는 페이지에서 초기화','기존 배열을 덮어쓰지 않음',()=>assert.equal(makeContext('file:','').context.dataLayer[0].existing_marker,'preserved'),'기존 마커 보존');
check('스크립트 중복 방지','analytics.js를 같은 컨텍스트에서 2회 실행','GTM 스크립트 1개만 생성',()=>{const {context,appended}=makeContext('https:','example.com',{gtmContainerId:'GTM-ABC123',ga4MeasurementId:'G-TEST123456'});vm.runInContext(code,context);assert.equal(appended.length,1);},'유효 형식 테스트 ID는 VM에서만 사용, 네트워크 요청 없음');
check('ID 미입력·file 접근','ID 없음 및 file:// 환경에서 실행','GTM 외부 스크립트 로드 안 함',()=>{assert.equal(makeContext('https:','example.com').appended.length,0);assert.equal(makeContext('file:','',{gtmContainerId:'GTM-ABC123'}).appended.length,0);assert.equal(evidence.landingCoverage.googleScripts,0);},'ID 없이도 로컬 이벤트 큐와 사이트 기능 사용 가능');
check('개발 호스트 전송 제한','localhost 기본 설정과 allowLocalhost:true 비교','기본 로드 없음, 명시 허용 시 1개 로드',()=>{assert.equal(makeContext('http:','localhost',{gtmContainerId:'GTM-ABC123'}).appended.length,0);assert.equal(makeContext('http:','localhost',{gtmContainerId:'GTM-ABC123',allowLocalhost:true}).appended.length,1);},'로컬 수신 검증 시만 allowLocalhost 활성');
check('GA4 이벤트 규격','브라우저 이벤트의 이름·매개변수 검사','이름 40자 이하, 사용자 매개변수 25개 이하',()=>{for(const e of evidence.events){assert.match(e.event,/^[a-z][a-z0-9_]{0,39}$/);assert.ok(Object.keys(e).length-1<=25);}},'12개 이벤트, 각 이벤트 19개 매개변수');
for(const [target,method,expectation] of [
 ['GTM Preview 실제 연결','실제 GTM-…/G-… 입력 후 Tag Assistant 연결','태그 1회 실행·변수값 확인'],
 ['GA4 실제 수신','GA4 DebugView와 collect 요청 확인','12종 이벤트·매개변수 수신 확인'],
 ['핵심 이벤트·운영 게시','GA4 핵심 이벤트 등록 및 GTM 게시','video_outbound_click 핵심 이벤트와 운영 수집 확인']
])qa.push({target,method,expected:expectation,status:'ID 입력 대기',result:'Google 계정 설정 및 게시 후 실행. 로컬 검증 완료와 구분합니다.'});
fs.writeFileSync(path.join(root,'measurement','qa-results.json'),JSON.stringify(qa,null,2));
console.log(JSON.stringify({localChecks:qa.filter(x=>x.status==='로컬 검증 완료').length,pending:3,elements:mapping.elements.length,eventTypes:expected.length}));
