const chat = document.getElementById("chat");
const answers = document.getElementById("answers");
const navRow = document.getElementById("navRow");
const backBtn = document.getElementById("backBtn");
const restartBtn = document.getElementById("restartBtn");
const reportTrigger = document.getElementById("reportTrigger");
const reportModal = document.getElementById("reportModal");
const reportBackdrop = document.getElementById("reportBackdrop");
const reportClose = document.getElementById("reportClose");
const reportCancel = document.getElementById("reportCancel");
const reportSend = document.getElementById("reportSend");
const reportComment = document.getElementById("reportComment");
const reportStatus = document.getElementById("reportStatus");

const BUG_REPORT_ENDPOINT = "https://script.google.com/macros/s/AKfycbwkNKlGmMsiHPkQWysy-T_O3jlmj_ui8IRjcwJoDzSE-Gii-bksZSJULds9DyaswStp/exec";

const engine = createEskdEngine();

let currentAnswerOptions = [];
let historyStack = [];

function scrollToLatest() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const chatCanScroll = chat.scrollHeight > chat.clientHeight + 4;

      if (chatCanScroll) {
        chat.scrollTo({
          top: chat.scrollHeight,
          behavior: "smooth"
        });
        return;
      }

      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth"
      });
    });
  });
}

function updateControlState() {
  const canGoBack = historyStack.length > 0;
  backBtn.disabled = !canGoBack;
  backBtn.classList.toggle("hidden", !canGoBack);
  restartBtn.classList.toggle("hidden", !canGoBack);
  reportTrigger.classList.toggle("hidden", !canGoBack);

  if (!canGoBack) {
    navRow.classList.add("hidden");
    return;
  }

  chat.appendChild(navRow);
  navRow.classList.remove("hidden");
}

function hideReportTrigger() {
  reportTrigger.classList.add("hidden");
}

function showReportTrigger() {
  reportTrigger.classList.remove("hidden");
  scrollToLatest();
}

function captureSnapshot() {
  return {
    messagesHtml: Array.from(chat.querySelectorAll(".message"))
      .map((message) => message.outerHTML)
      .join(""),
    answersHtml: answers.innerHTML,
    answersHidden: answers.classList.contains("hidden"),
    currentAnswerOptions: [...currentAnswerOptions],
    engineState: engine.exportState()
  };
}

function restoreSnapshot(snapshot) {
  chat.innerHTML = snapshot.messagesHtml;
  answers.innerHTML = snapshot.answersHtml;
  currentAnswerOptions = [...snapshot.currentAnswerOptions];
  engine.importState(snapshot.engineState || {});

  if (snapshot.answersHidden) {
    answers.classList.add("hidden");
  } else {
    chat.appendChild(answers);
    answers.classList.remove("hidden");
  }

  scrollToLatest();
  updateControlState();
}

function pushHistorySnapshot() {
  historyStack.push(captureSnapshot());
  updateControlState();
}

function goBack() {
  if (historyStack.length === 0) {
    return;
  }

  const snapshot = historyStack.pop();
  restoreSnapshot(snapshot);
}

function addMessage(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `message message-${type}`;
  bubble.textContent = text;
  chat.appendChild(bubble);
  scrollToLatest();
}

function addImageMessage(src, alt) {
  const bubble = document.createElement("div");
  bubble.className = "message message-image";

  const image = document.createElement("img");
  image.className = "result-image";
  image.src = src;
  image.alt = alt || "Изображение";
  image.loading = "lazy";

  bubble.appendChild(image);
  chat.appendChild(bubble);
  scrollToLatest();
}

function setAnswerOptions(options) {
  currentAnswerOptions = options;
  answers.innerHTML = "";

  const isCompactSet = options.length > 0 && options.every((option) => (option.label || "").trim().length <= 8);
  answers.classList.toggle("answers-compact", isCompactSet);

  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-option";
    if (isCompactSet) {
      button.classList.add("btn-option-compact");
    }
    button.dataset.optionIndex = String(index);

    if (option.image) {
      const preview = document.createElement("img");
      preview.className = "option-image";
      preview.src = option.image;
      preview.alt = option.label;
      preview.loading = "lazy";
      button.appendChild(preview);
    }

    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.label;
    button.appendChild(label);

    answers.appendChild(button);
  });
}

function showButtons(show) {
  if (show) {
    chat.appendChild(answers);
  }

  answers.classList.toggle("hidden", !show);
  scrollToLatest();
  updateControlState();
}

