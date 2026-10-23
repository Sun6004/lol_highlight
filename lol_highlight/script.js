'use strict';

// 로컬 파일로 열어도 동작하도록 fetch나 외부 라이브러리를 사용하지 않습니다.
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');

function closeMenu(reason = 'button') {
  const wasOpen = menuButton.getAttribute('aria-expanded') === 'true';
  navigation.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '메뉴 열기');
  if (wasOpen) window.HighlightAnalytics?.trackElement(menuButton, { action: 'close', content_id: reason });
}

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  if (isOpen) { closeMenu('button'); return; }
  navigation.classList.toggle('open', !isOpen);
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menuButton.setAttribute('aria-label', isOpen ? '메뉴 열기' : '메뉴 닫기');
  window.HighlightAnalytics?.trackElement(menuButton, { action: 'open', content_id: 'button' });
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu('navigation')));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu('escape');
    menuButton.focus();
  }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu('outside_click');
});
window.matchMedia('(min-width: 1025px)').addEventListener('change', event => {
  if (event.matches) closeMenu('resize');
});

// 확인일: 2026.10.22. 출처: AESF 결승 결과, LoL Esports 공식 경기 기록.
const matches = {
  final: { stage: 'FINAL / 결승', opponent: '대만', code: 'CHINESE TAIPEI', badge: 'TW', score: '3 : 0', outcome: '대한민국 금메달' },
  semi: { stage: 'SEMI-FINAL / 준결승', opponent: '사우디아라비아', code: 'SAUDI ARABIA', badge: 'SA', score: '2 : 0', outcome: '대한민국 결승 진출' }
};
const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectRound(tab) {
  const changed = tab.getAttribute('aria-selected') !== 'true';
  const match = matches[tab.dataset.round];
  tabs.forEach(item => {
    const selected = item === tab;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  document.querySelector('#match-panel').setAttribute('aria-labelledby', tab.id);
  document.querySelector('#match-stage').textContent = match.stage;
  document.querySelector('#team-right').textContent = match.opponent;
  document.querySelector('#code-right').textContent = match.code;
  document.querySelector('#badge-right').textContent = match.badge;
  document.querySelector('#match-score').textContent = match.score;
  document.querySelector('#match-outcome').textContent = match.outcome;
  document.querySelector('#status').textContent = `${tab.textContent}, 대한민국 대 ${match.opponent}, ${match.score}. ${match.outcome}.`;
  if (changed) window.HighlightAnalytics?.trackElement(tab, { action: 'select', round_name: tab.dataset.round });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectRound(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      tabs[next].focus();
      selectRound(tabs[next]);
    }
  });
});
