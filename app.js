const chat = document.getElementById("chat");
const answers = document.getElementById("answers");
const navRow = document.getElementById("navRow");
const backBtn = document.getElementById("backBtn");
const restartBtn = document.getElementById("restartBtn");

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
  restartBtn.classList.toggle("hidden", !canGoBack);

  if (!canGoBack) {
    navRow.classList.add("hidden");
    return;
  }

  chat.appendChild(navRow);
  navRow.classList.remove("hidden");
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
}

function showNotFound() {
  addMessage("Подходящий децимальный номер не найден", "result");
  showButtons(false);
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


