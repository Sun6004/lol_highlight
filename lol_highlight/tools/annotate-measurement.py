"""원문을 보존하며 측정 속성과 엑셀용 요소 목록을 생성합니다."""
from html.parser import HTMLParser
from html import escape
from pathlib import Path
import json, re
ROOT=Path(__file__).resolve().parents[1]
ELEMENTS=[]
SECTIONS=[]

class Instrument(HTMLParser):
    def __init__(self,source,filename,page_type):
        super().__init__(convert_charrefs=True)
        self.source,self.filename,self.page_type=source,filename,page_type
        self.prefix='landing' if page_type=='landing' else 'article'
        self.stack,self.edits,self.active=[],[],[]
        self.counts={};self.offsets=[0]
        for line in source.splitlines(keepends=True):self.offsets.append(self.offsets[-1]+len(line))
    def next_id(self,section,category):
        key=f'{self.prefix}_{section}_{category}'
        self.counts[key]=self.counts.get(key,0)+1
        return f'{key}_{self.counts[key]:02d}'
    def handle_starttag(self,tag,attributes):
        attrs=dict(attributes)
        parent=next((x['section'] for x in reversed(self.stack) if x.get('section')),'global')
        section=attrs.get('id','') if tag=='section' else parent
        if tag in ['header','footer']:section=tag
        for cls,key in [('article-banner','article_intro'),('article-toc','article_toc'),('breadcrumb','breadcrumb')]:
            if cls in attrs.get('class','').split():section=key
        if attrs.get('id')=='main-nav':section='header_nav'
        section=(section or parent).replace('-','_');addition={};record=None
        if tag=='body':addition={'data-page-type':self.page_type,'data-page-id':'home' if self.page_type=='landing' else 'lol_highlights'}
        if tag=='section' and attrs.get('id'):
            addition['data-section-id']=section;SECTIONS.append({'page':self.filename,'page_type':self.page_type,'section_id':section})
        is_tab=tag=='button' and attrs.get('role')=='tab'
        is_menu=tag=='button' and 'menu-toggle' in attrs.get('class','')
        if tag=='a' or is_tab or is_menu or tag=='summary':
            href=attrs.get('href','');cls=attrs.get('class','')
            content=rank=player='';sport='lol';kind='anchor';category='navigation';event='navigation_click'
            if tag=='a':
                if 'youtube.com/' in href or 'asiangamestv.com' in href:
                    event,category='video_outbound_click','video';kind='channel_search' if '/search?' in href else 'streaming_home'
                    if 'eFootball' in href:sport='efootball'
                    if 'Gran%20Turismo' in href:sport='gran_turismo_7'
                elif 'instagram.com/' in href:event,category,kind,player='social_click','social','player_social','Faker'
                elif href.startswith('https://'):event,category,kind='source_click','source','official_source'
                elif self.page_type=='landing' and 'lol-highlights.html' in href:
                    event,category,kind='article_open','article','article'
                    if any('highlight-card' in x['attrs'].get('class','') for x in self.stack):
                        event,category='highlight_select','highlight';content=href.split('#')[-1];rank={'teamfight':'1','objective':'2','clutch':'3'}.get(content,'')
                elif 'button' in cls and section=='home':event,category,kind='cta_click','cta','section_anchor'
                else:kind='anchor' if href.startswith('#') else 'internal_page'
            elif is_tab:event,category,kind='match_tab_select','tab','ui_control'
            elif is_menu:event,category,kind='menu_toggle','menu','ui_control'
            else:event,category,kind='faq_toggle','faq','ui_control'
            element_id=self.next_id(section,category)
            addition.update({'data-track-id':element_id,'data-track-event':event,'data-track-section':section,'data-destination-kind':kind,'data-sport-name':sport})
            if content:addition['data-content-id']=content
            if rank:addition['data-content-rank']=rank
            if player:addition['data-player-name']=player
            record={'page':self.filename,'page_type':self.page_type,'section_id':section,'element_id':element_id,'event':event,'selector':f'[data-track-id="{element_id}"]','tag':tag,'destination':href,'destination_kind':kind,'content_id':content,'content_rank':int(rank) if rank else None,'sport_name':sport,'player_name':player,'label':''}
            if tag=='summary':record['faq_id']=next((x['addition'].get('data-faq-id','') for x in reversed(self.stack) if x['tag']=='details'),'')
            self.active.append(record);ELEMENTS.append(record)
        if tag=='details':addition['data-faq-id']=self.next_id(section,'question')
        line,column=self.getpos();node={'tag':tag,'attrs':attrs,'section':section,'addition':addition,'start':self.offsets[line-1]+column,'raw':self.get_starttag_text(),'record':record}
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:self.stack.append(node)
        else:self.finish(node)
    def handle_data(self,data):
        for record in self.active:record['label']+=data
    def handle_endtag(self,tag):
        index=next((i for i in range(len(self.stack)-1,-1,-1) if self.stack[i]['tag']==tag),None)
        if index is None:return
        for node in reversed(self.stack[index:]):self.finish(node)
        del self.stack[index:]
    def finish(self,node):
        record=node['record']
        if record:
            if record in self.active:self.active.remove(record)
            record['label']=node['attrs'].get('aria-label') or re.sub(r'\s+',' ',record['label']).strip()[:80]
            node['addition']['data-track-label']=record['label']
        if node['addition']:
            raw=node['raw']
            for key in node['addition']:raw=re.sub(r'\s+'+re.escape(key)+r'="[^"]*"','',raw)
            ending='/>' if raw.endswith('/>') else '>'
            raw=raw[:-len(ending)]+''.join(f' {k}="{escape(str(v),quote=True)}"' for k,v in node['addition'].items())+ending
            self.edits.append((node['start'],len(node['raw']),raw))
    def result(self):
        result=self.source
        for start,length,replacement in sorted(self.edits,reverse=True):result=result[:start]+replacement+result[start+length:]
        if 'src="measurement-config.js"' not in result:result=result.replace('  <script src="script.js" defer></script>','  <script src="measurement-config.js" defer></script>\n  <script src="analytics.js" defer></script>\n  <script src="script.js" defer></script>')
        return result

for filename,page_type in [('index.html','landing'),('lol-highlights.html','article')]:
    file=ROOT/filename;parser=Instrument(file.read_text(encoding='utf-8'),filename,page_type);parser.feed(parser.source);file.write_text(parser.result(),encoding='utf-8')
(ROOT/'measurement').mkdir(exist_ok=True)
(ROOT/'measurement'/'element-map.json').write_text(json.dumps({'elements':ELEMENTS,'sections':SECTIONS},ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Instrumented {len(ELEMENTS)} controls and {len(SECTIONS)} sections')
