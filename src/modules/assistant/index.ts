/**
 * Assistant Module - Consent-driven chat with guarded write proposals.
 *
 * PR1: consent panel + read-only queries.
 * PR2: proposal diff + two-step confirm, re-auth for destructive changes,
 *      validated persist via persistPortfolioState, local audit log, undo.
 */

import type { FeatureContext } from '../../core/feature-context';
import {
  appendAssistantAction,
  applyAssistantProposal,
  applyValidatedProposal,
  classifyProposal,
  consentScope,
  defaultConsent,
  hasConfirmedAssistantAction,
  queryAssistant,
  readAssistantAudit,
  readConsent,
  stripRuntime,
  toggleConsent,
  AssistantRequestError,
  type ConsentState,
  type ProposalDiffEntry,
} from '../../lib/assistant';
import { buildContextSummary } from '../../lib/assistant/sanitize';
import {
  getPortfolioStorageKey,
  persistPortfolioState,
  undoLastSavedPortfolioChange,
} from '../../lib/storage';
import { recordPortfolioSnapshot } from '../../lib/snapshot-history';
import { showToast, createModal, closeModal } from '../ui';
import 'deep-chat';
import './styles.css';

type DeepChatMessage = { role?: string; text?: string };
type DeepChatResponse = { text?: string; error?: string };
type DeepChatElement = HTMLElement & {
  connect: {
    handler: (
      body: { messages: DeepChatMessage[] },
      signals: { onResponse: (response: DeepChatResponse) => void }
    ) => void;
  };
  onMessage: (body: { message: DeepChatMessage; isHistory: boolean }) => void;
  submitUserMessage: (message: { text: string }) => void;
};

// Module state
let activeContext: FeatureContext | null = null;
let consent: ConsentState = { ...defaultConsent };
let inFlight = false;
let conversationScope: string | null = null;
let pendingProposal: { question: string; proposedChanges: Record<string, unknown> } | null = null;
const MAX_CONVERSATION_MESSAGES = 12;

function getScope(): string {
  return consentScope(activeContext?.state.currentUser?.uid ?? null);
}

/**
 * Initialize the assistant module: build DOM, restore consent, attach listeners.
 */
export function initAssistantModule(container: HTMLElement, context: FeatureContext): void {
  activeContext = context;
  consent = readConsent(getScope());
  conversationScope = getScope();
  container.innerHTML = buildAssistantHTML();
  wireListeners(container);
  refreshAuditSection();
  updateMarketFreshness(context.state);
}

/**
 * Re-render assistant UI (consent state, chat availability, audit) on tab activation.
 */
export function renderAssistant(context?: FeatureContext): void {
  if (context) activeContext = context;
  if (!activeContext) return;

  consent = readConsent(getScope());
  resetConversationForScopeChange();
  const root = document.querySelector('.assistant-wrapper');
  if (!root) return;

  const chatPanel = root.querySelector('.assistant-chat') as HTMLElement | null;
  if (chatPanel) chatPanel.style.display = 'flex';

  root.querySelectorAll<HTMLInputElement>('input[data-consent]').forEach((box) => {
    const flag = box.dataset.consent as keyof ConsentState;
    box.checked = consent[flag] === true;
  });

  refreshAuditSection();
  updateMarketFreshness(activeContext.state);
}

function buildAssistantHTML(): string {
  return `
    <div class="assistant-wrapper">
      <div class="assistant-consent">
        <div>
          <strong>FIRE OS Assistant</strong>
          <span class="assistant-consent-copy">Reads enabled. Writes require approval.</span>
        </div>
        <button type="button" id="assistant-write-consent" class="btn-secondary">
          ${consent.allowWrites ? 'Revoke write access' : 'Agree to write access'}
        </button>
      </div>

      <div class="assistant-chat" style="display: flex">
        <div class="assistant-header">
          <div class="assistant-title-group">
            <span class="assistant-avatar" aria-hidden="true">F</span>
            <div>
              <strong>Portfolio guide</strong>
              <span>Grounded in your FIRE OS data</span>
            </div>
          </div>
          <span class="assistant-mode-badge">${
            consent.allowWrites ? 'Writes need confirmation' : 'Read-only'
          }</span>
        </div>
        <p id="assistant-data-freshness" class="assistant-data-freshness" aria-live="polite"></p>
        <div class="assistant-starters">
          <button type="button" data-assistant-starter="What is my current net worth breakdown?">Net worth breakdown</button>
          <button type="button" data-assistant-starter="What is the single most important next step for my FIRE plan?">Next best step</button>
          <button type="button" data-assistant-starter="How concentrated is my portfolio?">Portfolio concentration</button>
        </div>
        <deep-chat id="fireos-deep-chat"></deep-chat>
        <div class="assistant-attachments" aria-live="polite"></div>
      </div>

      <div class="assistant-audit" id="assistant-audit" style="display:none">
        <div class="assistant-audit-header">
          <h4>Audit log <span class="audit-local-badge">local only</span></h4>
          <button type="button" id="undo-assistant-btn" class="btn-undo" disabled>
            Undo last assistant change
          </button>
        </div>
        <ul class="audit-list" id="audit-list"></ul>
      </div>
    </div>
  `;
}