function showResult(node) {
  addMessage("Ваш децимальный номер:", "system");
  addMessage(node.code, "result");
  if (node.image) {
    addImageMessage(node.image, node.description);
  }
  addMessage(`Описание: ${engine.getPathDescription(node.code) || node.description}`, "system");
  showButtons(false);
  showReportTrigger();
}

function showNotFound() {
  addMessage("Подходящий децимальный номер не найден", "result");
  showButtons(false);
  showReportTrigger();
}

function askAdaptiveQuestion(nodes) {
  const split = engine.getAdaptiveSplit(nodes);
  if (!split) {
    return false;
  }

  addMessage(split.feature.question, "system");

  if (split.mode === "options" && Array.isArray(split.options) && split.options.length > 0) {
    setAnswerOptions(split.options.map((option) => ({
      type: "adaptive",
      label: option.label,
      userText: option.userText || option.label,
      candidateCodes: option.candidateCodes || [],
      featureConstraints: option.featureConstraints || null,
      image: option.image
    })));
    showButtons(true);
    return true;
  }

  setAnswerOptions([
    {
      type: "adaptive",
      label: split.feature.trueLabel || "Да",
      userText: split.feature.trueUserText || split.feature.trueLabel || "Да",
      candidateCodes: split.trueCodes,
      featureConstraints: {
        [split.featureKey]: true
      }
    },
    {
      type: "adaptive",
      label: split.feature.falseLabel || "Нет",
      userText: split.feature.falseUserText || split.feature.falseLabel || "Нет",
      candidateCodes: split.falseCodes,
      featureConstraints: {
        [split.featureKey]: false
      }
    }
  ]);
  showButtons(true);
  return true;
}

function continueAdaptiveSelection(candidateCodes) {
  const candidateNodes = engine.getAdaptiveNodesByCodes(candidateCodes);

  if (candidateNodes.length === 0) {
    showNotFound();
    return;
  }

  if (candidateNodes.length === 1) {
    showResult(candidateNodes[0]);
    return;
  }

  if (askAdaptiveQuestion(candidateNodes)) {
    return;
  }

  askTreeLevel(candidateNodes);
}

function askTreeLevel(options) {
  if (!options || options.length === 0) {
    showNotFound();
    return;
  }

  if (options.length === 1) {
    const [singleOption] = options;
    const children = engine.getChildren(singleOption);

    if (children.length === 0) {
      showResult(singleOption);
      return;
    }

    askTreeLevel(children);
    return;
  }

  const areLeaves = options.every((node) => engine.getChildren(node).length === 0);
  if (areLeaves && askAdaptiveQuestion(options)) {
    return;
  }

  addMessage(engine.getTreeQuestionText(options), "system");
  setAnswerOptions(
    options.map((node) => ({
      type: "tree",
      node,
      label: `${node.code} - ${node.description}`,
      image: node.image
    }))
  );
  showButtons(true);
}

function startTreeSelection() {
  askTreeLevel(engine.getRestrictedRoots());
}

function askFlowQuestion(questionId) {
  const question = engine.getFlowQuestion(questionId);
  if (!question) {
    startTreeSelection();
    return;
  }

  addMessage(question.text, "system");
  setAnswerOptions(
    question.options.map((option) => ({
      ...option,
      type: "flow"
    }))
  );
  showButtons(true);
}

function handleFlowOption(option) {
  addMessage(option.userText || option.label, "user");
  engine.applyFlowOption(option);

  if (!option.next || option.next === "tree") {
    startTreeSelection();
    return;
  }

  askFlowQuestion(option.next);
}

function handleTreeOption(option) {
  const node = option.node;
  addMessage(node.description, "user");

  const children = engine.getChildren(node);
  if (children.length === 0) {
    showResult(node);
    return;
  }

  askTreeLevel(children);
}

function handleAdaptiveOption(option) {
  addMessage(option.userText || option.label, "user");
  engine.applyFeatureConstraints(option.featureConstraints);
  continueAdaptiveSelection(option.candidateCodes || []);
}

function handleAnswerSelection(index) {
  const option = currentAnswerOptions[index];
  if (!option) {
    return;
  }

  pushHistorySnapshot();
  showButtons(false);

  if (option.type === "flow") {
    handleFlowOption(option);
    return;
  }

  if (option.type === "adaptive") {
    handleAdaptiveOption(option);
    return;
  }

  handleTreeOption(option);
}


