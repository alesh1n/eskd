const chat = document.getElementById("chat");
const answers = document.getElementById("answers");
const navRow = document.getElementById("navRow");
const backBtn = document.getElementById("backBtn");
const restartBtn = document.getElementById("restartBtn");

let treeRoots = [];
let questionFlow = null;
let adaptiveRules = {};
let activeFilters = [];
let activeBranchPrefixes = null;
let activeFeatureAnswers = {};
let currentAnswerOptions = [];
let historyStack = [];
const nodeIndex = new Map();
const pathIndex = new Map();
const parentIndex = new Map();
const DEBUG_ADAPTIVE = false;

const featureCatalog71 = {
  has_center_hole: {
    question: "Есть ли центральное отверстие?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Есть центральное отверстие",
    falseUserText: "Центрального отверстия нет"
  },
  has_face_ring_grooves: {
    question: "Есть ли кольцевые пазы на торцах?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Есть кольцевые пазы на торцах",
    falseUserText: "Кольцевых пазов на торцах нет"
  },
  has_outer_slots_or_splines: {
    question: "Есть ли пазы или шлицы на наружной поверхности?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Есть пазы или шлицы на наружной поверхности",
    falseUserText: "Пазов и шлицев на наружной поверхности нет"
  },
  has_off_axis_holes: {
    question: "Есть ли отверстия вне оси детали?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Есть отверстия вне оси детали",
    falseUserText: "Отверстий вне оси детали нет"
  },
  is_blind_hole: {
    question: "Центральное отверстие глухое?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Центральное отверстие глухое",
    falseUserText: "Центральное отверстие не глухое"
  },
  has_thread_in_hole: {
    question: "Есть ли резьба в центральном отверстии?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Есть резьба в центральном отверстии",
    falseUserText: "Резьбы в центральном отверстии нет"
  },
  is_stepped_hole: {
    question: "Центральное отверстие ступенчатое?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Центральное отверстие ступенчатое",
    falseUserText: "Центральное отверстие не ступенчатое"
  },
  is_round_hole: {
    question: "Центральное отверстие круглое?",
    trueLabel: "Да",
    falseLabel: "Нет",
    trueUserText: "Центральное отверстие круглое",
    falseUserText: "Центральное отверстие некруглое"
  }
};

