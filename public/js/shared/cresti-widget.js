/**
 * Crystal Crest - Cresti AI Beauty Concierge Floating Chat Widget Module
 * Renders floating chat trigger & luxury assistant drawer across all customer-facing pages.
 */

function renderMarkdown(rawText) {
  if (!rawText) return '';

  // 1. Basic sanitization: Escape raw HTML tags to prevent unexpected injections
  let text = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Markdown Links [Label](url) -> Clickable anchor with safe href
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const safeUrl = url.trim().replace(/"/g, '&quot;');
    return `<a href="${safeUrl}" class="text-[#9B72CF] font-bold underline hover:text-purple-800 transition-colors">${label}</a>`;
  });

  // 3. Bold: **text** or __text__ -> <strong>text</strong>
  text = text.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>');

  // 4. Italic: *text* or _text_ -> <em>text</em>
  text = text.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');

  // 5. Bullet & numbered lists processing by lines
  const lines = text.split('\n');
  const processedLines = [];
  let inBulletList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)[-*•]\s+(.+)$/);
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (!inBulletList) {
        if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
        processedLines.push('<ul class="list-disc ml-5 space-y-1 my-1.5">');
        inBulletList = true;
      }
      processedLines.push(`<li>${bulletMatch[2]}</li>`);
    } else if (numberMatch) {
      if (!inNumberedList) {
        if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
        processedLines.push('<ol class="list-decimal ml-5 space-y-1 my-1.5">');
        inNumberedList = true;
      }
      processedLines.push(`<li>${numberMatch[2]}</li>`);
    } else {
      if (inBulletList) { processedLines.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { processedLines.push('</ol>'); inNumberedList = false; }
      processedLines.push(line);
    }
  }
  if (inBulletList) processedLines.push('</ul>');
  if (inNumberedList) processedLines.push('</ol>');

  // 6. Join lines and convert single newlines to <br> where appropriate
  let html = processedLines.join('\n');
  html = html.replace(/\n\n+/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

export const CrestiWidget = {
  history: [],

  init() {
    // Only mount on customer-facing pages (never on /admin/ or /cashier/)
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/admin/') || path.includes('/cashier/')) {
      return;
    }

    if (document.getElementById('cresti-widget-container')) return;

    this.loadHistory();
    this.renderWidget();
    this.setupEventListeners();

    if (this.history.length === 0) {
      this.history.push({
        sender: 'bot',
        text: `Hey! Welcome to Crystal Crest — what can I help you find today?`
      });
      this.saveHistory();
    }

    this.renderMessages();
  },

  loadHistory() {
    try {
      const stored = sessionStorage.getItem('cresti_chat_history');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch (e) {
      this.history = [];
    }
  },

  saveHistory() {
    try {
      sessionStorage.setItem('cresti_chat_history', JSON.stringify(this.history));
    } catch (e) {}
  },

  renderWidget() {
    const container = document.createElement('div');
    container.id = 'cresti-widget-container';
    container.className = 'font-sans select-none';

    container.innerHTML = `
      <!-- FLOATING CHAT BUTTON TRIGGER (Positioned above mobile bottom nav) -->
      <button id="cresti-trigger-btn" aria-label="Open Cresti AI Concierge" class="fixed bottom-20 md:bottom-6 right-3 sm:right-6 z-40 bg-gradient-to-tr from-[#1C1C1E] via-[#2C2C2E] to-[#1C1C1E] text-white p-2.5 sm:p-3.5 rounded-full shadow-2xl border-2 border-[#E8C500] hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 sm:gap-3 group">
        <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#9B72CF] via-[#E8C500] to-[#F8E8E8] p-[2px] shadow-lg flex items-center justify-center">
          <div class="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center">
            <span class="font-serif-heading font-bold text-base sm:text-lg text-[#E8C500]">C</span>
          </div>
        </div>
        <div class="hidden sm:flex flex-col text-left pr-2">
          <span class="text-xs font-bold text-white tracking-wider flex items-center gap-1">
            <span>Cresti AI</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </span>
          <span class="text-[9px] uppercase tracking-widest text-[#E8C500] font-semibold">Beauty Concierge</span>
        </div>
      </button>

      <!-- CHAT WIDGET DRAWER / PANEL (Responsive width down to 320px) -->
      <div id="cresti-chat-panel" class="fixed bottom-20 md:bottom-24 left-2 right-2 sm:left-auto sm:right-6 z-50 w-auto sm:w-96 max-w-[calc(100vw-1rem)] bg-[#FDFAF5] rounded-3xl border-2 border-[#E8C500]/40 shadow-2xl hidden flex-col overflow-hidden transition-all duration-300 max-h-[75vh] sm:max-h-[600px]">
        
        <!-- Header Bar -->
        <div class="bg-gradient-to-r from-[#1C1C1E] to-[#2C2C2E] text-white p-4 flex items-center justify-between border-b border-[#E8C500]/30 shadow-md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-[#9B72CF] via-[#E8C500] to-[#F8E8E8] p-[2px] flex items-center justify-center">
              <div class="w-full h-full bg-[#1C1C1E] rounded-full flex items-center justify-center">
                <span class="font-serif-heading font-bold text-lg text-[#E8C500]">C</span>
              </div>
            </div>
            <div>
              <h4 class="font-serif-heading font-bold text-base text-white tracking-wider">Cresti AI Concierge</h4>
              <p class="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Online • Beauty Consultant</span>
              </p>
            </div>
          </div>

          <button id="close-cresti-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center text-sm font-bold transition-colors">
            ✕
          </button>
        </div>

        <!-- Messages Area -->
        <div id="cresti-messages-list" class="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-[#FDFAF5]">
        </div>

        <!-- Input Footer Form -->
        <form id="cresti-chat-form" class="p-3 bg-white border-t border-[#F8E8E8] flex items-center gap-2">
          <input type="text" id="cresti-user-input" required placeholder="Ask about skincare, perfumes, shoes..." class="flex-1 px-4 py-2.5 bg-[#FDFAF5] border border-[#F8E8E8] rounded-2xl text-xs text-gray-900 focus:outline-none focus:border-[#9B72CF] font-medium">
          <button type="submit" id="cresti-send-btn" class="w-10 h-10 rounded-2xl bg-gray-900 hover:bg-[#9B72CF] text-[#E8C500] font-bold flex items-center justify-center shadow transition-colors shrink-0">
            ➤
          </button>
        </form>

      </div>
    `;

    document.body.appendChild(container);
  },

  setupEventListeners() {
    const triggerBtn = document.getElementById('cresti-trigger-btn');
    const closeBtn = document.getElementById('close-cresti-btn');
    const panel = document.getElementById('cresti-chat-panel');
    const form = document.getElementById('cresti-chat-form');

    triggerBtn?.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      panel.classList.toggle('flex');
      if (!panel.classList.contains('hidden')) {
        document.getElementById('cresti-user-input')?.focus();
        this.scrollToBottom();
      }
    });

    closeBtn?.addEventListener('click', () => {
      panel.classList.add('hidden');
      panel.classList.remove('flex');
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('cresti-user-input');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      this.sendMessage(text);
    });
  },

  async sendMessage(text) {
    const sendBtn = document.getElementById('cresti-send-btn');
    const input = document.getElementById('cresti-user-input');

    this.history.push({ sender: 'user', text });
    this.saveHistory();
    this.renderMessages();

    this.showTyping(true);
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;

    try {
      const res = await fetch('/api/cresti/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationHistory: this.history
        })
      });

      const data = await res.json();
      this.showTyping(false);

      if (data.success && data.reply) {
        this.history.push({ sender: 'bot', text: data.reply });
      } else {
        this.history.push({
          sender: 'bot',
          text: `Pardon me, darlings! I experienced a temporary hiccup. Please ask me again!`
        });
      }

    } catch (err) {
      this.showTyping(false);
      this.history.push({
        sender: 'bot',
        text: `I'm having trouble connecting right now. Please check your connection and try again!`
      });
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (input) {
        input.disabled = false;
        input.focus();
      }
    }

    this.saveHistory();
    this.renderMessages();
  },

  showTyping(show) {
    this.isTyping = show;
    this.renderMessages();
  },

  renderMessages() {
    const list = document.getElementById('cresti-messages-list');
    if (!list) return;

    let html = this.history.map(m => {
      const isUser = m.sender === 'user';
      const formattedHtml = isUser 
        ? m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
        : renderMarkdown(m.text);

      return `
        <div class="flex ${isUser ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[85%] p-3.5 rounded-2xl leading-relaxed text-xs ${isUser ? 'bg-gray-900 text-white rounded-br-none shadow-md' : 'bg-white text-gray-800 border border-[#F8E8E8] shadow-sm rounded-bl-none prose-sm'}">
            ${formattedHtml}
          </div>
        </div>
      `;
    }).join('');

    if (this.isTyping) {
      html += `
        <div class="flex justify-start animate-fade-in" id="cresti-typing-bubble">
          <div class="bg-white border border-[#F8E8E8] shadow-sm rounded-2xl rounded-bl-none flex items-center gap-1.5 px-4 py-3">
            <span class="cresti-dot-wobble"></span>
            <span class="cresti-dot-wobble"></span>
            <span class="cresti-dot-wobble"></span>
          </div>
        </div>
      `;
    }

    list.innerHTML = html;
    this.scrollToBottom();
  },

  scrollToBottom() {
    const list = document.getElementById('cresti-messages-list');
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }
};

// Auto-initialize on customer-facing pages
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CrestiWidget.init());
} else {
  CrestiWidget.init();
}
