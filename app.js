const chat = document.getElementById("chat");
const answers = document.getElementById("answers");
const navRow = document.getElementById("navRow");
const backBtn = document.getElementById("backBtn");
const restartBtn = document.getElementById("restartBtn");

let treeRoots = [];
let questionFlow = null;
let activeFilters = [];
let activeBranchPrefixes = null;
let currentAnswerOptions = [];
let historyStack = [];
const nodeIndex = new Map();
const pathIndex = new Map();

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

function normalizeText(value) {
  return (value || "").toLowerCase().replace(/ё/g, "е");
}

function cloneFilters(filters) {
  return filters.map((filter) => ({
    includeAny: [...(filter.includeAny || [])],
    excludeAny: [...(filter.excludeAny || [])]
  }));
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
    activeFilters: cloneFilters(activeFilters),
    activeBranchPrefixes: activeBranchPrefixes ? [...activeBranchPrefixes] : null
  };
}

function restoreSnapshot(snapshot) {
  chat.innerHTML = snapshot.messagesHtml;
  answers.innerHTML = snapshot.answersHtml;
  currentAnswerOptions = [...snapshot.currentAnswerOptions];
  activeFilters = cloneFilters(snapshot.activeFilters);
  activeBranchPrefixes = snapshot.activeBranchPrefixes ? [...snapshot.activeBranchPrefixes] : null;

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

  options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-option";
    button.dataset.optionIndex = String(index);
    button.textContent = option.label;
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
  const fullPath = pathIndex.get(node.code);
  const fullDescription = fullPath && fullPath.length > 0
    ? fullPath.join(" -> ")
    : node.description;
  addMessage(`Описание: ${fullDescription}`, "system");
  showButtons(false);
}

function showNotFound() {
  addMessage("Подходящий децимальный номер не найден", "result");
  showButtons(false);
}

function getChildren(node) {
  if (!node || !node.children) return [];
  return Object.values(node.children).filter(Boolean);
}

function buildNodeIndex(nodes, parentPath = []) {
  nodes.forEach((node) => {
    nodeIndex.set(node.code, node);
    const currentPath = [...parentPath, node.description].filter(Boolean);
    pathIndex.set(node.code, currentPath);
    buildNodeIndex(getChildren(node), currentPath);
  });
}

function applyBranchPrefixes(prefixes) {
  if (!prefixes || prefixes.length === 0) {
    return;
  }

  if (!activeBranchPrefixes || activeBranchPrefixes.length === 0) {
    activeBranchPrefixes = [...new Set(prefixes)];
    return;
  }

  const merged = [];

  activeBranchPrefixes.forEach((currentPrefix) => {
    prefixes.forEach((nextPrefix) => {
      if (currentPrefix.startsWith(nextPrefix)) {
        merged.push(currentPrefix);
      } else if (nextPrefix.startsWith(currentPrefix)) {
        merged.push(nextPrefix);
      }
    });
  });

  activeBranchPrefixes = [...new Set(merged)];
}

function applyBranchSuffixes(suffixes) {
  if (!suffixes || suffixes.length === 0 || !activeBranchPrefixes || activeBranchPrefixes.length === 0) {
    return;
  }

  const expanded = [];

  activeBranchPrefixes.forEach((prefix) => {
    suffixes.forEach((suffix) => {
      const code = `${prefix}${suffix}`;
      if (nodeIndex.has(code)) {
        expanded.push(code);
      }
    });
  });

  if (expanded.length > 0) {
    activeBranchPrefixes = [...new Set(expanded)];
  }
}

function pathMatchesFilters(pathText, filters) {
  if (filters.length === 0) {
    return true;
  }

  return filters.every((filter) => {
    const includeOk = !filter.includeAny || filter.includeAny.length === 0
      ? true
      : filter.includeAny.some((keyword) => pathText.includes(normalizeText(keyword)));

    const excludeHit = filter.excludeAny && filter.excludeAny.length > 0
      ? filter.excludeAny.some((keyword) => pathText.includes(normalizeText(keyword)))
      : false;

    return includeOk && !excludeHit;
  });
}

function filterTreeNode(node, filters, parentPath = "") {
  const currentPath = normalizeText(`${parentPath} ${node.description || ""}`.trim());
  const children = getChildren(node);

  if (children.length === 0) {
    if (!pathMatchesFilters(currentPath, filters)) {
      return null;
    }

    return {
      code: node.code,
      description: node.description,
      image: node.image,
      children: {}
    };
  }

  const filteredChildren = children
    .map((child) => filterTreeNode(child, filters, currentPath))
    .filter(Boolean);

  if (filteredChildren.length === 0 && !pathMatchesFilters(currentPath, filters)) {
    return null;
  }

  return {
    code: node.code,
    description: node.description,
    image: node.image,
    children: Object.fromEntries(filteredChildren.map((child) => [child.code, child]))
  };
}

