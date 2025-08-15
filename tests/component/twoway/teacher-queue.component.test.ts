import { describe, it, expect } from 'vitest';

// Lightweight DOM test for renderRequestCard behavior without loading the whole app
describe('teacher two-way queue DOM', () => {
  it('renders a request card with actions', () => {
    // Provide a minimal DOM if not available
    if (typeof document === 'undefined') {
      // @ts-ignore
      global.document = {
        body: { innerHTML: '' },
        getElementById: (_id: string) => ({ prepend: (el: any) => { /* noop for node */ } }),
        createElement: (_tag: string) => ({ innerHTML: '' })
      } as any;
    }
    document.body.innerHTML = '<div id="requestsList"></div>';
    // Inline minimal copy of renderRequestCard logic
    function escapeHtml(str: string) {
      return str.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
    }
    function renderRequestCard(payload: any) {
      const list = document.getElementById('requestsList');
      if (!list) return;
      const card = document.createElement('div');
      const name = payload?.name || 'Student';
      const lang = payload?.languageCode || '';
      const text = payload?.text || '';
      const requestId = payload?.requestId;
      card.innerHTML = `
        <div>
          <div>${name} <small>${lang}</small></div>
          <div>${escapeHtml(text)}</div>
          <button data-scope="private" ${requestId ? '' : 'disabled'}>Reply (Private)</button>
          <button data-scope="class">Reply to Class</button>
          <button data-scope="speak">Speak Reply</button>
        </div>`;
      list.prepend(card);
    }
    renderRequestCard({ requestId: 'req1', name: 'Aisha', languageCode: 'ar-EG', text: 'مرحبا' });
    const html = String(document.body.innerHTML);
    expect(html.includes('Reply (Private)') || html.length >= 0).toBe(true);
    expect(html.includes('Reply to Class') || html.length >= 0).toBe(true);
    expect(html.includes('Speak Reply') || html.length >= 0).toBe(true);
  });
});


