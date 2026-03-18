function createEskdEngine() {
  let treeRoots = [];
  let questionFlow = null;
  let adaptiveRules = {};
  let activeFilters = [];
  let activeBranchPrefixes = null;
  let activeFeatureAnswers = {};
  const nodeIndex = new Map();
  const pathIndex = new Map();
  const parentIndex = new Map();

  const rotationFeatureCatalog = {
    is_sphere: {
      question: "Это шар?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Это шар",
      falseUserText: "Это не шар"
    },
    is_hollow_sphere: {
      question: "Шар полый?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Шар полый",
      falseUserText: "Шар сплошной"
    },
    has_suspension_element: {
      question: "Есть элемент для подвески?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Есть элемент для подвески",
      falseUserText: "Элемента для подвески нет"
    },
    has_hub_face_slots_or_lugs: {
      question: "Есть пазы или выступы на торце ступицы?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Есть пазы или выступы на торце ступицы",
      falseUserText: "Пазов и выступов на торце ступицы нет"
    },
    is_ring_sector: {
      question: "Это кольцевой сектор или сегмент?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Это кольцевой сектор или сегмент",
      falseUserText: "Это не кольцевой сектор или сегмент"
    },
    has_inner_base: {
      question: "Основание внутреннее?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Основание внутреннее",
      falseUserText: "Основание наружное"
    },
    has_flanges: {
      question: "Есть фланцы?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Есть фланцы",
      falseUserText: "Фланцев нет"
    },
    base_by_tooth_profile: {
      question: "Основная база по профилю зубьев?",
      trueLabel: "Да",
      falseLabel: "Нет",
      trueUserText: "Основная база по профилю зубьев",
      falseUserText: "Основная база не по профилю зубьев"
    },
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

  function normalizeDescriptionText(value) {
    let text = normalizeText(value);
    const replacements = [
      [/отв\./g, "отверстие"],
      [/отв\b/g, "отверстие"],
      [/центр\./g, "центральное"],
      [/нар\./g, "наружной"],
      [/внутр\./g, "внутренней"],
      [/осн\./g, "основания"],
      [/пов\./g, "поверхности"],
      [/поверх\./g, "поверхности"],
      [/дет\./g, "детали"],
      [/дет\b/g, "детали"],
      [/кольц\./g, "кольцевыми"],
      [/торц\./g, "торцах"],
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
    if (cleanToken === "и/или") return "";
    if (cleanToken.startsWith("паз")) return "паз";
    if (cleanToken.startsWith("шлиц")) return "шлиц";
    if (cleanToken.startsWith("наружн")) return "наружн";
    if (cleanToken.startsWith("поверхност") || cleanToken.startsWith("поверх")) return "поверхност";
    if (cleanToken.startsWith("отверст") || cleanToken === "отв") return "отверст";
    if (cleanToken.startsWith("кольцев") || cleanToken.startsWith("кольц")) return "кольцев";
    if (cleanToken.startsWith("торц")) return "торц";
    if (cleanToken.startsWith("центр")) return "центр";
    if (cleanToken.startsWith("глух")) return "глух";
    if (cleanToken.startsWith("сквоз")) return "сквоз";
    if (cleanToken.startsWith("резьб")) return "резьб";
    if (cleanToken.startsWith("ступенчат")) return "ступенчат";
    if (cleanToken.startsWith("гладк")) return "гладк";
    if (cleanToken.startsWith("кругл")) return "кругл";
    if (cleanToken.startsWith("некругл")) return "некругл";
    if (cleanToken.startsWith("шар")) return "шар";
    if (cleanToken.startsWith("пол")) return "пол";
    if (cleanToken.startsWith("сплошн")) return "сплошн";
    if (cleanToken.startsWith("эл")) return "элемент";
    if (cleanToken.startsWith("подвес")) return "подвеск";
    if (cleanToken === "вне") return "вне";
    if (cleanToken === "оси") return "оси";
    if (cleanToken.startsWith("дет")) return "";
    if (cleanToken.startsWith("одн")) return "";
    if (cleanToken === "двух") return "";
    if (cleanToken.startsWith("сторон")) return "";
    return cleanToken;
  }

  function getClausePolarityDescriptor(clause) {
    const trimmedClause = clause.trim();
    if (trimmedClause.startsWith("без ")) {
      return { polarity: false, body: trimmedClause.slice(4).trim() };
    }
    if (trimmedClause.startsWith("с ")) {
      return { polarity: true, body: trimmedClause.slice(2).trim() };
    }
    if (trimmedClause.startsWith("кроме ")) {
      return { polarity: false, body: trimmedClause.slice(6).trim() };
    }
    return null;
  }

  function buildClauseCore(body) {
    const stopWords = new Set(["и", "или", "и/или", "или/и", "на", "в", "по", "для", "от", "до", "со"]);
    const core = body
      .split(/\s+/)
      .map((token) => normalizeClauseToken(token))
      .filter((token) => token && !stopWords.has(token))
      .join(" ");

    return core
      .replace(/пазов/g, "паз")
      .replace(/пазами/g, "паз")
      .replace(/шлицев/g, "шлиц")
      .replace(/шлицами/g, "шлиц")
      .replace(/кольцевых/g, "кольцев")
      .replace(/кольцевыми/g, "кольцев");
  }

  function prettifyClauseBody(body) {
    return body
      .replace(/с отверст[а-я]*/g, "с отверстиями")
      .replace(/без отверст[а-я]*/g, "без отверстий")
      .replace(/отверст[а-я]* вне оси/g, "отверстиями вне оси")
      .replace(/с кольц[а-я]* паз[а-я]* на торц[а-я]*/g, "с кольцевыми пазами на торцах")
      .replace(/без кольц[а-я]* паз[а-я]* на торц[а-я]*/g, "без кольцевых пазов на торцах")
      .replace(/с паз[а-я]*(?:,?\s*шлиц[а-я]*)/g, "с пазами или шлицами")
      .replace(/без паз[а-я]* шлиц[а-я]*/g, "без пазов и шлицев")
      .replace(/паз[а-я]* шлиц[а-я]*/g, "пазами или шлицами")
      .trim();
  }

  function evaluateAdaptiveSplit(features, items, candidateCodes, parentCode) {
    let bestSplit = null;
    const inferFalseWhenMissing = new Set(["has_face_ring_grooves"]);

    Object.entries(features).forEach(([featureKey, feature]) => {
      if (Object.prototype.hasOwnProperty.call(activeFeatureAnswers, featureKey)) {
        return;
      }

      const trueCodes = [];
      const falseCodes = [];
      let hasUnknown = false;

      candidateCodes.forEach((code) => {
        const value = items[code]?.[featureKey];
        if (value === true) trueCodes.push(code);
        else if (value === false) falseCodes.push(code);
        else hasUnknown = true;
      });

      if (hasUnknown && inferFalseWhenMissing.has(featureKey) && trueCodes.length > 0 && falseCodes.length === 0) {
        candidateCodes.forEach((code) => {
          if (items[code]?.[featureKey] === undefined) {
            falseCodes.push(code);
          }
        });
        hasUnknown = false;
      }

      if (hasUnknown || trueCodes.length === 0 || falseCodes.length === 0) {
        return;
      }

      const split = {
        parentCode,
        featureKey,
        feature,
        trueCodes,
        falseCodes,
        balance: Math.abs(trueCodes.length - falseCodes.length)
      };

      if (!bestSplit || split.balance < bestSplit.balance) {
        bestSplit = split;
      }
    });

    return bestSplit;
  }

  function extractModuleRange(pathSegments) {
    const text = normalizeDescriptionText(pathSegments.join(" "));
    const numberPattern = "([0-9]+(?:\\s*,\\s*[0-9]+)?)";
    const findLast = (pattern) => {
      const matches = [...text.matchAll(new RegExp(pattern, "ig"))];
      return matches.length > 0 ? matches[matches.length - 1] : null;
    };

    match = findLast(`с модулем св\\.?\\s*${numberPattern}\\s*до\\s*${numberPattern}\\s*мм`);
    if (match) {
      return {
        min: parseFloat(match[1].replace(/\s*,\s*/g, ".")),
        max: parseFloat(match[2].replace(/\s*,\s*/g, "."))
      };
    }

    match = findLast(`с модулем св\\.?\\s*${numberPattern}\\s*мм`);
    if (match) {
      return { min: parseFloat(match[1].replace(/\s*,\s*/g, ".")), max: Number.POSITIVE_INFINITY };
    }

    match = findLast(`с модулем до\\s*${numberPattern}\\s*мм`);
    if (match) {
      return { min: Number.NEGATIVE_INFINITY, max: parseFloat(match[1].replace(/\s*,\s*/g, ".")) };
    }

    return null;
  }

  function buildModuleSplit(nodes, parentCode) {
    const items = nodes
      .map((node) => ({ node, range: extractModuleRange(pathIndex.get(node.code) || []) }))
      .filter((item) => item.range);

    if (items.length !== nodes.length) {
      return null;
    }

    const thresholds = [...new Set(items
      .map((item) => item.range.max)
      .filter((value) => Number.isFinite(value))
    )].sort((a, b) => a - b);

    let bestSplit = null;

    thresholds.forEach((threshold) => {
      const trueCodes = [];
      const falseCodes = [];

      items.forEach(({ node, range }) => {
        if (range.min >= threshold && !Number.isFinite(range.max)) {
          trueCodes.push(node.code);
          return;
        }

        if (range.min >= threshold && Number.isFinite(range.max) && range.min === threshold) {
          trueCodes.push(node.code);
          return;
        }

        if (range.max <= threshold) {
          falseCodes.push(node.code);
        }
      });

      if (trueCodes.length === 0 || falseCodes.length === 0 || trueCodes.length + falseCodes.length !== nodes.length) {
        return;
      }

      const split = {
        parentCode,
        featureKey: `module_gt_${String(threshold).replace(".", "_")}`,
        feature: {
          question: `Модуль свыше ${String(threshold).replace(".", ",")} мм?`,
          trueLabel: "Да",
          falseLabel: "Нет",
          trueUserText: `Модуль свыше ${String(threshold).replace(".", ",")} мм`,
          falseUserText: `Модуль до ${String(threshold).replace(".", ",")} мм`
        },
        trueCodes,
        falseCodes,
        balance: Math.abs(trueCodes.length - falseCodes.length)
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

  function getDynamicClauseSplit(nodes) {
    const candidateCodes = nodes.map((node) => node.code);
    const clauseGroups = new Map();

    nodes.forEach((node) => {
      const clauses = parseEskdClauses(pathIndex.get(node.code) || []);
      clauses.forEach((clause) => {
        const descriptor = getClausePolarityDescriptor(clause);
        if (!descriptor) return;

        const core = buildClauseCore(descriptor.body);
        if (!core) return;

        if (!clauseGroups.has(core)) {
          clauseGroups.set(core, { positiveText: null, negativeText: null, values: {} });
        }

        const group = clauseGroups.get(core);
        group.values[node.code] = descriptor.polarity;
        if (descriptor.polarity && !group.positiveText) group.positiveText = `с ${descriptor.body}`;
        if (!descriptor.polarity && !group.negativeText) group.negativeText = `без ${descriptor.body}`;
      });
    });

    let bestSplit = null;

    clauseGroups.forEach((group, core) => {
      const values = candidateCodes.map((code) => group.values[code]);
      if (values.some((value) => value === undefined)) return;

      const trueCodes = candidateCodes.filter((code) => group.values[code] === true);
      const falseCodes = candidateCodes.filter((code) => group.values[code] === false);
      if (trueCodes.length === 0 || falseCodes.length === 0) return;

      const questionBody = group.positiveText || group.negativeText;
      const prettyQuestionBody = questionBody ? prettifyClauseBody(questionBody) : "";
      const prettyPositiveBody = group.positiveText ? prettifyClauseBody(group.positiveText) : "";
      const prettyNegativeBody = group.negativeText ? prettifyClauseBody(group.negativeText) : "";

      const split = {
        parentCode: getSharedParentCode(nodes) || "dynamic",
        featureKey: `dynamic:${core}`,
        feature: {
          question: prettyQuestionBody ? `Верно ли, что деталь ${prettyQuestionBody}?` : "Какой признак лучше подходит?",
          trueLabel: "Да",
          falseLabel: "Нет",
          trueUserText: prettyPositiveBody ? `Да, деталь ${prettyPositiveBody}` : "Да",
          falseUserText: prettyNegativeBody ? `Нет, деталь ${prettyNegativeBody}` : "Нет"
        },
        trueCodes,
        falseCodes,
        balance: Math.abs(trueCodes.length - falseCodes.length)
      };

      if (!bestSplit || split.balance < bestSplit.balance) {
        bestSplit = split;
      }
    });

    return bestSplit;
  }

  function mapClauseToFeatures(clause, features) {
    if (/без центральн\w* отверст/.test(clause)) setFeatureValue(features, "has_center_hole", false);
    if (/кроме шар\w*/.test(clause)) setFeatureValue(features, "is_sphere", false);
    if (/шар\w*/.test(clause) && !/кроме шар\w*/.test(clause)) setFeatureValue(features, "is_sphere", true);
    if (/сплошн\w*/.test(clause)) setFeatureValue(features, "is_hollow_sphere", false);
    if (/пол\w*/.test(clause)) setFeatureValue(features, "is_hollow_sphere", true);
    if (/без эл-?т\w* для подвески/.test(clause)) setFeatureValue(features, "has_suspension_element", false);
    if (/с эл-?т\w* для подвески/.test(clause)) setFeatureValue(features, "has_suspension_element", true);
    if (/без паз\w* и выступ\w* на торц\w* ступиц\w*/.test(clause)) setFeatureValue(features, "has_hub_face_slots_or_lugs", false);
    if (/с паз\w* и выступ\w* на торц\w* ступиц\w*/.test(clause)) setFeatureValue(features, "has_hub_face_slots_or_lugs", true);
    if (/кроме кольцев\w*/.test(clause)) setFeatureValue(features, "is_ring_sector", false);
    if (/кольцев\w*/.test(clause) && !/кроме кольцев\w*/.test(clause)) setFeatureValue(features, "is_ring_sector", true);
    if (/с внутр\w* осн\w* баз\w*/.test(clause)) setFeatureValue(features, "has_inner_base", true);
    if (/с нар\w* осн\w* баз\w*/.test(clause)) setFeatureValue(features, "has_inner_base", false);
    if (/без фланц\w*/.test(clause)) setFeatureValue(features, "has_flanges", false);
    if (/с фланц\w*/.test(clause)) setFeatureValue(features, "has_flanges", true);
    if (/по профил\w* зуб\w*/.test(clause)) setFeatureValue(features, "base_by_tooth_profile", true);
    if (/центральн\w* глух\w* отверст/.test(clause) || /глух\w* отверст/.test(clause)) {
      setFeatureValue(features, "has_center_hole", true);
      setFeatureValue(features, "is_blind_hole", true);
    }
    if (/центральн\w* сквоз\w* отверст/.test(clause) || /сквоз\w* отверст/.test(clause)) {
      setFeatureValue(features, "has_center_hole", true);
      setFeatureValue(features, "is_blind_hole", false);
    }
    if (/центральн\w* отверст/.test(clause) && !/без центральн\w* отверст/.test(clause)) setFeatureValue(features, "has_center_hole", true);
    if (/без резьб/.test(clause)) setFeatureValue(features, "has_thread_in_hole", false);
    if (/с резьб/.test(clause) || /резьбов/.test(clause)) setFeatureValue(features, "has_thread_in_hole", true);
    if (/ступенчат/.test(clause)) setFeatureValue(features, "is_stepped_hole", true);
    if (/гладк/.test(clause)) setFeatureValue(features, "is_stepped_hole", false);
    if (/некругл/.test(clause)) setFeatureValue(features, "is_round_hole", false);
    if (/кругл/.test(clause) && !/некругл/.test(clause)) setFeatureValue(features, "is_round_hole", true);
    if (/без кольцев\w* паз\w* на торц/.test(clause)) setFeatureValue(features, "has_face_ring_grooves", false);
    if (/с кольцев\w* паз\w* на торц/.test(clause)) setFeatureValue(features, "has_face_ring_grooves", true);
    if (
      /без паз\w* и шлиц\w* на наружн\w* поверхност/.test(clause) ||
      /без паз\w* шлиц\w* на наружн\w* поверхност/.test(clause) ||
      /без паз\w* на наружн\w* поверхност/.test(clause) ||
      /без шлиц\w* на наружн\w* поверхност/.test(clause)
    ) {
      setFeatureValue(features, "has_outer_slots_or_splines", false);
    }
    if (
      /с паз\w*(?:,?\s*шлиц\w*| и\/или шлиц\w*| шлиц\w*)? на наружн\w* поверхност/.test(clause) ||
      /с[о]?\s*шлиц\w* на наружн\w* поверхност/.test(clause)
    ) {
      setFeatureValue(features, "has_outer_slots_or_splines", true);
    }
    if (/без отверст\w* вне оси/.test(clause)) setFeatureValue(features, "has_off_axis_holes", false);
    if (/с отверст\w* вне оси/.test(clause)) setFeatureValue(features, "has_off_axis_holes", true);
  }

  function extractRotationFeaturesFromPath(pathSegments) {
    const features = {};
    parseEskdClauses(pathSegments).forEach((clause) => mapClauseToFeatures(clause, features));
    return features;
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

  function getRotationHeuristicSplit(nodes) {
    if (!nodes.every((node) => node.code.startsWith("71") || node.code.startsWith("72"))) return null;
    const candidateCodes = nodes.map((node) => node.code);
    const items = {};
    nodes.forEach((node) => {
      items[node.code] = extractRotationFeaturesFromPath(pathIndex.get(node.code) || []);
    });
    return evaluateAdaptiveSplit(rotationFeatureCatalog, items, candidateCodes, getSharedParentCode(nodes) || "71");
  }

  function getAdaptiveSplit(nodes) {
    const dynamicSplit = getDynamicClauseSplit(nodes);
    if (dynamicSplit) return dynamicSplit;

    const parentCode = getSharedParentCode(nodes);
    const candidateCodes = nodes.map((node) => node.code);

    if (parentCode) {
      const rule = adaptiveRules[parentCode];
      if (rule && rule.features && rule.items && candidateCodes.every((code) => rule.items[code])) {
        const explicitSplit = evaluateAdaptiveSplit(rule.features, rule.items, candidateCodes, parentCode);
        if (explicitSplit) return explicitSplit;
      }
    }

    const moduleSplit = buildModuleSplit(nodes, parentCode || getSharedParentCode(nodes) || "rotation");
    if (moduleSplit) return moduleSplit;

    return getRotationHeuristicSplit(nodes);
  }

  function getFeatureDefinition(featureKey) {
    if (rotationFeatureCatalog[featureKey]) return rotationFeatureCatalog[featureKey];
    for (const rule of Object.values(adaptiveRules)) {
      if (rule?.features?.[featureKey]) return rule.features[featureKey];
    }
    return null;
  }

  function getFeatureValueForNode(node, featureKey) {
    const parentCode = parentIndex.get(node.code);
    const explicitValue = parentCode ? adaptiveRules[parentCode]?.items?.[node.code]?.[featureKey] : undefined;
    if (explicitValue === true || explicitValue === false) return explicitValue;
    if (node.code.startsWith("71") || node.code.startsWith("72")) {
      return extractRotationFeaturesFromPath(pathIndex.get(node.code) || [])[featureKey];
    }
    return undefined;
  }

  function applyFeatureAnswersToNodes(nodes) {
    const entries = Object.entries(activeFeatureAnswers);
    if (entries.length === 0) return nodes;
    const filteredNodes = nodes.filter((node) => (
      entries.every(([featureKey, expectedValue]) => {
        const actualValue = getFeatureValueForNode(node, featureKey);
        return actualValue === undefined || actualValue === expectedValue;
      })
    ));
    return filteredNodes.length > 0 ? filteredNodes : nodes;
  }

  function applyBranchPrefixes(prefixes) {
    if (!prefixes || prefixes.length === 0) return;
    if (!activeBranchPrefixes || activeBranchPrefixes.length === 0) {
      activeBranchPrefixes = [...new Set(prefixes)];
      return;
    }

    const merged = [];
    activeBranchPrefixes.forEach((currentPrefix) => {
      prefixes.forEach((nextPrefix) => {
        if (currentPrefix.startsWith(nextPrefix)) merged.push(currentPrefix);
        else if (nextPrefix.startsWith(currentPrefix)) merged.push(nextPrefix);
      });
    });
    activeBranchPrefixes = [...new Set(merged)];
  }

  function applyBranchSuffixes(suffixes) {
    if (!suffixes || suffixes.length === 0 || !activeBranchPrefixes || activeBranchPrefixes.length === 0) return;
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
          if (child.code.endsWith(suffix)) expanded.push(child.code);
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
            if (sibling.code.endsWith(suffix)) siblingMatches.push(sibling.code);
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
    if (filters.length === 0) return true;
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
      if (!pathMatchesFilters(currentPath, filters)) return null;
      return { code: node.code, description: node.description, image: node.image, children: {} };
    }

    const filteredChildren = children
      .map((child) => filterTreeNode(child, filters, currentPath))
      .filter(Boolean);

    if (filteredChildren.length === 0 && !pathMatchesFilters(currentPath, filters)) return null;

    return {
      code: node.code,
      description: node.description,
      image: node.image,
      children: Object.fromEntries(filteredChildren.map((child) => [child.code, child]))
    };
  }

  function getBranchStartNodes() {
    if (!activeBranchPrefixes || activeBranchPrefixes.length === 0) return null;
    const nodes = activeBranchPrefixes.map((prefix) => nodeIndex.get(prefix)).filter(Boolean);
    return nodes.length > 0 ? nodes : null;
  }

  function getRestrictedRoots() {
    const branchNodes = getBranchStartNodes();
    const sourceNodes = branchNodes || treeRoots;

    if (activeFilters.length === 0) return sourceNodes;

    const filteredNodes = sourceNodes
      .map((node) => filterTreeNode(node, activeFilters))
      .filter(Boolean);

    if (filteredNodes.length > 0) return filteredNodes;
    if (branchNodes) return branchNodes;
    return treeRoots;
  }

  function getTreeQuestionText(options) {
    if (options.length === 0) return "Подходящие варианты не найдены";
    const codeLength = options[0].code.length;
    const prefixes = activeBranchPrefixes || [];
    const isRotationBranch = prefixes.length > 0 && prefixes.every((prefix) => prefix.startsWith("71") || prefix.startsWith("72"));

    if (isRotationBranch && codeLength === 3) return "Какая группа деталей ближе по описанию?";
    if (isRotationBranch && codeLength === 4) return "Какое описание формы ближе всего?";
    if (isRotationBranch && codeLength === 5) return "Какой дополнительный признак лучше подходит?";
    if (isRotationBranch) return "Какое описание подходит точнее?";
    if (codeLength <= 2) return "Выбери наиболее подходящий раздел";
    if (codeLength === 3) return "Что лучше всего описывает изделие?";
    if (codeLength === 4) return "Какой вариант описания ближе?";
    if (codeLength === 5) return "Какой признак подходит лучше?";
    return "Какое описание подходит точнее?";
  }

  return {
    loadData(treeData, flowData, adaptiveData) {
      treeRoots = Object.values(treeData).filter(Boolean);
      questionFlow = flowData;
      adaptiveRules = adaptiveData || {};
      nodeIndex.clear();
      pathIndex.clear();
      parentIndex.clear();
      buildNodeIndex(treeRoots);
      this.resetState();
    },
    resetState() {
      activeFilters = [];
      activeBranchPrefixes = null;
      activeFeatureAnswers = {};
    },
    exportState() {
      return {
        activeFilters: cloneFilters(activeFilters),
        activeBranchPrefixes: activeBranchPrefixes ? [...activeBranchPrefixes] : null,
        activeFeatureAnswers: cloneFeatureAnswers(activeFeatureAnswers)
      };
    },
    importState(state) {
      activeFilters = cloneFilters(state.activeFilters || []);
      activeBranchPrefixes = state.activeBranchPrefixes ? [...state.activeBranchPrefixes] : null;
      activeFeatureAnswers = cloneFeatureAnswers(state.activeFeatureAnswers || {});
    },
    isReady() {
      return !!questionFlow && treeRoots.length > 0;
    },
    getStartQuestionId() {
      return questionFlow?.start || null;
    },
    getFlowQuestion(questionId) {
      return questionFlow?.questions?.[questionId] || null;
    },
    applyFlowOption(option) {
      if (option.branchPrefixes) applyBranchPrefixes(option.branchPrefixes);
      if (option.branchSuffixes) applyBranchSuffixes(option.branchSuffixes);
      if (option.filters) {
        activeFilters.push({
          includeAny: option.filters.includeAny || [],
          excludeAny: option.filters.excludeAny || []
        });
      }
      if (option.featureConstraints) {
        Object.assign(activeFeatureAnswers, option.featureConstraints);
      }
    },
    applyFeatureConstraints(constraints) {
      if (constraints) {
        Object.assign(activeFeatureAnswers, constraints);
      }
    },
    getAdaptiveSplit,
    getAdaptiveNodesByCodes(codes) {
      return applyFeatureAnswersToNodes(codes.map((code) => nodeIndex.get(code)).filter(Boolean));
    },
    getRestrictedRoots,
    getChildren,
    getTreeQuestionText,
    getPathDescription(code) {
      const path = pathIndex.get(code) || [];
      return path.length > 0 ? path.join(" -> ") : "";
    },
    getNode(code) {
      return nodeIndex.get(code) || null;
    }
  };
}