function getBranchStartNodes() {
  if (!activeBranchPrefixes || activeBranchPrefixes.length === 0) {
    return null;
  }

  const nodes = activeBranchPrefixes
    .map((prefix) => nodeIndex.get(prefix))
    .filter(Boolean);

  return nodes.length > 0 ? nodes : null;
}

function applyRestrictionsToRoots() {
  const branchNodes = getBranchStartNodes();
  const sourceNodes = branchNodes || treeRoots;

  if (activeFilters.length === 0) {
    return sourceNodes;
  }

  const filteredNodes = sourceNodes
    .map((node) => filterTreeNode(node, activeFilters))
    .filter(Boolean);

  if (filteredNodes.length > 0) {
    return filteredNodes;
  }

  if (branchNodes) {
    addMessage("По уточняющим признакам совпадений не нашлось. Покажу ближайшие ветки выбранного раздела.", "system");
    return branchNodes;
  }

  addMessage("По уточняющим признакам совпадений не нашлось. Покажу общие разделы.", "system");
  return treeRoots;
}

function getTreeQuestionText(options) {
  if (options.length === 0) {
    return "Подходящие варианты не найдены";
  }

  const codeLength = options[0].code.length;
  const prefixes = activeBranchPrefixes || [];
  const isRotationBranch = prefixes.length > 0 && prefixes.every((prefix) => prefix.startsWith("71") || prefix.startsWith("72"));

  if (isRotationBranch && codeLength === 3) {
    return "Какая группа деталей ближе по описанию?";
  }

  if (isRotationBranch && codeLength === 4) {
    return "Какое описание формы ближе всего?";
  }

  if (isRotationBranch && codeLength === 5) {
    return "Какой дополнительный признак лучше подходит?";
  }

  if (isRotationBranch) {
    return "Какое описание подходит точнее?";
  }

  if (codeLength <= 2) {
    return "Выбери наиболее подходящий раздел";
  }

  if (codeLength === 3) {
    return "Что лучше всего описывает изделие?";
  }

  if (codeLength === 4) {
    return "Какой вариант описания ближе?";
  }

  if (codeLength === 5) {
    return "Какой признак подходит лучше?";
  }

  return "Какое описание подходит точнее?";
}

function askTreeLevel(options) {
  if (!options || options.length === 0) {
    showNotFound();
    return;
  }

  if (options.length === 1) {
    const [singleOption] = options;
    const children = getChildren(singleOption);

    if (children.length === 0) {
      showResult(singleOption);
      return;
    }

    askTreeLevel(children);
    return;
  }

  addMessage(getTreeQuestionText(options), "system");
  setAnswerOptions(
    options.map((node) => ({
      type: "tree",
      node,
      label: `${node.code} — ${node.description}`
    }))
  );
  showButtons(true);
}

function startTreeSelection() {
  const restrictedNodes = applyRestrictionsToRoots();
  askTreeLevel(restrictedNodes);
}

function askFlowQuestion(questionId) {
  const question = questionFlow.questions[questionId];
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

  if (option.branchPrefixes) {
    applyBranchPrefixes(option.branchPrefixes);
  }

  if (option.branchSuffixes) {
    applyBranchSuffixes(option.branchSuffixes);
  }

  if (option.filters) {
    activeFilters.push({
      includeAny: option.filters.includeAny || [],
      excludeAny: option.filters.excludeAny || []
    });
  }

  if (!option.next || option.next === "tree") {
    startTreeSelection();
    return;
  }

  askFlowQuestion(option.next);
}

function handleTreeOption(option) {
  const node = option.node;
  addMessage(node.description, "user");

  const children = getChildren(node);
  if (children.length === 0) {
    showResult(node);
    return;
  }

  askTreeLevel(children);
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

  handleTreeOption(option);
}

function startDialog() {
  chat.innerHTML = "";
  answers.innerHTML = "";
  answers.classList.add("hidden");
  navRow.classList.add("hidden");
  activeFilters = [];
  activeBranchPrefixes = null;
  currentAnswerOptions = [];
  historyStack = [];
  updateControlState();

  if (!questionFlow || treeRoots.length === 0) {
    addMessage("Не удалось загрузить данные классификатора", "system");
    return;
  }

  addMessage("Привет! Сначала задам несколько смысловых вопросов, чтобы резко сузить поиск децимального номера.", "system");
  askFlowQuestion(questionFlow.start);
}

Promise.all([
  fetch("eskd_tree.json").then((res) => {
    if (!res.ok) {
      throw new Error("Не удалось загрузить eskd_tree.json");
    }
    return res.json();
  }),
  fetch("question_flow.json").then((res) => {
    if (!res.ok) {
      throw new Error("Не удалось загрузить question_flow.json");
    }
    return res.json();
  })
])
  .then(([treeData, flowData]) => {
    treeRoots = Object.values(treeData).filter(Boolean);
    buildNodeIndex(treeRoots);
    questionFlow = flowData;
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
updateControlState();