function getChatTranscript() {
  return Array.from(chat.querySelectorAll(".message")).map((message) => ({
    role: message.classList.contains("message-user") ? "user" : "system",
    text: message.textContent.trim()
  })).filter((entry) => entry.text);
}

function getCurrentResultText() {
  const resultBubble = Array.from(chat.querySelectorAll(".message-result")).at(-1);
  return resultBubble ? resultBubble.textContent.trim() : "";
}

function setReportStatus(text, type = "") {
  reportStatus.textContent = text;
  reportStatus.classList.remove("hidden", "is-error", "is-success");
  if (type) {
    reportStatus.classList.add(type);
  }
}

function resetReportStatus() {
  reportStatus.textContent = "";
  reportStatus.classList.add("hidden");
  reportStatus.classList.remove("is-error", "is-success");
}

function openReportModal() {
  resetReportStatus();
  reportComment.value = "";
  reportModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  requestAnimationFrame(() => reportComment.focus());
}

function closeReportModal() {
  reportModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  resetReportStatus();
}

function buildBugReportPayload(comment) {
  return {
    comment,
    page: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    result: getCurrentResultText(),
    transcript: getChatTranscript()
  };
}

async function sendBugReport() {
  const comment = reportComment.value.trim();
  if (!comment) {
    setReportStatus("\u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u043e\u043f\u0438\u0448\u0438\u0442\u0435 \u043f\u0440\u043e\u0431\u043b\u0435\u043c\u0443", "is-error");
    return;
  }

  if (!BUG_REPORT_ENDPOINT) {
    setReportStatus("\u041d\u0443\u0436\u043d\u043e \u0443\u043a\u0430\u0437\u0430\u0442\u044c URL Google Apps Script \u0432 app.js", "is-error");
    return;
  }

  const payload = buildBugReportPayload(comment);
  reportSend.disabled = true;
  reportCancel.disabled = true;
  reportClose.disabled = true;
  setReportStatus("\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u044e...", "");

  try {
    await fetch(BUG_REPORT_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    setReportStatus("\u0421\u043f\u0430\u0441\u0438\u0431\u043e, \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e", "is-success");
    setTimeout(() => {
      closeReportModal();
    }, 900);
  } catch (error) {
    setReportStatus("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435", "is-error");
  } finally {
    reportSend.disabled = false;
    reportCancel.disabled = false;
    reportClose.disabled = false;
  }
}

function startDialog() {
  chat.innerHTML = "";
  answers.innerHTML = "";
  answers.classList.add("hidden");
  navRow.classList.add("hidden");
  currentAnswerOptions = [];
  historyStack = [];
  engine.resetState();
  updateControlState();

  if (!engine.isReady()) {
    addMessage("Не удалось загрузить данные классификатора", "system");
    return;
  }

  addMessage("Привет! Давай определим подходящий децимальный номер по нескольким вопросам.", "system");
  askFlowQuestion(engine.getStartQuestionId());
}

Promise.all([
  fetch("eskd_tree.json").then((res) => {
    if (!res.ok) throw new Error("Не удалось загрузить eskd_tree.json");
    return res.json();
  }),
  fetch("question_flow.json").then((res) => {
    if (!res.ok) throw new Error("Не удалось загрузить question_flow.json");
    return res.json();
  }),
  fetch("adaptive_rules.json").then((res) => {
    if (!res.ok) throw new Error("Не удалось загрузить adaptive_rules.json");
    return res.json();
  })
])
  .then(([treeData, flowData, adaptiveData]) => {
    engine.loadData(treeData, flowData, adaptiveData);
    startDialog();
  })
  .catch(() => {
    addMessage("Ошибка загрузки данных классификатора", "system");
    answers.classList.add("hidden");
    updateControlState();
  });

answers.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-option-index]");
  if (!button) {
    return;
  }

  handleAnswerSelection(Number(button.dataset.optionIndex));
});

backBtn.addEventListener("click", goBack);
restartBtn.addEventListener("click", startDialog);



reportTrigger.addEventListener("click", openReportModal);
reportBackdrop.addEventListener("click", closeReportModal);
reportClose.addEventListener("click", closeReportModal);
reportCancel.addEventListener("click", closeReportModal);
reportSend.addEventListener("click", sendBugReport);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !reportModal.classList.contains("hidden")) {
    closeReportModal();
  }
});
