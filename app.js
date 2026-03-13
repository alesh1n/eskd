const chat = document.getElementById("chat");
const answers = document.getElementById("answers");
const restartBtn = document.getElementById("restartBtn");

let treeRoots = [];
let questionFlow = null;
let activeFilters = [];
let activeBranchPrefixes = null;
let currentAnswerOptions = [];
const nodeIndex = new Map();

function scrollToLatest() {
  const lastItem = chat.lastElementChild;
  if (!lastItem) return;

  requestAnimationFrame(() => {
    lastItem.scrollIntoView({ behavior: "smooth", block: "end" });
  });
}

function normalizeText(value) {
  return (value || "").toLowerCase().replace(/ё/g, "е");
}

function addMessage(text, type) {
  const bubble = document.createElement("div");
  bubble.className = `message message-${type}`;
  bubble.textContent = text;
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
}

function showRestart(show) {
  restartBtn.classList.toggle("hidden", !show);
  if (show) {
    requestAnimationFrame(() => {
      restartBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
}

function showResult(node) {
  addMessage(`Децимальный номер: ${node.code}`, "result");
  addMessage(`Описание: ${node.description}`, "system");
  showButtons(false);
  showRestart(true);
}

function showNotFound() {
  addMessage("Подходящий децимальный номер не найден", "result");
  showButtons(false);
  showRestart(true);
}

function getChildren(node) {
  if (!node || !node.children) return [];
  return Object.values(node.children).filter(Boolean);
}

function buildNodeIndex(nodes) {
  nodes.forEach((node) => {
    nodeIndex.set(node.code, node);
    buildNodeIndex(getChildren(node));
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
  showRestart(false);
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
  showRestart(false);
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

  showButtons(false);

  if (option.type === "flow") {
    handleFlowOption(option);
    return;
  }

  handleTreeOption(option);
}

function startDialog() {
  chat.innerHTML = "";
  activeFilters = [];
  activeBranchPrefixes = null;
  currentAnswerOptions = [];

  if (!questionFlow || treeRoots.length === 0) {
    addMessage("Не удалось загрузить данные классификатора", "system");
    showButtons(false);
    showRestart(false);
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
    showButtons(false);
    showRestart(false);
  });

answers.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-option-index]");
  if (!button) {
    return;
  }

  handleAnswerSelection(Number(button.dataset.optionIndex));
});

restartBtn.addEventListener("click", startDialog);
