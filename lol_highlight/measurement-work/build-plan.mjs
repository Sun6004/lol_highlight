import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool';

const root=path.resolve(import.meta.dirname,'..');
const out=path.resolve(root,'..','outputs','01a162a0-7fc8-7983-91d8-7d6dfc804b22');
await fs.mkdir(out,{recursive:true});
const configuredText=await fs.readFile(path.join(root,'measurement-config.js'),'utf8');
const configuredIds={gtm:configuredText.match(/gtmContainerId:\s*'([^']*)'/)?.[1]||'',ga4:configuredText.match(/ga4MeasurementId:\s*'([^']*)'/)?.[1]||''};
if(process.argv.includes('--inspect-existing') || process.argv.includes('--apply-ids')){
 const workbookPath=path.join(out,'GTM_GA4_측정설계도.xlsx');
 const existing=await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
 const summary=existing.worksheets.getItem('측정 요약');
 const checks=existing.worksheets.getItem('검증 체크리스트');
 const editing=process.argv.includes('--apply-ids');
 if(editing){
   summary.getRange('B9:C12').values=[
     ['ID 반영 완료 · GTM 설정 확인 필요','사이트 설정에 두 ID 반영. GTM 관리자 로그인 및 태그 설정·게시, GA4 수신 검증 필요'],
     [configuredIds.gtm,'사용자 제공 (2026.10.23). measurement-config.js와 동일'],
     [configuredIds.ga4,'사용자 제공 (2026.10.23). measurement-config.js와 동일'],
     ['measurement-config.js에 두 ID 반영 완료','로컬 GTM 미리보기 때만 allowLocalhost:true 및 debug:true. 운영 전 debug:false']
   ];
   checks.getRange('E27:F29').values=[
     ['계정 접근 필요','두 ID 반영 완료. GTM 관리자에 Google 로그인이 필요해 Preview·태그 설정 여부는 미확인'],
     ['수신 검증 대기','GTM 설정·게시 후 GA4 DebugView와 collect 요청으로 확인 필요'],
     ['설정·게시 대기','GTM 컨테이너 태그 게시 및 GA4 핵심 이벤트 지정 필요']
   ];
   existing.recalculate();
 }
 for(const [name,range] of [['측정 요약','A6:C12'],['검증 체크리스트','A27:F29']]){
   const preview=await existing.render({sheetName:name,range,scale:1.25,format:'png'});
   await fs.writeFile(path.join(out,`${editing?'updated':'before'}-${name}.png`),new Uint8Array(await preview.arrayBuffer()));
 }
 console.log((await existing.inspect({kind:'table',range:'측정 요약!A9:C12',include:'values',tableMaxRows:4,tableMaxCols:3,maxChars:1400})).ndjson);
 if(editing){const output=await SpreadsheetFile.exportXlsx(existing);await output.save(workbookPath);console.log(workbookPath);}
 process.exit(0);
}
const map=JSON.parse(await fs.readFile(path.join(root,'measurement','element-map.json'),'utf8'));
const qa=JSON.parse(await fs.readFile(path.join(root,'measurement','qa-results.json'),'utf8'));
const names=['navigation_click','cta_click','article_open','highlight_select','video_outbound_click','source_click','social_click','menu_toggle','match_tab_select','faq_toggle','section_view','scroll_depth'];
const regex='^((navigation|cta|source|social|video_outbound)_click|(highlight|match_tab)_select|(menu|faq)_toggle|article_open|section_view|scroll_depth)$';
if(!names.every(name=>new RegExp(regex).test(name))) throw new Error('GTM trigger allowlist mismatch');
const params=[
 ['schema_version','문자','1.0','공통','아니오','수집 스키마 버전'],
 ['page_type','문자','landing / article','공통','예','페이지 유형'],
 ['page_id','문자','home / lol_highlights','공통','예','페이지 식별자'],
 ['viewport_type','문자','mobile / tablet / desktop','공통','예','640px 이하 / 641~1024px / 1025px 이상. 기기 종류가 아닌 화면 폭'],
 ['debug_mode','불리언',false,'공통','아니오','measurement-config.js의 debug 값을 전달'],
 ['section_id','문자','watch / highlights / official_videos','대부분','예','이벤트가 발생한 섹션'],
 ['element_id','문자','landing_watch_video_01','클릭·UI','예','HTML data-track-id와 일치하는 고정 ID'],
 ['element_text','문자','한국 대표팀 명장면 보러 가기','클릭·UI','선택','작성된 UI 문구, 최대 80자. 사용자 입력 수집 안 함'],
 ['link_url','문자','https://www.youtube.com/@lolesports/search','링크','아니오','쿼리 제거 후 최대 100자. 전체 목적지는 요소 매핑 참고'],
 ['link_domain','문자','www.youtube.com','링크','예','이동 대상 도메인'],
 ['destination_kind','문자','channel_search / streaming_home / article / anchor','클릭·UI','예','공식 영상 검색과 스트리밍 홈 이동을 구분'],
 ['content_id','문자','teamfight / objective / clutch','일부','예','명장면 테마. 메뉴 이벤트는 닫힘 사유(button/escape/navigation/outside_click/resize)'],
 ['content_rank','정수',1,'highlight_select','선택','화면 카드 순서 1~3, 실제 경기 순위가 아님'],
 ['sport_name','문자','lol / efootball / gran_turismo_7','대부분','예','해당 콘텐츠 종목. 스크롤 이벤트에서는 null'],
 ['player_name','문자','Faker','social_click','선택','선수 SNS 링크에만 지정'],
 ['action','문자','click / middle_click / open / close / select / view / scroll','대부분','예','동작 구분'],
 ['round_name','문자','final / semi','match_tab_select','예','변경한 경기 라운드'],
 ['faq_id','문자','landing_guide_question_01','faq_toggle','예','질문 식별자'],
 ['percent_scrolled','정수','25 / 50 / 75 / 90','scroll_depth','선택','페이지 높이 대비 화면 하단 도달 구간. GA4 기본 스크롤 비율 측정기준을 먼저 확인']
];
const events=[
 ['navigation_click','메뉴·목차·로고·본문 앵커·맨 위로','링크 클릭 1회','element_id, section_id, link_url, action','아니오','페이지 내부 탐색. 링크 기능은 유지'],
 ['cta_click','메인 첫 화면의 레전드 플레이 버튼','클릭 1회','element_id, section_id, destination_kind','아니오','하이라이트 섹션으로 이동한 관심 행동'],
 ['article_open','메인에서 상세 글로 가는 일반 링크','클릭 1회','element_id, section_id, link_url','아니오','실제 상세 글 도착은 article page_view로 별도 확인'],
 ['highlight_select','메인 명장면 카드 이미지·텍스트 링크','링크 클릭 1회','content_id, content_rank, element_id','아니오','동일 클릭을 article_open으로 중복 발행하지 않음'],
 ['video_outbound_click','공식 영상 채널 검색·공식 스트리밍 홈','링크 클릭 1회','element_id, section_id, sport_name, destination_kind, link_domain','예','핵심 성과: 외부 영상 경로로 이동. 실제 재생·시청 완료 아님'],
 ['source_click','공식 결과·대진·참가·중계 출처','링크 클릭 1회','element_id, section_id, link_domain','아니오','정보 신뢰도 확인 행동'],
 ['social_click','Faker Instagram','링크 클릭 1회','player_name, element_id, link_domain','아니오','선수에 대한 관심'],
 ['menu_toggle','모바일·태블릿 접이식 메뉴','상태가 바뀔 때','action, content_id, element_id','아니오','열기와 닫기. 이미 닫힌 메뉴의 close는 기록 안 함'],
 ['match_tab_select','결승·준결승 탭','선택 값이 바뀔 때','round_name, action, element_id','아니오','현재 선택 탭 재클릭은 기록 안 함. 방향키 전환 포함'],
 ['faq_toggle','FAQ 4개 질문','실제 열림 상태가 바뀔 때','faq_id, action, element_id','아니오','처음부터 열린 FAQ를 로드시 open으로 기록하지 않음'],
 ['section_view','각 섹션의 첫 제목','제목 50% 이상 1초 노출','section_id, action','아니오','제목이 없는 섹션은 섹션 자체 기준. 문서 로드당 섹션별 1회'],
 ['scroll_depth','페이지 읽기 깊이','스크롤 후 25/50/75/90% 도달','percent_scrolled, action','아니오','문서 로드당 각 구간 1회. 구간 건너뛰면 도달한 하위 구간도 기록']
];
const wb=Workbook.create();
let sheetCount=0;
const palette={ink:'#102B3A',cyan:'#54D9FF',light:'#EDFaff',muted:'#526979',line:'#D9E9F1'};
function col(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function sheet(name,title,note,headers,rows,widths){
 const s=wb.worksheets.add(name);s.showGridLines=false;
 const end=col(headers.length-1),last=6+rows.length;
 const range=s.getRange(`A1:${end}${last}`);
 range.format.font={name:'Arial',size:10,color:palette.ink};
 range.format.verticalAlignment='center';range.format.wrapText=true;
 s.getRange('A2').values=[[title]];s.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:palette.ink};s.getRange('A2').format.wrapText=false;
 s.getRange('A3').values=[[note]];s.getRange('A3').format.font={name:'Arial',size:10,color:palette.muted};s.getRange('A3').format.wrapText=false;
 s.getRange(`A4:${end}4`).format.borders={bottom:{style:'thin',color:palette.cyan}};
 s.getRange(`A6:${end}${last}`).values=[headers,...rows];
 s.getRange(`A6:${end}6`).format={fill:palette.ink,font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:34,wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
 s.getRange(`A7:${end}${last}`).format.rowHeight=64;
 widths.forEach((w,i)=>s.getRange(`${col(i)}1:${col(i)}${last}`).format.columnWidth=w);
 for(let r=7;r<=last;r++){if(r%2===1)s.getRange(`A${r}:${end}${r}`).format.fill='#F3FAFD';}
 s.freezePanes.freezeRows(6);s.freezePanes.freezeColumns(1);
 const t=s.tables.add(`A6:${end}${last}`,true,`Plan${++sheetCount}`);t.showFilterButton=true;
 s.tabColor=palette.cyan;
 return s;
}

const summaryRows=[
 ['적용 대상','index.html / lol-highlights.html','2개 페이지의 링크·메뉴·탭·FAQ 80개 요소, 섹션 노출, 스크롤 깊이'],
 ['작성일','2026.10.23','스키마 1.0. 수치 실적이 아닌 구현·운영 설계 문서'],
 ['현재 수집 상태',configuredIds.gtm&&configuredIds.ga4?'ID 반영 완료 · GTM 설정 확인 필요':'GTM·GA4 ID 입력 대기','dataLayer 코드는 적용됨. GTM 태그 설정·게시·GA4 DebugView 검증은 미완료'],
 ['GTM 컨테이너 ID',configuredIds.gtm,'사이트 measurement-config.js의 gtmContainerId와 동일'],
 ['GA4 측정 ID',configuredIds.ga4,'사이트 measurement-config.js의 ga4MeasurementId와 동일'],
 ['1. 연결','measurement-config.js에 위 두 ID 입력','로컬 GTM 미리보기 때만 allowLocalhost:true 및 debug:true. 운영 전 debug:false'],
 ['2. 태그 설정','GTM 설정 시트의 변수·태그·트리거 생성','Google 태그는 Initialization - All Pages에 1개. 맞춤 이벤트용 GA4 이벤트 태그 1개'],
 ['3. 핵심 이벤트','video_outbound_click','GA4에서 핵심 이벤트로 등록. 권장 집계: 세션당 한 번'],
 ['4. 중복 방지','자동 page_view 1회만 사용','향상된 측정의 이탈 클릭·스크롤은 끄거나, 별도 유지 시 click/scroll을 KPI에 합산하지 않음'],
 ['5. 테스트 후 게시','GTM Preview > GA4 DebugView > GTM 게시','로컬 dataLayer 검증과 실제 GA4 수신은 서로 다른 단계'],
 ['성과 정의','외부 영상 채널 이동','검색 링크 클릭은 재생·완주율로 해석하지 않음'],
 ['핵심 지표','공식 영상 이동 세션 비율','분자: video_outbound_click이 발생한 세션. 분모: 동일 기간·필터의 전체 세션. GA4 세션 핵심 이벤트 발생률 사용'],
 ['탐색 지표','상세 글 유입','article_open 또는 highlight_select 클릭과, page_id=lol_highlights인 page_view 도착을 퍼널로 비교'],
 ['배치 비교','하단 CTA 클릭 사용자 비율','분자: section_id=watch에서 video_outbound_click한 사용자. 분모: watch section_view 사용자. 동일 기간·사용자 기준'],
 ['콘텐츠 비교','명장면 테마별 관심','highlight_select를 content_id·content_rank별 비교. 이미지 링크와 텍스트 링크는 element_id로 구분'],
 ['채널 비교','유입 출처별 공식 영상 이동','GA4 세션 소스/매체·캠페인으로 비교. UTM은 홍보 링크에 부여하고 계정 기본 수집으로 분석'],
 ['영상 한계','외부 YouTube 재생·완료는 측정 불가','실제 재생 측정은 JS API를 켠 임베드 플레이어 등 별도 구현 필요']
];
const summary=sheet('측정 요약','HIGHLIGHT GTM · GA4 측정 설계','배포 연결에 필요한 설정과 성과 해석 기준',['항목','설정·지표','실행 방법·정의'],summaryRows,[24,46,100]);
summary.getRange('B10:B11').format.fill='#FFF1C7';summary.getRange('B10:B11').format.font={name:'Arial',size:10,color:'#006982'};
summary.getRange('A2').format.font={name:'Arial',size:15,bold:true,color:palette.ink};

const evRows=events.map(e=>[e[0],e[1],e[2],e[3],e[4],e[5]]);
const ev=sheet('이벤트 설계','GA4 이벤트 명세','모든 맞춤 이벤트에 공통 컨텍스트를 함께 전송합니다. GA4 이벤트 태그는 아래 12개만 허용합니다.',['이벤트 이름','요소·행동','발생 조건','주요 매개변수','핵심 이벤트','중복·해석 기준'],evRows,[29,40,34,62,15,76]);
ev.getRange('A7:A18').format.font={name:'Arial',size:10,bold:true,color:'#006982'};

const mappingRows=map.elements.map((e,i)=>[i+1,e.page,e.section_id,e.element_id,e.label,e.event,e.destination_kind,e.content_id||e.faq_id||'',e.sport_name,e.destination||'UI 상태 변경',e.selector]);
const mapping=sheet('요소 매핑','페이지 요소별 이벤트 매핑','코드의 data-track-id와 동일합니다. 같은 카드의 이미지·문구 링크도 각각 식별합니다.',['번호','페이지','섹션','요소 ID','화면 문구','이벤트 이름','목적지 유형','콘텐츠·질문 ID','종목','실제 목적지','GTM·QA 선택자'],mappingRows,[8,23,24,49,50,29,24,34,22,78,65]);
mapping.getRange(`A7:A${6+mappingRows.length}`).format.numberFormat='0';mapping.getRange(`A7:K${6+mappingRows.length}`).format.rowHeight=88;

const setupRows=[
 ['Google 태그','Google tag - GA4','태그 ID + 공유 이벤트 설정','{{DLV - ga4_measurement_id}} / {{ES - HIGHLIGHT context}}','Initialization - All Pages','기본 page_view 활성. Google 태그의 Shared event settings에 컨텍스트 변수 연결. 다른 GA4 설치와 중복 금지'],
 ['공유 이벤트 설정','ES - HIGHLIGHT context','Google tag: Event settings','page_type={{DLV - page_type}}, page_id={{DLV - page_id}}, schema_version={{DLV - schema_version}}, debug_mode={{DLV - debug_mode}}','Google 태그의 Shared event settings','자동 page_view에도 page_type·page_id를 붙여 상세 글 실제 도착을 구분. 아래 4개의 DLV를 먼저 생성'],
 ['맞춤 이벤트 트리거','CE - HIGHLIGHT events','맞춤 이벤트 / 정규식 일치',regex,'Some Custom Events가 아닌 명시 이벤트 정규식','구체적 허용 목록만 사용. .* 또는 모든 gtm.* 이벤트 전송 금지'],
 ['GA4 이벤트 태그','GA4 - HIGHLIGHT events','측정 ID + 이벤트 이름','{{DLV - ga4_measurement_id}} / {{Event}}','CE - HIGHLIGHT events','아래 DLV 매개변수 19개를 동일 이름으로 매핑. Google 태그가 먼저 실행되도록 설정'],
 ['초기 컨텍스트','페이지 진입','dataLayer 컨텍스트','page_type, page_id, ga4_measurement_id','analytics.js 초기화','event 키 없는 초기 설정 객체. GA4 맞춤 이벤트로 전송하지 않음'],
 ['측정 ID 변수','DLV - ga4_measurement_id','데이터 영역 변수 / 버전 2','ga4_measurement_id','Google 태그·GA4 이벤트 태그에서 사용','measurement-config.js에 입력한 G-…를 읽음'],
 ['기본 변수','Event','GTM 기본 제공 변수','Event','GA4 이벤트 이름에 사용','이벤트 이름이 dataLayer event와 동일해야 함'],
 ...params.map(p=>['이벤트 매개변수',`DLV - ${p[0]}`,'데이터 영역 변수 / 버전 2',p[0],'GA4 이벤트 매개변수: '+p[0],`${p[1]} / ${p[3]} / ${p[5]}`]),
 ['GA4 맞춤 정의','이벤트 범위 맞춤 측정기준','등록 권장',params.filter(p=>p[4]==='예').map(p=>p[0]).join(', '),'관리 > 데이터 표시 > 맞춤 정의','목록의 각 매개변수를 별도 이벤트 범위 측정기준으로 생성. 등록 후 데이터에 적용'],
 ['GA4 선택 정의','필요한 경우에만 등록','element_text / content_rank / player_name','필요 시 이벤트 범위로 추가','동일 설정','debug_mode·schema_version·URL은 일반 분석용 차원 등록 불필요. viewport_type은 GA4 기본 기기 카테고리와 다름'],
 ['GA4 핵심 이벤트','video_outbound_click','관리 > 이벤트 / 핵심 이벤트','세션당 한 번 집계 권장','이벤트 생성/등록 후 지정','이벤트 클릭 횟수와 핵심 이벤트 세션 수를 구분'],
 ['향상된 측정','중복 계수 방지','이탈 클릭·스크롤 해제 권장','page_view는 Google 태그 기본 수집 유지','관리 > 데이터 스트림 > 향상된 측정','기존 자동 click/scroll을 유지하더라도 맞춤 이벤트와 합산하지 않음'],
 ['검증','GTM Preview와 GA4 DebugView','운영 ID와 테스트 URL 연결','debug:true, allowLocalhost:true (로컬 QA만)','네트워크 collect 요청도 확인','검증 후 debug:false. 로컬 실제 수신 검증은 IDs 입력 후 실행'],
 ['배포','HTTPS 호스팅 URL','현재 로컬 HTML도 dataLayer 검증 가능','운영 사이트에서 GTM 로드·게시','GTM Submit > Publish','file://는 Google 전송을 시작하지 않음. GTM 연결 후에도 게시 전에는 운영 반영 안 됨'],
 ['공식 문서','dataLayer','Google for Developers','https://developers.google.com/tag-platform/tag-manager/datalayer','확인일 2026.10.23','event 키·데이터 영역 변수·페이지별 초기 컨텍스트'],
 ['공식 문서','향상된 측정','Google Analytics 도움말','https://support.google.com/analytics/answer/9216061?hl=ko','확인일 2026.10.23','외부 클릭·스크롤·임베드 영상 이벤트의 범위'],
 ['공식 문서','맞춤 정의','Google Analytics 도움말','https://support.google.com/analytics/answer/14240153?hl=ko','확인일 2026.10.23','이벤트 매개변수의 맞춤 측정기준 등록'],
 ['공식 문서','측정 ID 찾기','Google Analytics 도움말','https://support.google.com/analytics/answer/9539598?hl=ko','확인일 2026.10.23','관리 > 데이터 스트림 > 웹 > 측정 ID'],
 ['공식 문서','컨테이너 ID 찾기','Tag Manager 도움말','https://support.google.com/tagmanager/answer/14847097?hl=ko','확인일 2026.10.23','작업공간에서 GTM 컨테이너 ID 확인'],
 ['공식 문서','공유 이벤트 설정','Google Analytics 도움말','https://support.google.com/analytics/answer/13438771?hl=en','확인일 2026.10.23','Google tag Event settings 변수의 재사용'],
 ['공식 문서','핵심 이벤트 집계','Google Analytics 도움말','https://support.google.com/analytics/answer/13366706?hl=en','확인일 2026.10.23','이벤트당 / 세션당 한 번 집계의 차이']
];
const setup=sheet('GTM 설정','GTM 태그·트리거·변수 설정','이벤트 이름과 매개변수는 코드와 동일하게 입력합니다. 실시간 연결은 계정 설정과 게시 후 검증합니다.',['구분','GTM 이름·GA4 항목','유형·설정','입력값·변수 키','실행 조건·위치','설정 설명'],setupRows,[23,38,42,100,52,90]);
setup.getRange(`A7:F${6+setupRows.length}`).format.rowHeight=90;

const tests=sheet('검증 체크리스트','측정 QA 체크리스트','로컬 dataLayer 검증 결과와 실제 GA4 수신 검증을 구분합니다.',['테스트 ID','검증 대상','실행 방법','기대 결과','검증 상태','결과·남은 작업'],qa.map((r,i)=>[i+1,r.target,r.method,r.expected,r.status,r.result]),[12,35,68,75,23,95]);
tests.getRange(`A7:F${6+qa.length}`).format.rowHeight=80;
const statusRange=tests.getRange(`E7:E${6+qa.length}`);
statusRange.conditionalFormats.add('containsText',{text:'입력 대기',format:{fill:'#FFF1C7',font:{color:'#7A4D00'}}});
statusRange.conditionalFormats.add('containsText',{text:'실패',format:{fill:'#FDE9E7',font:{color:'#9D2525',bold:true}}});

wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'이벤트 설계!A6:F10',include:'values',tableMaxRows:5,tableMaxCols:6,maxChars:1600})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!',options:{useRegex:true,maxResults:20},summary:'formula error scan',maxChars:500})).ndjson);
for(const s of (process.argv.includes('--setup-only') ? [setup] : [summary,ev,mapping,setup,tests])){
 const end=s===summary?'C':s===mapping?'F':'F';
 const image=await wb.render({sheetName:s.name,range:`A1:${end}10`,scale:1.25,format:'png'});
 await fs.writeFile(path.join(out,`preview-${s.name}.png`),new Uint8Array(await image.arrayBuffer()));
}
const file=await SpreadsheetFile.exportXlsx(wb);
const finalPath=path.join(out,'GTM_GA4_측정설계도.xlsx');await file.save(finalPath);
console.log(JSON.stringify({output:finalPath,elements:map.elements.length,sections:map.sections.length,events:names.length,sheets:5,qa:qa.length}));