function wireListeners(root: HTMLElement): void {
  root.querySelector('#assistant-write-consent')?.addEventListener('click', () => {
    consent = toggleConsent(getScope(), 'allowWrites');
    showToast(`Write access ${consent.allowWrites ? 'enabled' : 'disabled'}`, 3000);
    renderAssistant();
  });

  const chat = root.querySelector('#fireos-deep-chat') as DeepChatElement | null;
  if (chat) {
    chat.connect = {
      handler: (body, signals) => {
        void handleDeepChatRequest(body.messages, signals);
      },
    };
    chat.onMessage = ({ message, isHistory }) => {
      if (isHistory || message.role !== 'ai' || !pendingProposal) return;
      const proposal = pendingProposal;
      pendingProposal = null;
      const attachments = root.querySelector('.assistant-attachments') as HTMLElement | null;
      if (attachments) renderProposalCard(attachments, proposal.question, proposal.proposedChanges);
    };
  }

  root.querySelectorAll<HTMLButtonElement>('[data-assistant-starter]').forEach((button) => {
    button.addEventListener('click', () => {
      chat?.submitUserMessage({ text: button.dataset.assistantStarter ?? '' });
    });
  });

  root.querySelector('#undo-assistant-btn')?.addEventListener('click', handleUndo);
}

async function handleDeepChatRequest(
  deepChatMessages: DeepChatMessage[],
  signals: { onResponse: (response: DeepChatResponse) => void }
): Promise<void> {
  if (inFlight || !activeContext) return;
  const latest = deepChatMessages[deepChatMessages.length - 1];
  const question = latest?.text?.trim() ?? '';
  if (!question) return;

  inFlight = true;

  try {
    // Refresh Nifty on demand, retain the last persisted value if the fetch fails,
    // and save successful data locally so later assistant requests can reuse it.
    try {
      const niftyData = await activeContext.ports.marketData.fetchNifty();
      if (niftyData) {
        activeContext.state.niftyData = niftyData;
        activeContext.state.niftyHigh = niftyData.high52w;
        activeContext.portfolio.save(activeContext.state, { sync: false });
      }
    } catch {
      // Market data is optional; continue with the last cached value if available.
    }

    const contextSummary = buildContextSummary(activeContext.state, true);
    updateMarketFreshness(activeContext.state);
    const requestMessages = deepChatMessages
      .filter((message) => message.role === 'user' || message.role === 'ai')
      .map((message) => ({
        role: message.role === 'ai' ? ('assistant' as const) : ('user' as const),
        content: message.text ?? '',
      }))
      .filter((message) => message.content.trim())
      .slice(-MAX_CONVERSATION_MESSAGES);
    const data = await queryAssistant(question, contextSummary, {
      sendExact: contextSummary.sendExact,
      messages: requestMessages,
    });

    const reply = data.reply || 'No reply received.';
    pendingProposal = data.proposedChanges
      ? { question, proposedChanges: data.proposedChanges }
      : null;
    signals.onResponse({ text: reply });
  } catch (err) {
    const message =
      err instanceof AssistantRequestError
        ? err.message
        : err instanceof DOMException && err.name === 'AbortError'
          ? 'Request timed out.'
          : 'Could not reach the assistant service.';
    signals.onResponse({ error: message });
    const attachments = document.querySelector('.assistant-attachments') as HTMLElement | null;
    if (attachments) appendMessage(attachments, 'assistant-error', message);
    showToast(message, 5000, 'error');
  } finally {
    inFlight = false;
  }
}

function updateMarketFreshness(state: FeatureContext['state']): void {
  const label = document.getElementById('assistant-data-freshness');
  if (!label) return;
  const marketData = buildContextSummary(state).nifty50;
  label.textContent = marketData
    ? `Nifty 50 data: ${new Date(marketData.asOf).toLocaleString()} · ${marketData.freshness}`
    : 'Nifty 50 data unavailable';
}

