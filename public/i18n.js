// i18n.js — gerencia mudança de idioma dinamicamente
let CURRENT_LOCALE = 'pt-BR';
let I18N_DATA = null;
const DEFAULT_LOCALE = 'pt-BR';

async function loadLocale(locale) {
  try {
    const res = await fetch(`/api/i18n/${encodeURIComponent(locale)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    I18N_DATA = await res.json();
    CURRENT_LOCALE = I18N_DATA.locale || locale;
    document.documentElement.lang = CURRENT_LOCALE.split('-')[0];
    applyTranslations();
    renderLanguagePicker();
    try { localStorage.setItem('eneagrama_locale', CURRENT_LOCALE); } catch (e) {}
    const url = new URL(location.href);
    if (url.searchParams.get('lang') !== CURRENT_LOCALE) {
      url.searchParams.set('lang', CURRENT_LOCALE);
      history.replaceState(null, '', url);
    }
  } catch (e) {
    console.error('Erro ao carregar locale', locale, e);
  }
}

function t(key) {
  if (!I18N_DATA) return key;
  return I18N_DATA.ui && I18N_DATA.ui[key] ? I18N_DATA.ui[key] : key;
}

function applyTranslations() {
  if (!I18N_DATA || !I18N_DATA.ui) return;
  const u = I18N_DATA.ui;
  const titleEl = document.querySelector('.header h1');
  if (titleEl) titleEl.textContent = u.title || titleEl.textContent;
  const subEl = document.querySelector('.header p');
  if (subEl) subEl.textContent = u.subtitle || subEl.textContent;
  const adminBtn = document.querySelector('.header button[onclick*="openModalAdmin"]');
  if (adminBtn) adminBtn.textContent = u.btn_admin || adminBtn.textContent;
  // Form: labels (label_name, label_phone) e placeholders
  // Como label engloba o input, o primeiro text node contém o label
  const labels = document.querySelectorAll('.form-card > label');
  if (labels.length >= 1) {
    // Label 1: Nome completo
    // Mantém o " *" (asterisco do obrigatório) se existir
    const l1 = labels[0];
    const firstNode1 = Array.from(l1.childNodes).find(n => n.nodeType === 3); // text node
    if (firstNode1) {
      const temAsterisco = l1.querySelector('.req') !== null;
      firstNode1.textContent = u.label_name + (temAsterisco ? ' ' : '');
    }
  }
  if (labels.length >= 2) {
    // Label 2: Telefone celular (WhatsApp)
    const l2 = labels[1];
    const firstNode2 = Array.from(l2.childNodes).find(n => n.nodeType === 3);
    if (firstNode2) {
      firstNode2.textContent = u.label_phone + ' ';
    }
  }
  // Placeholders do form
  const nameInput = document.getElementById('fieldNome');
  if (nameInput) {
    nameInput.placeholder = u.label_name || nameInput.placeholder;
  }
  const phoneInput = document.getElementById('fieldWhats');
  if (phoneInput) {
    phoneInput.placeholder = I18N_DATA.phone_placeholder || phoneInput.placeholder;
  }
  const instructionsEl = document.querySelector('.instructions');
  if (instructionsEl && u.instructions_html) instructionsEl.innerHTML = u.instructions_html;
  const langLabel = document.querySelector('.lang-picker-label');
  if (langLabel) langLabel.textContent = u.language_picker_label || langLabel.textContent;
  const viewBtn = document.getElementById('submitBtn');
  if (viewBtn) viewBtn.textContent = u.btn_view_result || viewBtn.textContent;
  const modalTitle = document.querySelector('#modalConfirm h3');
  if (modalTitle) modalTitle.textContent = u.modal_confirm_title || modalTitle.textContent;
  const modalP1 = document.querySelectorAll('#modalConfirm p');
  if (modalP1 && modalP1.length >= 1) modalP1[0].innerHTML = '<strong>' + (u.modal_confirm_p1 || '') + '</strong>';
  if (modalP1 && modalP1.length >= 2) modalP1[1].textContent = u.modal_confirm_p2 || modalP1[1].textContent;
  if (modalP1 && modalP1.length >= 3) modalP1[2].textContent = u.modal_confirm_p3 || modalP1[2].textContent;
  const confirmBtns = document.querySelectorAll('#modalConfirm .btn');
  if (confirmBtns && confirmBtns.length >= 2) {
    confirmBtns[0].textContent = u.modal_confirm_no || confirmBtns[0].textContent;
    confirmBtns[1].textContent = u.modal_confirm_yes || confirmBtns[1].textContent;
  }
  const adminTitle = document.querySelector('#modalAdmin h3');
  if (adminTitle) adminTitle.textContent = u.modal_admin_title || adminTitle.textContent;
  const adminLabels = document.querySelectorAll('#modalAdmin label');
  if (adminLabels && adminLabels.length >= 2) {
    adminLabels[0].firstChild.textContent = u.modal_admin_login_label || adminLabels[0].firstChild.textContent;
    adminLabels[1].firstChild.textContent = u.modal_admin_pass_label || adminLabels[1].firstChild.textContent;
  }
  const userInput = document.getElementById('adminUser');
  if (userInput) userInput.placeholder = u.modal_admin_user_placeholder || '';
  const passInput = document.getElementById('adminPass');
  if (passInput) passInput.placeholder = u.modal_admin_pass_placeholder || '';
  const adminLoginBtn = document.querySelector('#adminLoginForm .btn');
  if (adminLoginBtn) adminLoginBtn.textContent = u.modal_admin_login_button || adminLoginBtn.textContent;

  // ===== SCALE LABELS (0-5) =====
  applyScaleLabels();

  // ===== DELETE BUTTONS =====
  applyDeleteButtons();

  // ===== PROGRESS LABEL (com placeholders {answered} e {total}) =====
  const progressEl = document.getElementById('progressText');
  if (progressEl && u.progress_label) {
    const answeredCount = window.__answeredCount ?? 0;
    progressEl.textContent = u.progress_label
      .replace('{answered}', String(answeredCount))
      .replace('{total}', '45');
  }

  // ===== QUESTIONS =====
  applyQuestions();

  // ===== RESULT TEXTS (result-card) =====
  updateResultTexts();
}

function applyScaleLabels() {
  if (!I18N_DATA || !I18N_DATA.ui || !I18N_DATA.ui.scale_labels) return;
  const labels = I18N_DATA.ui.scale_labels;
  // Atualiza todos os .rating-label baseado na posição (0..5) dentro do .rating
  document.querySelectorAll('.question').forEach(question => {
    const radios = question.querySelectorAll('.rating label');
    radios.forEach((radio, i) => {
      const num = radio.querySelector('.rating-num');
      const lab = radio.querySelector('.rating-label');
      if (num && lab && labels[i]) {
        lab.textContent = labels[i];
      }
    });
  });
  // Atualiza o .scale-legend (topo de cada grupo) com "0 — <label0>" e "5 — <label5>"
  document.querySelectorAll('.scale-legend').forEach(sl => {
    const spans = sl.querySelectorAll('span');
    if (spans.length >= 2 && labels[0] && labels[5]) {
      spans[0].textContent = '0 — ' + labels[0];
      spans[1].textContent = '5 — ' + labels[5];
    }
  });
}

function applyDeleteButtons() {
  if (!I18N_DATA || !I18N_DATA.ui) return;
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.textContent = I18N_DATA.ui.btn_delete_record || btn.textContent;
  });
}

function applyQuestions() {
  if (!I18N_DATA || !I18N_DATA.questions) return;
  const grupos = I18N_DATA.questions;
  const groups = document.querySelectorAll('.group');
  groups.forEach(g => {
    const letter = g.querySelector('.group-badge')?.textContent.trim();
    if (!letter || !grupos[letter]) return;
    const questoes = grupos[letter];
    const questionEls = g.querySelectorAll('.question');
    questionEls.forEach((q, i) => {
      const textEl = q.querySelector('.question-text');
      if (textEl && questoes[i]) {
        const idMatch = textEl.innerHTML.match(/^([A-I]\d+\.)\s*/);
        const idText = idMatch ? idMatch[1] + ' ' : (letter + (i + 1) + '. ');
        textEl.innerHTML = '<span class="question-id">' + idText + '</span> ' + questoes[i];
      }
    });
  });
}

function updateResultTexts() {
  if (!I18N_DATA || !I18N_DATA.ui) return;
  const u = I18N_DATA.ui;
  const h2s = document.querySelectorAll('.result-card h2');
  if (h2s.length >= 4) {
    h2s[0].textContent = u.result_section_title || h2s[0].textContent;
    h2s[1].textContent = u.result_dominant_title || h2s[1].textContent;
    h2s[2].textContent = u.result_chart_title || h2s[2].textContent;
    h2s[3].textContent = u.result_table_title || h2s[3].textContent;
  }
  const subEl = document.querySelector('.result-card .subtitle');
  if (subEl) subEl.textContent = u.result_section_subtitle || subEl.textContent;
  const pdfBtn = document.getElementById('pdfBtn');
  if (pdfBtn) pdfBtn.textContent = u.result_pdf_button_text || pdfBtn.textContent;
  const refazerBtn = document.querySelector('.btn-row .btn.btn-secondary');
  if (refazerBtn) refazerBtn.textContent = u.result_refazer_button_text || refazerBtn.textContent;
  const legalEl = document.querySelector('.legal');
  if (legalEl) {
    legalEl.innerHTML = '<strong>' + (u.result_legal_title || 'Aviso') + ':</strong> ' + (u.result_legal_text || '');
  }
  const tabBtns = document.querySelectorAll('.tab-btn');
  if (tabBtns && tabBtns.length >= 2) {
    tabBtns[0].textContent = u.tab_registros || tabBtns[0].textContent;
    tabBtns[1].textContent = u.tab_perfil || tabBtns[1].textContent;
  }
  const profileLabels = document.querySelectorAll('.admin-profile-form label');
  if (profileLabels && profileLabels.length >= 4) {
    profileLabels[0].firstChild.textContent = u.profile_form_login_label || '';
    profileLabels[1].firstChild.textContent = u.profile_form_current_pass_label || '';
    profileLabels[2].firstChild.textContent = u.profile_form_new_login_label || '';
    profileLabels[3].firstChild.textContent = u.profile_form_new_pass_label || '';
  }
  const saveProfileBtn = document.querySelector('.admin-profile-form .btn');
  if (saveProfileBtn) saveProfileBtn.textContent = u.profile_form_save_button || saveProfileBtn.textContent;
  const logoutBtn = document.querySelector('.admin-panel .btn-secondary');
  if (logoutBtn) logoutBtn.textContent = u.btn_logout || logoutBtn.textContent;
}

async function renderLanguagePicker() {
  const container = document.getElementById('languagePicker');
  if (!container) return;
  try {
    const res = await fetch('/api/traducoes');
    const list = await res.json();
    const u = (I18N_DATA && I18N_DATA.ui) || {};
    const label = u.language_picker_label || 'Idioma:';
    const html = ['<span class="lang-picker-label" style="color:var(--muted);font-size:.85rem;margin-right:8px;">' + label + '</span>'];
    html.push('<div style="display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:center;">');
    list.forEach(item => {
      const active = item.locale === CURRENT_LOCALE ? ' active' : '';
      html.push(
        '<button class="lang-btn' + active + '" data-locale="' + item.locale + '" onclick="switchLocale(\'' + item.locale + '\')" ' +
        'style="background:' + (active ? 'var(--accent)' : 'var(--card)') + ';color:#fff;border:1px solid var(--border);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:.85rem;">' +
        item.flag + ' ' + item.language_name.split('(')[0].trim() + '</button>'
      );
    });
    html.push('</div>');
    container.innerHTML = html.join('');
  } catch (e) {
    console.error('Erro ao renderizar language picker', e);
  }
}

async function switchLocale(locale) {
  if (locale === CURRENT_LOCALE) return;
  await loadLocale(locale);
}

window.__currentLocale = () => CURRENT_LOCALE;
document.addEventListener('DOMContentLoaded', async () => {
  let initial = DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem('eneagrama_locale');
    if (stored) initial = stored;
  } catch (e) {}
  const params = new URLSearchParams(location.search);
  const urlLocale = params.get('lang');
  if (urlLocale) initial = urlLocale;
  await loadLocale(initial);
  await renderLanguagePicker();
});
