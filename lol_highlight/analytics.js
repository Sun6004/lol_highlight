'use strict';
(() => {
  if (window.HighlightAnalytics) return;
  const settings = window.HIGHLIGHT_MEASUREMENT || {};
  const layer = window.dataLayer = window.dataLayer || [];
  const names = new Set(['navigation_click','cta_click','article_open','highlight_select','video_outbound_click','source_click','social_click','menu_toggle','match_tab_select','faq_toggle','section_view','scroll_depth']);
  const optionalKeys = ['section_id','element_id','element_text','link_url','link_domain','destination_kind','content_id','content_rank','sport_name','player_name','action','round_name','faq_id','percent_scrolled'];
  const pageType = document.body.dataset.pageType || 'landing';
  const pageId = document.body.dataset.pageId || 'home';
  function cleanUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, location.href);
      if (!['http:','https:','file:'].includes(url.protocol)) return '';
      const safe = url.protocol === 'file:' ? url.pathname.split('/').pop() + url.hash : url.origin + url.pathname + url.hash;
      return safe.slice(0,100);
    } catch { return ''; }
  }
  function track(eventName, parameters = {}, callback) {
    if (!names.has(eventName)) return;
    const payload = {event:eventName,schema_version:'1.0',page_type:pageType,page_id:pageId,viewport_type:window.innerWidth<=640?'mobile':window.innerWidth<=1024?'tablet':'desktop',debug_mode:Boolean(settings.debug)};
    // 이전 이벤트의 매개변수가 다음 이벤트에 남지 않도록 매번 비웁니다.
    optionalKeys.forEach(key => { payload[key] = parameters[key] ?? null; });
    if (callback) { payload.eventCallback = callback; payload.eventTimeout = 180; }
    layer.push(payload);
    if (settings.debug) console.info('[HIGHLIGHT measurement]', JSON.stringify(payload));
    return payload;
  }
  function elementParameters(element, extra = {}) {
    const link = element.matches('a[href]') ? element : null;
    let domain = '';
    if (link) { try { domain = new URL(link.href,location.href).hostname; } catch { /* no destination */ } }
    return {
      section_id:element.dataset.trackSection || element.closest('[data-section-id]')?.dataset.sectionId || 'global',
      element_id:element.dataset.trackId || element.id || '',
      element_text:(element.dataset.trackLabel || element.getAttribute('aria-label') || element.textContent).replace(/\s+/g,' ').trim().slice(0,80),
      link_url:cleanUrl(link?.getAttribute('href')),link_domain:domain,
      destination_kind:element.dataset.destinationKind || '',content_id:element.dataset.contentId || '',
      content_rank:element.dataset.contentRank ? Number(element.dataset.contentRank) : null,
      sport_name:element.dataset.sportName || 'lol',player_name:element.dataset.playerName || '',...extra
    };
  }
  const api = {track,trackElement(element,extra={}){return track(element.dataset.trackEvent,elementParameters(element,extra));}};
  window.HighlightAnalytics = Object.freeze(api);
  layer.push({page_type:pageType,page_id:pageId,schema_version:'1.0',ga4_measurement_id:settings.ga4MeasurementId || '',debug_mode:Boolean(settings.debug)});
  if(settings.debug) console.info('[HIGHLIGHT measurement ready]',JSON.stringify({page_type:pageType,page_id:pageId,tracked_controls:document.querySelectorAll('[data-track-event]').length}));
  const containerId = settings.gtmContainerId || '';
  const localHost = ['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
  // Google 태그는 GTM에서 한 번만 설정하며 gtag.js를 중복 설치하지 않습니다.
  if (/^GTM-[A-Z0-9]+$/.test(containerId) && /^https?:$/.test(location.protocol) && (!localHost || settings.allowLocalhost)) {
    layer.push({'gtm.start':Date.now(),event:'gtm.js'});
    const script = document.createElement('script');
    script.async = true; script.id = 'highlight-gtm';
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
    document.head.appendChild(script);
  }
  function handleClick(event) {
    if (event.type==='auxclick' && event.button!==1 || event.type==='click' && event.button!==0) return;
    const element = event.target.closest?.('a[data-track-event]');
    if (!element) return;
    const payload = elementParameters(element,{action:event.type==='auxclick'?'middle_click':'click'});
    const url = new URL(element.href,location.href);
    const leavesPage = url.origin!==location.origin || url.pathname!==location.pathname;
    const sameTab = (!element.target || element.target==='_self') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.type==='click';
    if (window.google_tag_manager?.[containerId] && leavesPage && sameTab && !event.defaultPrevented && !element.hasAttribute('download')) {
      event.preventDefault();
      let navigated = false;
      const go=()=>{if(navigated)return;navigated=true;location.assign(element.href);};
      track(element.dataset.trackEvent,payload,go);
      setTimeout(go,220);
    } else track(element.dataset.trackEvent,payload);
  }
  document.addEventListener('click',handleClick);
  document.addEventListener('auxclick',handleClick);
  document.querySelectorAll('details[data-faq-id]').forEach(details=>{
    let previous=details.open;
    details.addEventListener('toggle',()=>{
      if(previous===details.open)return;
      previous=details.open;
      api.trackElement(details.querySelector('summary'),{action:details.open?'open':'close',faq_id:details.dataset.faqId});
    });
  });
  // 섹션의 첫 제목이 50% 이상 1초 동안 보이면 문서 로드당 한 번 기록합니다.
  if ('IntersectionObserver' in window) {
    const seen=new Set(),waiting=new Map(),headings=new Map();
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const section=headings.get(entry.target);
        if(!section)return;
        const key=section.dataset.sectionId;
        if(!entry.isIntersecting || entry.intersectionRatio<0.5 || document.hidden){clearTimeout(waiting.get(key));waiting.delete(key);return;}
        if(seen.has(key)||waiting.has(key))return;
        waiting.set(key,setTimeout(()=>{
          waiting.delete(key);if(document.hidden)return;
          seen.add(key);track('section_view',{section_id:key,action:'view',sport_name:'lol'});observer.unobserve(entry.target);
        },1000));
      });
    },{threshold:[0,0.5]});
    document.querySelectorAll('[data-section-id]').forEach(section=>{const heading=section.querySelector('h1,h2,h3')||section;headings.set(heading,section);observer.observe(heading);});
    document.addEventListener('visibilitychange',()=>{
      waiting.forEach(timer=>clearTimeout(timer));waiting.clear();
      if(!document.hidden){observer.disconnect();headings.forEach((section,heading)=>{if(!seen.has(section.dataset.sectionId))observer.observe(heading);});}
    });
  }
  const reached=new Set();let scheduled=false;
  function measureDepth(){
    scheduled=false;if(scrollY<=0||document.hidden)return;
    const height=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
    const depth=Math.min(100,Math.floor((scrollY+innerHeight)/height*100));
    [25,50,75,90].forEach(percent=>{if(depth<percent||reached.has(percent))return;reached.add(percent);track('scroll_depth',{percent_scrolled:percent,action:'scroll'});});
  }
  function scheduleDepth(){if(scheduled)return;scheduled=true;requestAnimationFrame(measureDepth);}
  addEventListener('scroll',scheduleDepth,{passive:true});addEventListener('resize',scheduleDepth,{passive:true});
})();