function normalizeDescriptionText(value) {
  let text = normalizeText(value);
  const replacements = [
    [/отв\./g, "отверстие"],
    [/центр\./g, "центральное"],
    [/нар\./g, "наружной"],
    [/пов\./g, "поверхности"],
    [/дет\./g, "детали"],
    [/круг\./g, "круглое"],
    [/некругл\./g, "некруглое"],
    [/конич\./g, "конической"],
    [/криволин\./g, "криволинейной"],
    [/комбинир\./g, "комбинированной"],
    [/закр\./g, "закрытыми"],
    [/резьб\./g, "резьбой"],
    [/пазами и\/или шлицами/g, "пазами шлицами"],
    [/пазов и\/или шлицев/g, "пазов шлицев"],
    [/шлицев|шлицами|шлицам|шлицы/g, "шлицы"],
    [/паз\./g, "пазы"],
    [/l/g, "l"]
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .replace(/\s+/g, " ")
    .replace(/\s*([,;|])\s*/g, " $1 ")
    .trim();
}

function setFeatureValue(target, key, value) {
  if (value === undefined) {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(target, key)) {
    target[key] = value;
  }
}

function parseEskdClauses(pathSegments) {
  const clauses = [];
  const seen = new Set();
  const polarityBoundary = /\s+(?=(?:без|с)\s+(?:отверст\w*|паз\w*|шлиц\w*|кольцев\w*|резьб\w*|центр\w*))/g;

  pathSegments.forEach((segment) => {
    const normalizedSegment = normalizeDescriptionText(segment);
    const parts = normalizedSegment
      .split(/[,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const expandedParts = [];

    parts.forEach((part) => {
      const splitParts = part
        .split(polarityBoundary)
        .map((item) => item.trim())
        .filter(Boolean);

      if (splitParts.length > 0) {
        expandedParts.push(...splitParts);
      } else {
        expandedParts.push(part);
      }
    });

    [normalizedSegment, ...expandedParts].forEach((clause) => {
      if (!clause || seen.has(clause)) {
        return;
      }

      seen.add(clause);
      clauses.push(clause);
    });
  });

  return clauses;
}

function normalizeClauseToken(token) {
  if (!token) {
    return "";
  }

  const cleanToken = token.replace(/[.,?()"]/g, "");
  if (cleanToken === "и/или") {
    return "";
  }

  if (cleanToken.startsWith("паз")) return "паз";
  if (cleanToken.startsWith("шлиц")) return "шлиц";
  if (cleanToken.startsWith("наружн")) return "наружн";
  if (cleanToken.startsWith("поверхност")) return "поверхност";
  if (cleanToken.startsWith("отверст")) return "отверст";
  if (cleanToken.startsWith("кольцев")) return "кольцев";
  if (cleanToken.startsWith("торц")) return "торц";
  if (cleanToken.startsWith("центр")) return "центр";
  if (cleanToken.startsWith("глух")) return "глух";
  if (cleanToken.startsWith("сквоз")) return "сквоз";
  if (cleanToken.startsWith("резьб")) return "резьб";
  if (cleanToken.startsWith("ступенчат")) return "ступенчат";
  if (cleanToken.startsWith("гладк")) return "гладк";
  if (cleanToken.startsWith("кругл")) return "кругл";
  if (cleanToken.startsWith("некругл")) return "некругл";
  if (cleanToken === "вне") return "вне";
  if (cleanToken === "оси") return "оси";
  if (cleanToken.startsWith("детал")) return "";
  if (cleanToken.startsWith("одн")) return "";
  if (cleanToken === "двух") return "";
  if (cleanToken.startsWith("сторон")) return "";

  return cleanToken;
}

function getClausePolarityDescriptor(clause) {
  const trimmedClause = clause.trim();
  if (trimmedClause.startsWith("без ")) {
    return {
      polarity: false,
      body: trimmedClause.slice(4).trim()
    };
  }

  if (trimmedClause.startsWith("с ")) {
    return {
      polarity: true,
      body: trimmedClause.slice(2).trim()
    };
  }

  return null;
}

function buildClauseCore(body) {
  const stopWords = new Set(["и", "или", "и/или", "или/и", "на", "в", "по", "для", "от", "до", "со"]);

  return body
    .split(/\s+/)
    .map((token) => normalizeClauseToken(token))
    .filter((token) => token && !stopWords.has(token))
    .join(" ");
}

function prettifyClauseBody(body) {
  return body
    .replace(/с отверст[а-я]*/g, "с отверстиями")
    .replace(/без отверст[а-я]*/g, "без отверстий")
    .replace(/отверст[а-я]* вне оси/g, "отверстиями вне оси")
    .replace(/с паз[а-я]* шлиц[а-я]*/g, "с пазами или шлицами")
    .replace(/без паз[а-я]* шлиц[а-я]*/g, "без пазов и шлицев")
    .replace(/паз[а-я]* шлиц[а-я]*/g, "пазами или шлицами")
    .replace(/\s+/g, " ")
    .trim();
}

function getDynamicClauseSplit(nodes) {
  const candidateCodes = nodes.map((node) => node.code);
  const clauseGroups = new Map();
  nodes.forEach((node) => {
    const clauses = parseEskdClauses(pathIndex.get(node.code) || []);

    clauses.forEach((clause) => {
      const descriptor = getClausePolarityDescriptor(clause);
      if (!descriptor) {
        return;
      }

      const core = buildClauseCore(descriptor.body);
      if (!core) {
        return;
      }

      if (!clauseGroups.has(core)) {
        clauseGroups.set(core, {
          positiveText: null,
          negativeText: null,
          values: {}
        });
      }

      const group = clauseGroups.get(core);
      group.values[node.code] = descriptor.polarity;

      if (descriptor.polarity && !group.positiveText) {
        group.positiveText = `с ${descriptor.body}`;
      }

      if (!descriptor.polarity && !group.negativeText) {
        group.negativeText = `без ${descriptor.body}`;
      }
    });
  });

  let bestSplit = null;

  clauseGroups.forEach((group, core) => {
    const values = candidateCodes.map((code) => group.values[code]);
    if (values.some((value) => value === undefined)) {
      return;
    }

    const trueCodes = candidateCodes.filter((code) => group.values[code] === true);
    const falseCodes = candidateCodes.filter((code) => group.values[code] === false);

    if (trueCodes.length === 0 || falseCodes.length === 0) {
      return;
    }

      const balance = Math.abs(trueCodes.length - falseCodes.length);
      const questionBody = group.positiveText || group.negativeText;
      const prettyQuestionBody = questionBody ? prettifyClauseBody(questionBody) : "";
      const prettyPositiveBody = group.positiveText ? prettifyClauseBody(group.positiveText) : "";
      const prettyNegativeBody = group.negativeText ? prettifyClauseBody(group.negativeText) : "";
      const split = {
        parentCode: getSharedParentCode(nodes) || "dynamic",
        featureKey: `dynamic:${core}`,
        feature: {
          question: prettyQuestionBody
            ? `Верно ли, что деталь ${prettyQuestionBody}?`
            : "Какой признак лучше подходит?",
          trueLabel: "Да",
          falseLabel: "Нет",
          trueUserText: prettyPositiveBody ? `Да, деталь ${prettyPositiveBody}` : "Да",
          falseUserText: prettyNegativeBody ? `Нет, деталь ${prettyNegativeBody}` : "Нет"
        },
        trueCodes,
        falseCodes,
      balance
    };

      if (!bestSplit || split.balance < bestSplit.balance) {
        bestSplit = split;
      }
    });

  return bestSplit;
}

function mapClauseToFeatures(clause, features) {
  if (/без центральн\w* отверст/.test(clause)) {
    setFeatureValue(features, "has_center_hole", false);
  }

  if (/центральн\w* глух\w* отверст/.test(clause) || /глух\w* отверст/.test(clause)) {
    setFeatureValue(features, "has_center_hole", true);
    setFeatureValue(features, "is_blind_hole", true);
  }

  if (/центральн\w* сквоз\w* отверст/.test(clause) || /сквоз\w* отверст/.test(clause)) {
    setFeatureValue(features, "has_center_hole", true);
    setFeatureValue(features, "is_blind_hole", false);
  }

  if (/центральн\w* отверст/.test(clause) && !/без центральн\w* отверст/.test(clause)) {
    setFeatureValue(features, "has_center_hole", true);
  }

  if (/без резьб/.test(clause)) {
    setFeatureValue(features, "has_thread_in_hole", false);
  }

  if (/с резьб/.test(clause) || /резьбов/.test(clause)) {
    setFeatureValue(features, "has_thread_in_hole", true);
  }

  if (/ступенчат/.test(clause)) {
    setFeatureValue(features, "is_stepped_hole", true);
  }

  if (/гладк/.test(clause)) {
    setFeatureValue(features, "is_stepped_hole", false);
  }

  if (/некругл/.test(clause)) {
    setFeatureValue(features, "is_round_hole", false);
  }

  if (/кругл/.test(clause) && !/некругл/.test(clause)) {
    setFeatureValue(features, "is_round_hole", true);
  }

  if (/без кольцев\w* паз\w* на торц/.test(clause)) {
    setFeatureValue(features, "has_face_ring_grooves", false);
  }

  if (/с кольцев\w* паз\w* на торц/.test(clause)) {
    setFeatureValue(features, "has_face_ring_grooves", true);
  }

  if (
    /без паз\w* и шлиц\w* на наружн\w* поверхност/.test(clause) ||
    /без паз\w* на наружн\w* поверхност/.test(clause) ||
    /без шлиц\w* на наружн\w* поверхност/.test(clause)
  ) {
    setFeatureValue(features, "has_outer_slots_or_splines", false);
  }

  if (
    /с паз\w*(?: и\/или шлиц\w*| шлиц\w*)? на наружн\w* поверхност/.test(clause) ||
    /с шлиц\w* на наружн\w* поверхност/.test(clause)
  ) {
    setFeatureValue(features, "has_outer_slots_or_splines", true);
  }

  if (/без отверст\w* вне оси/.test(clause)) {
    setFeatureValue(features, "has_off_axis_holes", false);
  }

  if (/с отверст\w* вне оси/.test(clause)) {
    setFeatureValue(features, "has_off_axis_holes", true);
  }
}

function extract71FeaturesFromPath(pathSegments) {
  const features = {};
  const clauses = parseEskdClauses(pathSegments);

  clauses.forEach((clause) => {
    mapClauseToFeatures(clause, features);
  });

  return features;
}

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

function cloneFeatureAnswers(featureAnswers) {
  return { ...featureAnswers };
}

function getNodesByCodes(codes) {
  return codes
    .map((code) => nodeIndex.get(code))
    .filter(Boolean);
}

function evaluateAdaptiveSplit(features, items, candidateCodes, parentCode) {
  let bestSplit = null;

  Object.entries(features).forEach(([featureKey, feature]) => {
    if (Object.prototype.hasOwnProperty.call(activeFeatureAnswers, featureKey)) {
      return;
    }

    const trueCodes = [];
    const falseCodes = [];
    let hasUnknown = false;

    candidateCodes.forEach((code) => {
      const value = items[code]?.[featureKey];
      if (value === true) {
        trueCodes.push(code);
      } else if (value === false) {
        falseCodes.push(code);
      } else {
        hasUnknown = true;
      }
    });

    if (hasUnknown || trueCodes.length === 0 || falseCodes.length === 0) {
      return;
    }

    const balance = Math.abs(trueCodes.length - falseCodes.length);
    const split = {
      parentCode,
      featureKey,
      feature,
      trueCodes,
      falseCodes,
      balance
    };

    if (!bestSplit || split.balance < bestSplit.balance) {
      bestSplit = split;
    }
  });

  return bestSplit;
}

function getSharedParentCode(nodes) {
  const parentCodes = [...new Set(nodes.map((node) => parentIndex.get(node.code)).filter(Boolean))];
  return parentCodes.length === 1 ? parentCodes[0] : null;
}

function getHeuristic71Split(nodes) {
  if (!nodes.every((node) => node.code.startsWith("71"))) {
    return null;
  }

  const candidateCodes = nodes.map((node) => node.code);
  const items = {};

  nodes.forEach((node) => {
    items[node.code] = extract71FeaturesFromPath(pathIndex.get(node.code) || []);
  });

  return evaluateAdaptiveSplit(featureCatalog71, items, candidateCodes, getSharedParentCode(nodes) || "71");
}

function getAdaptiveSplit(nodes) {
  const dynamicSplit = getDynamicClauseSplit(nodes);
  if (dynamicSplit) {
    return dynamicSplit;
  }

  const parentCode = getSharedParentCode(nodes);
  const candidateCodes = nodes.map((node) => node.code);

  if (parentCode) {
    const rule = adaptiveRules[parentCode];
    if (rule && rule.features && rule.items && candidateCodes.every((code) => rule.items[code])) {
      const explicitSplit = evaluateAdaptiveSplit(rule.features, rule.items, candidateCodes, parentCode);
      if (explicitSplit) {
        return explicitSplit;
      }
    }
  }

  return getHeuristic71Split(nodes);
}

function getFeatureDefinition(featureKey) {
  if (featureCatalog71[featureKey]) {
    return featureCatalog71[featureKey];
  }

  for (const rule of Object.values(adaptiveRules)) {
    if (rule?.features?.[featureKey]) {
      return rule.features[featureKey];
    }
  }

  return null;
}

function getFeatureValueForNode(node, featureKey) {
  const parentCode = parentIndex.get(node.code);
  const explicitValue = parentCode ? adaptiveRules[parentCode]?.items?.[node.code]?.[featureKey] : undefined;
  if (explicitValue === true || explicitValue === false) {
    return explicitValue;
  }

  if (node.code.startsWith("71")) {
    return extract71FeaturesFromPath(pathIndex.get(node.code) || [])[featureKey];
  }

  return undefined;
}

function applyActiveFeatureAnswers(nodes) {
  const entries = Object.entries(activeFeatureAnswers);
  if (entries.length === 0) {
    return nodes;
  }

  const filteredNodes = nodes.filter((node) => (
    entries.every(([featureKey, expectedValue]) => {
      const actualValue = getFeatureValueForNode(node, featureKey);
      return actualValue === undefined || actualValue === expectedValue;
    })
  ));

  return filteredNodes.length > 0 ? filteredNodes : nodes;
}

function askAdaptiveQuestion(nodes) {
  const split = getAdaptiveSplit(nodes);
  if (!split) {
    return false;
  }

  addMessage(split.feature.question, "system");
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
  const candidateNodes = applyActiveFeatureAnswers(getNodesByCodes(candidateCodes));

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
      activeBranchPrefixes: activeBranchPrefixes ? [...activeBranchPrefixes] : null,
      activeFeatureAnswers: cloneFeatureAnswers(activeFeatureAnswers)
    };
}

function restoreSnapshot(snapshot) {
  chat.innerHTML = snapshot.messagesHtml;
  answers.innerHTML = snapshot.answersHtml;
  currentAnswerOptions = [...snapshot.currentAnswerOptions];
  activeFilters = cloneFilters(snapshot.activeFilters);
  activeBranchPrefixes = snapshot.activeBranchPrefixes ? [...snapshot.activeBranchPrefixes] : null;
  activeFeatureAnswers = cloneFeatureAnswers(snapshot.activeFeatureAnswers || {});

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

function buildNodeIndex(nodes, parentPath = [], parentCode = null) {
  nodes.forEach((node) => {
    nodeIndex.set(node.code, node);
    parentIndex.set(node.code, parentCode);
    const currentPath = [...parentPath, node.description].filter(Boolean);
    pathIndex.set(node.code, currentPath);
    buildNodeIndex(getChildren(node), currentPath, node.code);
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
    const prefixNode = nodeIndex.get(prefix);
    const children = getChildren(prefixNode);

    suffixes.forEach((suffix) => {
      if (prefix.endsWith(suffix)) {
        expanded.push(prefix);
        return;
      }

      const directChildCode = `${prefix}${suffix}`;
      if (nodeIndex.has(directChildCode)) {
        expanded.push(directChildCode);
        return;
      }

      children.forEach((child) => {
        if (child.code.endsWith(suffix)) {
          expanded.push(child.code);
        }
      });
    });
  });

  if (expanded.length === 0) {
    const siblingMatches = [];

    activeBranchPrefixes.forEach((prefix) => {
      const parentCode = parentIndex.get(prefix);
      const parentNode = parentCode ? nodeIndex.get(parentCode) : null;
      const siblings = getChildren(parentNode);

      siblings.forEach((sibling) => {
        suffixes.forEach((suffix) => {
          if (sibling.code.endsWith(suffix)) {
            siblingMatches.push(sibling.code);
          }
        });
      });
    });

    if (siblingMatches.length > 0) {
      activeBranchPrefixes = [...new Set(siblingMatches)];
      return;
    }
  }

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
    return branchNodes;
  }

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
  options = applyActiveFeatureAnswers(options);

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

  const areLeaves = options.every((node) => getChildren(node).length === 0);
  if (areLeaves && askAdaptiveQuestion(options)) {
    return;
  }

  addMessage(getTreeQuestionText(options), "system");
  setAnswerOptions(
    options.map((node) => ({
      type: "tree",
      node,
      label: `${node.code} — ${node.description}`,
      image: node.image
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

  if (option.featureConstraints) {
    Object.assign(activeFeatureAnswers, option.featureConstraints);
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

function handleAdaptiveOption(option) {
  addMessage(option.userText || option.label, "user");
  if (option.featureConstraints) {
    Object.assign(activeFeatureAnswers, option.featureConstraints);
  }
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
  activeFilters = [];
  activeBranchPrefixes = null;
  activeFeatureAnswers = {};
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
  }),
  fetch("adaptive_rules.json").then((res) => {
    if (!res.ok) {
      throw new Error("Не удалось загрузить adaptive_rules.json");
    }
    return res.json();
  })
])
  .then(([treeData, flowData, adaptiveData]) => {
    treeRoots = Object.values(treeData).filter(Boolean);
    buildNodeIndex(treeRoots);
    questionFlow = flowData;
    adaptiveRules = adaptiveData || {};
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