function resetConversationForScopeChange(): void {
  const nextScope = getScope();
  if (conversationScope === nextScope) return;
  conversationScope = nextScope;
  pendingProposal = null;
  document.querySelector('.assistant-attachments')?.replaceChildren();
}

/* ------------------------------------------------------------------ *
 * Proposal card: human summary + field diff + two-step confirm       *
 * ------------------------------------------------------------------ */

function formatValue(value: unknown): string {
  if (value === undefined) return '(not set)';
  if (value === null) return 'null';
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function renderProposalCard(
  messages: HTMLElement,
  question: string,
  proposedChanges: Record<string, unknown>
): void {
  if (!activeContext) return;

  const validation = applyAssistantProposal(activeContext.state, proposedChanges);

  const card = document.createElement('div');
  card.className = 'assistant-proposal';

  if (!validation.ok) {
    card.innerHTML = '';
    card.appendChild(document.createTextNode('Assistant proposed a change that failed validation.'));
    const detail = document.createElement('div');
    detail.className = 'assistant-proposal-invalid';
    detail.textContent = validation.reason;
    card.appendChild(detail);
    messages.appendChild(card);
    appendAssistantAction(getScope(), {
      question: question.slice(0, 200),
      diff: [],
      decision: 'validation-failed',
      cloudSaved: false,
      notes: [validation.reason],
    });
    messages.scrollTop = messages.scrollHeight;
    return;
  }

  if (!consent.allowWrites) {
    appendMessage(
      messages,
      'assistant-proposal-notice',
      'Assistant proposed changes. Agree to write access to review and confirm them.'
    );
    return;
  }

  const { diff } = validation;
  const analysis = classifyProposal(activeContext.state, proposedChanges);

  const summary = document.createElement('div');
  summary.className = 'assistant-proposal-summary';
  summary.textContent = `Proposed changes (${diff.length} field${diff.length === 1 ? '' : 's'}):`;
  card.appendChild(summary);

  const list = document.createElement('ul');
  list.className = 'assistant-proposal-diff';
  for (const entry of diff) {
    const item = document.createElement('li');
    const path = document.createElement('code');
    path.textContent = entry.path;
    const before = document.createElement('span');
    before.className = 'diff-before';
    before.textContent = formatValue(entry.before);
    const arrow = document.createElement('span');
    arrow.className = 'diff-arrow';
    arrow.textContent = ' → ';
    const after = document.createElement('span');
    after.className = 'diff-after';
    after.textContent = formatValue(entry.after);
    item.append(path, before, arrow, after);
    list.appendChild(item);
  }
  card.appendChild(list);

  if (analysis.requiresReauth) {
    const warn = document.createElement('div');
    warn.className = 'assistant-proposal-warning';
    warn.textContent = `Re-authentication required: ${analysis.reasons.join('; ')}`;
    card.appendChild(warn);
  }

  const cloudRow = document.createElement('label');
  cloudRow.className = 'assistant-proposal-cloud';
  const cloudCheck = document.createElement('input');
  cloudCheck.type = 'checkbox';
  cloudCheck.id = 'assistant-cloud-save';
  cloudCheck.checked = Boolean(activeContext.state.currentUser?.uid);
  cloudCheck.disabled = !activeContext.state.currentUser?.uid;
  const cloudText = document.createElement('span');
  cloudText.textContent = activeContext.state.currentUser?.uid
    ? 'Save to cloud after confirm'
    : 'Sign in to enable cloud save (local save only)';
  cloudRow.append(cloudCheck, cloudText);
  card.appendChild(cloudRow);

  const actions = document.createElement('div');
  actions.className = 'assistant-proposal-actions';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn-confirm';
  confirmBtn.textContent = 'Confirm changes';
  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.className = 'btn-reject';
  rejectBtn.textContent = 'Reject';
  actions.append(confirmBtn, rejectBtn);
  card.appendChild(actions);

  rejectBtn.addEventListener('click', () => {
    appendAssistantAction(getScope(), {
      question: question.slice(0, 200),
      diff,
      decision: 'rejected',
      cloudSaved: false,
    });
    card.remove();
    appendMessage(messages, 'assistant-note', 'Proposal rejected. Nothing was changed.');
    refreshAuditSection();
  });

  confirmBtn.addEventListener('click', () => {
    confirmBtn.disabled = true;
    rejectBtn.disabled = true;
    const cloudSave = cloudCheck.checked && Boolean(activeContext?.state.currentUser?.uid);
    if (analysis.requiresReauth) {
      openReauthGate(analysis.reasons, (passed) => {
        if (!passed) {
          confirmBtn.disabled = false;
          rejectBtn.disabled = false;
          appendAssistantAction(getScope(), {
            question: question.slice(0, 200),
            diff,
            decision: 'reauth-required',
            cloudSaved: false,
            notes: analysis.reasons,
          });
          refreshAuditSection();
          return;
        }
        void commitProposal(card, messages, question, proposedChanges, diff, cloudSave);
      });
    } else {
      void commitProposal(card, messages, question, proposedChanges, diff, cloudSave);
    }
  });

  messages.appendChild(card);
  messages.scrollTop = messages.scrollHeight;
}

/**
 * Re-authentication gate for destructive/high-value changes.
 * Google users: popup. Password users: password prompt. Guests: typed CONFIRM.
 */
function openReauthGate(reasons: string[], onResult: (passed: boolean) => void): void {
  const provider = activeContext?.state.currentUser ? reauthProviderFor() : null;
  const reasonsHtml = reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

  if (provider === 'google.com') {
    createModal(
      'Re-authentication required',
      `<p>This change is destructive or high-value and requires re-authentication:</p>
       <ul>${reasonsHtml}</ul>`,
      [
        { label: 'Cancel', onClick: () => { closeModal(); onResult(false); } },
        {
          label: 'Re-authenticate with Google',
          isPrimary: true,
          onClick: () => {
            void (async () => {
              const { reauthenticateGoogle } = await import('../../lib/assistant/reauth');
              const result = await reauthenticateGoogle();
              closeModal();
              onResult(result.ok);
              if (!result.ok) showToast(result.reason, 5000, 'error');
            })();
          },
        },
      ]
    );
    return;
  }

  if (provider === 'password') {
    createModal(
      'Re-authentication required',
      `<p>This change is destructive or high-value. Re-enter your password:</p>
       <ul>${reasonsHtml}</ul>
       <input type="password" id="reauth-password" placeholder="Password"
              style="width:100%;padding:0.6rem;border-radius:6px;border:1px solid #555;background:#1a1a1a;color:#fff;">`,
      [
        { label: 'Cancel', onClick: () => { closeModal(); onResult(false); } },
        {
          label: 'Re-authenticate',
          isPrimary: true,
          onClick: () => {
            const pw = (document.getElementById('reauth-password') as HTMLInputElement | null)?.value ?? '';
            if (!pw) return;
            void (async () => {
              const { reauthenticatePassword } = await import('../../lib/assistant/reauth');
              const result = await reauthenticatePassword(pw);
              closeModal();
              onResult(result.ok);
              if (!result.ok) showToast(result.reason, 5000, 'error');
            })();
          },
        },
      ]
    );
    const pwField = document.getElementById('reauth-password') as HTMLInputElement | null;
    pwField?.focus();
    return;
  }

  // Guest / no account: typed confirmation phrase
  createModal(
    'Confirm destructive change',
    `<p>This change is destructive or high-value:</p>
     <ul>${reasonsHtml}</ul>
     <p>Type <strong>CONFIRM</strong> to proceed. The change is saved locally only.</p>
     <input type="text" id="reauth-phrase" placeholder="CONFIRM"
            style="width:100%;padding:0.6rem;border-radius:6px;border:1px solid #555;background:#1a1a1a;color:#fff;">`,
    [
      { label: 'Cancel', onClick: () => { closeModal(); onResult(false); } },
      {
        label: 'Confirm',
        isPrimary: true,
        onClick: () => {
          const value = (document.getElementById('reauth-phrase') as HTMLInputElement | null)?.value ?? '';
          closeModal();
          onResult(value.trim().toUpperCase() === 'CONFIRM');
        },
      },
    ]
  );
}

function reauthProviderFor(): 'google.com' | 'password' | null {
  const user = activeContext?.state.currentUser;
  if (!user) return null;
  const providerId = user.providerData?.[0]?.providerId;
  if (providerId === 'google.com') return 'google.com';
  if (providerId === 'password') return 'password';
  return null;
}

/**
 * Final write step: snapshot → validate → apply → persist → audit.
 */
async function commitProposal(
  card: HTMLElement,
  messages: HTMLElement,
  question: string,
  proposedChanges: Record<string, unknown>,
  diff: ProposalDiffEntry[],
  cloudSave: boolean
): Promise<void> {
  if (!activeContext) return;
  const state = activeContext.state;

  const validation = applyAssistantProposal(state, proposedChanges);
  if (!validation.ok) {
    appendAssistantAction(getScope(), {
      question: question.slice(0, 200),
      diff,
      decision: 'validation-failed',
      cloudSaved: false,
      notes: [validation.reason],
    });
    showToast(validation.reason, 5000, 'error');
    refreshAuditSection();
    return;
  }

  // Snapshot pre-change state so Undo works even before saveData runs
  const storageKey = getPortfolioStorageKey();
  if (storageKey) recordPortfolioSnapshot(storageKey, stripRuntime(state));

  applyValidatedProposal(state, proposedChanges);

  try {
    if (cloudSave) {
      await persistPortfolioState(state, { awaitCloud: true });
    } else {
      persistPortfolioState(state);
    }
    appendAssistantAction(getScope(), {
      question: question.slice(0, 200),
      diff,
      decision: 'confirmed',
      cloudSaved: cloudSave,
    });
    card.remove();
    appendMessage(
      messages,
      'assistant-success',
      cloudSave
        ? 'Changes confirmed and saved to cloud.'
        : 'Changes confirmed and saved locally.'
    );
    showToast('Assistant change applied', 3000, 'success');
  } catch (err) {
    appendAssistantAction(getScope(), {
      question: question.slice(0, 200),
      diff,
      decision: 'save-failed',
      cloudSaved: false,
      notes: [err instanceof Error ? err.message : 'Save failed'],
    });
    showToast('Cloud save failed; local change kept. Use Undo if needed.', 6000, 'error');
    appendMessage(messages, 'assistant-error', 'Cloud save failed; local change kept.');
  }

  refreshAuditSection();
}

/* ------------------------------------------------------------------ *
 * Audit log + undo                                                    *
 * ------------------------------------------------------------------ */

function refreshAuditSection(): void {
  const section = document.getElementById('assistant-audit');
  const list = document.getElementById('audit-list') as HTMLUListElement | null;
  const undoBtn = document.getElementById('undo-assistant-btn') as HTMLButtonElement | null;
  if (!section || !list || !undoBtn) return;

  const entries = readAssistantAudit(getScope());
  if (entries.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  list.innerHTML = '';
  for (const entry of [...entries].reverse()) {
    const item = document.createElement('li');
    item.className = `audit-entry audit-${entry.decision}`;
    const time = new Date(entry.timestamp).toLocaleString();
    const badge = document.createElement('span');
    badge.className = 'audit-badge';
    badge.textContent = entry.decision;
    const meta = document.createElement('span');
    meta.className = 'audit-meta';
    meta.textContent = `${time} · ${entry.diff.length} field${entry.diff.length === 1 ? '' : 's'}${
      entry.cloudSaved ? ' · cloud' : ''
    }`;
    const q = document.createElement('div');
    q.className = 'audit-question';
    q.textContent = entry.question;
    item.append(badge, meta, q);
    if (entry.notes?.length) {
      const notes = document.createElement('div');
      notes.className = 'audit-notes';
      notes.textContent = entry.notes.join('; ');
      item.appendChild(notes);
    }
    list.appendChild(item);
  }

  undoBtn.disabled = !hasConfirmedAssistantAction(getScope());
}

async function handleUndo(): Promise<void> {
  if (!activeContext) return;
  const state = activeContext.state;
  if (!undoLastSavedPortfolioChange(state)) {
    showToast('No previous snapshot to restore.', 4000, 'warning');
    return;
  }
  try {
    await activeContext.portfolio.save(state);
    showToast('Last assistant change undone', 3000, 'success');
  } catch {
    showToast('Undo applied locally; cloud sync failed.', 5000, 'error');
  }
  refreshAuditSection();
}

/* ------------------------------------------------------------------ *
 * Helpers                                                             *
 * ------------------------------------------------------------------ */

function appendMessage(container: HTMLElement, className: string, text: string): HTMLElement {
  const div = document.createElement('div');
  div.className = className;
  if (className === 'assistant-reply') {
    renderAssistantMarkdown(div, text);
  } else {
    div.textContent = text;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function renderAssistantMarkdown(container: HTMLElement, text: string): void {
  const lines = text.split(/\r?\n/);
  let list: HTMLUListElement | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      list = null;
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!list) {
        list = document.createElement('ul');
        container.appendChild(list);
      }
      const item = document.createElement('li');
      appendInlineMarkdown(item, bullet[1]);
      list.appendChild(item);
      continue;
    }

    list = null;
    const paragraph = document.createElement(trimmed.startsWith('#') ? 'h3' : 'p');
    appendInlineMarkdown(paragraph, trimmed.replace(/^#{1,3}\s+/, ''));
    container.appendChild(paragraph);
  }
}

function appendInlineMarkdown(container: HTMLElement, text: string): void {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      container.appendChild(strong);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      container.appendChild(code);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
