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
      question: "Р­С‚Рѕ С€Р°СЂ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р­С‚Рѕ С€Р°СЂ",
      falseUserText: "Р­С‚Рѕ РЅРµ С€Р°СЂ"
    },
    is_hollow_sphere: {
      question: "РЁР°СЂ РїРѕР»С‹Р№?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "РЁР°СЂ РїРѕР»С‹Р№",
      falseUserText: "РЁР°СЂ СЃРїР»РѕС€РЅРѕР№"
    },
    has_suspension_element: {
      question: "Р•СЃС‚СЊ СЌР»РµРјРµРЅС‚ РґР»СЏ РїРѕРґРІРµСЃРєРё?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ СЌР»РµРјРµРЅС‚ РґР»СЏ РїРѕРґРІРµСЃРєРё",
      falseUserText: "Р­Р»РµРјРµРЅС‚Р° РґР»СЏ РїРѕРґРІРµСЃРєРё РЅРµС‚"
    },
    has_hub_face_slots_or_lugs: {
      question: "Р•СЃС‚СЊ РїР°Р·С‹ РёР»Рё РІС‹СЃС‚СѓРїС‹ РЅР° С‚РѕСЂС†Рµ СЃС‚СѓРїРёС†С‹?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ РїР°Р·С‹ РёР»Рё РІС‹СЃС‚СѓРїС‹ РЅР° С‚РѕСЂС†Рµ СЃС‚СѓРїРёС†С‹",
      falseUserText: "РџР°Р·РѕРІ Рё РІС‹СЃС‚СѓРїРѕРІ РЅР° С‚РѕСЂС†Рµ СЃС‚СѓРїРёС†С‹ РЅРµС‚"
    },
    is_ring_sector: {
      question: "Р­С‚Рѕ РєРѕР»СЊС†РµРІРѕР№ СЃРµРєС‚РѕСЂ РёР»Рё СЃРµРіРјРµРЅС‚?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р­С‚Рѕ РєРѕР»СЊС†РµРІРѕР№ СЃРµРєС‚РѕСЂ РёР»Рё СЃРµРіРјРµРЅС‚",
      falseUserText: "Р­С‚Рѕ РЅРµ РєРѕР»СЊС†РµРІРѕР№ СЃРµРєС‚РѕСЂ РёР»Рё СЃРµРіРјРµРЅС‚"
    },
    has_inner_base: {
      question: "РћСЃРЅРѕРІР°РЅРёРµ РІРЅСѓС‚СЂРµРЅРЅРµРµ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "РћСЃРЅРѕРІР°РЅРёРµ РІРЅСѓС‚СЂРµРЅРЅРµРµ",
      falseUserText: "РћСЃРЅРѕРІР°РЅРёРµ РЅР°СЂСѓР¶РЅРѕРµ"
    },
    has_flanges: {
      question: "Р•СЃС‚СЊ С„Р»Р°РЅС†С‹?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ С„Р»Р°РЅС†С‹",
      falseUserText: "Р¤Р»Р°РЅС†РµРІ РЅРµС‚"
    },
    base_by_tooth_profile: {
      question: "РћСЃРЅРѕРІРЅР°СЏ Р±Р°Р·Р° РїРѕ РїСЂРѕС„РёР»СЋ Р·СѓР±СЊРµРІ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "РћСЃРЅРѕРІРЅР°СЏ Р±Р°Р·Р° РїРѕ РїСЂРѕС„РёР»СЋ Р·СѓР±СЊРµРІ",
      falseUserText: "РћСЃРЅРѕРІРЅР°СЏ Р±Р°Р·Р° РЅРµ РїРѕ РїСЂРѕС„РёР»СЋ Р·СѓР±СЊРµРІ"
    },
    has_center_hole: {
      question: "Р•СЃС‚СЊ Р»Рё С†РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ С†РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ",
      falseUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРіРѕ РѕС‚РІРµСЂСЃС‚РёСЏ РЅРµС‚"
    },
    has_face_ring_grooves: {
      question: "Р•СЃС‚СЊ Р»Рё РєРѕР»СЊС†РµРІС‹Рµ РїР°Р·С‹ РЅР° С‚РѕСЂС†Р°С…?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ РєРѕР»СЊС†РµРІС‹Рµ РїР°Р·С‹ РЅР° С‚РѕСЂС†Р°С…",
      falseUserText: "РљРѕР»СЊС†РµРІС‹С… РїР°Р·РѕРІ РЅР° С‚РѕСЂС†Р°С… РЅРµС‚"
    },
    has_outer_slots_or_splines: {
      question: "Р•СЃС‚СЊ Р»Рё РїР°Р·С‹ РёР»Рё С€Р»РёС†С‹ РЅР° РЅР°СЂСѓР¶РЅРѕР№ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ РїР°Р·С‹ РёР»Рё С€Р»РёС†С‹ РЅР° РЅР°СЂСѓР¶РЅРѕР№ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё",
      falseUserText: "РџР°Р·РѕРІ Рё С€Р»РёС†РµРІ РЅР° РЅР°СЂСѓР¶РЅРѕР№ РїРѕРІРµСЂС…РЅРѕСЃС‚Рё РЅРµС‚"
    },
    has_off_axis_holes: {
      question: "Р•СЃС‚СЊ Р»Рё РѕС‚РІРµСЂСЃС‚РёСЏ РІРЅРµ РѕСЃРё РґРµС‚Р°Р»Рё?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ РѕС‚РІРµСЂСЃС‚РёСЏ РІРЅРµ РѕСЃРё РґРµС‚Р°Р»Рё",
      falseUserText: "РћС‚РІРµСЂСЃС‚РёР№ РІРЅРµ РѕСЃРё РґРµС‚Р°Р»Рё РЅРµС‚"
    },
    is_blind_hole: {
      question: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РіР»СѓС…РѕРµ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РіР»СѓС…РѕРµ",
      falseUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РЅРµ РіР»СѓС…РѕРµ"
    },
    has_thread_in_hole: {
      question: "Р•СЃС‚СЊ Р»Рё СЂРµР·СЊР±Р° РІ С†РµРЅС‚СЂР°Р»СЊРЅРѕРј РѕС‚РІРµСЂСЃС‚РёРё?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р•СЃС‚СЊ СЂРµР·СЊР±Р° РІ С†РµРЅС‚СЂР°Р»СЊРЅРѕРј РѕС‚РІРµСЂСЃС‚РёРё",
      falseUserText: "Р РµР·СЊР±С‹ РІ С†РµРЅС‚СЂР°Р»СЊРЅРѕРј РѕС‚РІРµСЂСЃС‚РёРё РЅРµС‚"
    },
    is_stepped_hole: {
      question: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ СЃС‚СѓРїРµРЅС‡Р°С‚РѕРµ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ СЃС‚СѓРїРµРЅС‡Р°С‚РѕРµ",
      falseUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РЅРµ СЃС‚СѓРїРµРЅС‡Р°С‚РѕРµ"
    },
    is_round_hole: {
      question: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РєСЂСѓРіР»РѕРµ?",
      trueLabel: "Р”Р°",
      falseLabel: "РќРµС‚",
      trueUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РєСЂСѓРіР»РѕРµ",
      falseUserText: "Р¦РµРЅС‚СЂР°Р»СЊРЅРѕРµ РѕС‚РІРµСЂСЃС‚РёРµ РЅРµРєСЂСѓРіР»РѕРµ"
    }
  };

  const generalFeatureCatalog = {
    has_local_bends: {
      question: "\u0415\u0441\u0442\u044c \u043c\u0435\u0441\u0442\u043d\u044b\u0435 \u0438\u0437\u0433\u0438\u0431\u044b?",
      trueLabel: "\u0414\u0430",
      falseLabel: "\u041d\u0435\u0442",
      trueUserText: "\u0415\u0441\u0442\u044c \u043c\u0435\u0441\u0442\u043d\u044b\u0435 \u0438\u0437\u0433\u0438\u0431\u044b",
      falseUserText: "\u041c\u0435\u0441\u0442\u043d\u044b\u0445 \u0438\u0437\u0433\u0438\u0431\u043e\u0432 \u043d\u0435\u0442"
    },
    has_slots: {
      question: "\u0415\u0441\u0442\u044c \u043f\u0430\u0437\u044b?",
      trueLabel: "\u0414\u0430",
      falseLabel: "\u041d\u0435\u0442",
      trueUserText: "\u0415\u0441\u0442\u044c \u043f\u0430\u0437\u044b",
      falseUserText: "\u041f\u0430\u0437\u043e\u0432 \u043d\u0435\u0442"
    },
    has_holes: {
      question: "\u0415\u0441\u0442\u044c \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u044f?",
      trueLabel: "\u0414\u0430",
      falseLabel: "\u041d\u0435\u0442",
      trueUserText: "\u0415\u0441\u0442\u044c \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u044f",
      falseUserText: "\u041e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0439 \u043d\u0435\u0442"
    },
    has_cooling_ribs: {
      question: "\u0415\u0441\u0442\u044c \u0440\u0435\u0431\u0440\u0430 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\u043e\u0439 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438?",
      trueLabel: "\u0414\u0430",
      falseLabel: "\u041d\u0435\u0442",
      trueUserText: "\u0415\u0441\u0442\u044c \u0440\u0435\u0431\u0440\u0430 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\u043e\u0439 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438",
      falseUserText: "\u0420\u0435\u0431\u0435\u0440 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\u043e\u0439 \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438 \u043d\u0435\u0442"
    },
    base_hole_orientation_parallel: {
      question: "\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u044f \u043f\u0430\u0440\u0430\u043b\u043b\u0435\u043b\u044c\u043d\u044b\u0435?",
      trueLabel: "\u0414\u0430",
      falseLabel: "\u041d\u0435\u0442",
      trueUserText: "\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u044f \u043f\u0430\u0440\u0430\u043b\u043b\u0435\u043b\u044c\u043d\u044b\u0435",
      falseUserText: "\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u044f \u043d\u0435\u043f\u0430\u0440\u0430\u043b\u043b\u0435\u043b\u044c\u043d\u044b\u0435"
    }
  };

  function normalizeText(value) {
    return (value || "").toLowerCase().replace(/\u0451/g, "\u0435");
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


  function compareNodeCodes(a, b) {
    const aCode = typeof a === "string" ? a : a?.code || "";
    const bCode = typeof b === "string" ? b : b?.code || "";
    const aNum = Number.parseInt(aCode, 10);
    const bNum = Number.parseInt(bCode, 10);
    const aHasNum = Number.isFinite(aNum);
    const bHasNum = Number.isFinite(bNum);

    if (aHasNum && bHasNum && aNum !== bNum) {
      return aNum - bNum;
    }

    return aCode.localeCompare(bCode, "ru", { numeric: true });
  }

  function normalizeDescriptionText(value) {
    let text = normalizeText(value);
    const replacements = [
      [/\u043e\u0442\u0432\./g, "\u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435"],
      [/\u043e\u0442\u0432\b/g, "\u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435"],
      [/\u0446\u0435\u043d\u0442\u0440\./g, "\u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\u043e\u0435"],
      [/\u043d\u0430\u0440\./g, "\u043d\u0430\u0440\u0443\u0436\u043d\u043e\u0439"],
      [/\u0432\u043d\u0443\u0442\u0440\./g, "\u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u0439"],
      [/\u043e\u0441\u043d\./g, "\u043e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u044f"],
      [/\u043f\u043e\u0432\./g, "\u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438"],
      [/\u043f\u043e\u0432\u0435\u0440\u0445\./g, "\u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u0438"],
      [/\u0434\u0435\u0442\./g, "\u0434\u0435\u0442\u0430\u043b\u0438"],
      [/\u0434\u0435\u0442\b/g, "\u0434\u0435\u0442\u0430\u043b\u0438"],
      [/\u043a\u043e\u043b\u044c\u0446\./g, "\u043a\u043e\u043b\u044c\u0446\u0435\u0432\u044b\u043c\u0438"],
      [/\u0442\u043e\u0440\u0446\./g, "\u0442\u043e\u0440\u0446\u0430\u0445"],
      [/\u043a\u0440\u0443\u0433\./g, "\u043a\u0440\u0443\u0433\u043b\u043e\u0435"],
      [/\u043d\u0435\u043a\u0440\u0443\u0433\u043b\./g, "\u043d\u0435\u043a\u0440\u0443\u0433\u043b\u043e\u0435"],
      [/\u043a\u043e\u043d\u0438\u0447\./g, "\u043a\u043e\u043d\u0438\u0447\u0435\u0441\u043a\u043e\u0439"],
      [/\u043a\u0440\u0438\u0432\u043e\u043b\u0438\u043d\./g, "\u043a\u0440\u0438\u0432\u043e\u043b\u0438\u043d\u0435\u0439\u043d\u043e\u0439"],
      [/\u043a\u043e\u043c\u0431\u0438\u043d\u0438\u0440\./g, "\u043a\u043e\u043c\u0431\u0438\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0439"],
      [/\u0437\u0430\u043a\u0440\./g, "\u0437\u0430\u043a\u0440\u044b\u0442\u044b\u043c\u0438"],
      [/\u0440\u0435\u0437\u044c\u0431\./g, "\u0440\u0435\u0437\u044c\u0431\u043e\u0439"],
      [/\u043f\u0430\u0437\u0430\u043c\u0438 \u0438\/\u0438\u043b\u0438 \u0448\u043b\u0438\u0446\u0430\u043c\u0438/g, "\u043f\u0430\u0437\u0430\u043c\u0438 \u0448\u043b\u0438\u0446\u0430\u043c\u0438"],
      [/\u043f\u0430\u0437\u043e\u0432 \u0438\/\u0438\u043b\u0438 \u0448\u043b\u0438\u0446\u0435\u0432/g, "\u043f\u0430\u0437\u043e\u0432 \u0448\u043b\u0438\u0446\u0435\u0432"],
      [/\u0448\u043b\u0438\u0446\u0435\u0432|\u0448\u043b\u0438\u0446\u0430\u043c\u0438|\u0448\u043b\u0438\u0446\u0430\u043c|\u0448\u043b\u0438\u0446\u044b/g, "\u0448\u043b\u0438\u0446\u044b"],
      [/\u043f\u0430\u0437\./g, "\u043f\u0430\u0437\u044b"],
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
    const polarityBoundary = /\s+(?=(?:Р±РµР·|СЃ)\s+(?:РѕС‚РІРµСЂСЃС‚\w*|РїР°Р·\w*|С€Р»РёС†\w*|РєРѕР»СЊС†РµРІ\w*|СЂРµР·СЊР±\w*|С†РµРЅС‚СЂ\w*))/g;

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
    if (cleanToken === "Рё/РёР»Рё") return "";
    if (cleanToken.startsWith("РїР°Р·")) return "РїР°Р·";
    if (cleanToken.startsWith("С€Р»РёС†")) return "С€Р»РёС†";
    if (cleanToken.startsWith("РЅР°СЂСѓР¶РЅ")) return "РЅР°СЂСѓР¶РЅ";
    if (cleanToken.startsWith("РїРѕРІРµСЂС…РЅРѕСЃС‚") || cleanToken.startsWith("РїРѕРІРµСЂС…")) return "РїРѕРІРµСЂС…РЅРѕСЃС‚";
    if (cleanToken.startsWith("РѕС‚РІРµСЂСЃС‚") || cleanToken === "РѕС‚РІ") return "РѕС‚РІРµСЂСЃС‚";
    if (cleanToken.startsWith("РєРѕР»СЊС†РµРІ") || cleanToken.startsWith("РєРѕР»СЊС†")) return "РєРѕР»СЊС†РµРІ";
    if (cleanToken.startsWith("С‚РѕСЂС†")) return "С‚РѕСЂС†";
    if (cleanToken.startsWith("С†РµРЅС‚СЂ")) return "С†РµРЅС‚СЂ";
    if (cleanToken.startsWith("РіР»СѓС…")) return "РіР»СѓС…";
    if (cleanToken.startsWith("СЃРєРІРѕР·")) return "СЃРєРІРѕР·";
    if (cleanToken.startsWith("СЂРµР·СЊР±")) return "СЂРµР·СЊР±";
    if (cleanToken.startsWith("СЃС‚СѓРїРµРЅС‡Р°С‚")) return "СЃС‚СѓРїРµРЅС‡Р°С‚";
    if (cleanToken.startsWith("РіР»Р°РґРє")) return "РіР»Р°РґРє";
    if (cleanToken.startsWith("РєСЂСѓРіР»")) return "РєСЂСѓРіР»";
    if (cleanToken.startsWith("РЅРµРєСЂСѓРіР»")) return "РЅРµРєСЂСѓРіР»";
    if (cleanToken.startsWith("С€Р°СЂ")) return "С€Р°СЂ";
    if (cleanToken.startsWith("РїРѕР»")) return "РїРѕР»";
    if (cleanToken.startsWith("СЃРїР»РѕС€РЅ")) return "СЃРїР»РѕС€РЅ";
    if (cleanToken.startsWith("СЌР»")) return "СЌР»РµРјРµРЅС‚";
    if (cleanToken.startsWith("РїРѕРґРІРµСЃ")) return "РїРѕРґРІРµСЃРє";
    if (cleanToken === "РІРЅРµ") return "РІРЅРµ";
    if (cleanToken === "РѕСЃРё") return "РѕСЃРё";
    if (cleanToken.startsWith("РґРµС‚")) return "";
    if (cleanToken.startsWith("РѕРґРЅ")) return "";
    if (cleanToken === "РґРІСѓС…") return "";
    if (cleanToken.startsWith("СЃС‚РѕСЂРѕРЅ")) return "";
    return cleanToken;
  }

  function getClausePolarityDescriptor(clause) {
    const trimmedClause = clause.trim();
    if (trimmedClause.startsWith("Р±РµР· ")) {
      return { polarity: false, body: trimmedClause.slice(4).trim() };
    }
    if (trimmedClause.startsWith("СЃ ")) {
      return { polarity: true, body: trimmedClause.slice(2).trim() };
    }
    if (trimmedClause.startsWith("РєСЂРѕРјРµ ")) {
      return { polarity: false, body: trimmedClause.slice(6).trim() };
    }
    return null;
  }

  function buildClauseCore(body) {
    const stopWords = new Set(["Рё", "РёР»Рё", "Рё/РёР»Рё", "РёР»Рё/Рё", "РЅР°", "РІ", "РїРѕ", "РґР»СЏ", "РѕС‚", "РґРѕ", "СЃРѕ"]);
    const core = body
      .split(/\s+/)
      .map((token) => normalizeClauseToken(token))
      .filter((token) => token && !stopWords.has(token))
      .join(" ");

    return core
      .replace(/РїР°Р·РѕРІ/g, "РїР°Р·")
      .replace(/РїР°Р·Р°РјРё/g, "РїР°Р·")
      .replace(/С€Р»РёС†РµРІ/g, "С€Р»РёС†")
      .replace(/С€Р»РёС†Р°РјРё/g, "С€Р»РёС†")
      .replace(/РєРѕР»СЊС†РµРІС‹С…/g, "РєРѕР»СЊС†РµРІ")
      .replace(/РєРѕР»СЊС†РµРІС‹РјРё/g, "РєРѕР»СЊС†РµРІ");
  }

  function prettifyClauseBody(body) {
    return body
      .replace(/СЃ РѕС‚РІРµСЂСЃС‚[Р°-СЏ]*/g, "СЃ РѕС‚РІРµСЂСЃС‚РёСЏРјРё")
      .replace(/Р±РµР· РѕС‚РІРµСЂСЃС‚[Р°-СЏ]*/g, "Р±РµР· РѕС‚РІРµСЂСЃС‚РёР№")
      .replace(/РѕС‚РІРµСЂСЃС‚[Р°-СЏ]* РІРЅРµ РѕСЃРё/g, "РѕС‚РІРµСЂСЃС‚РёСЏРјРё РІРЅРµ РѕСЃРё")
      .replace(/СЃ РєРѕР»СЊС†[Р°-СЏ]* РїР°Р·[Р°-СЏ]* РЅР° С‚РѕСЂС†[Р°-СЏ]*/g, "СЃ РєРѕР»СЊС†РµРІС‹РјРё РїР°Р·Р°РјРё РЅР° С‚РѕСЂС†Р°С…")
      .replace(/Р±РµР· РєРѕР»СЊС†[Р°-СЏ]* РїР°Р·[Р°-СЏ]* РЅР° С‚РѕСЂС†[Р°-СЏ]*/g, "Р±РµР· РєРѕР»СЊС†РµРІС‹С… РїР°Р·РѕРІ РЅР° С‚РѕСЂС†Р°С…")
      .replace(/СЃ РїР°Р·[Р°-СЏ]*(?:,?\s*С€Р»РёС†[Р°-СЏ]*)/g, "СЃ РїР°Р·Р°РјРё РёР»Рё С€Р»РёС†Р°РјРё")
      .replace(/Р±РµР· РїР°Р·[Р°-СЏ]* С€Р»РёС†[Р°-СЏ]*/g, "Р±РµР· РїР°Р·РѕРІ Рё С€Р»РёС†РµРІ")
      .replace(/РїР°Р·[Р°-СЏ]* С€Р»РёС†[Р°-СЏ]*/g, "РїР°Р·Р°РјРё РёР»Рё С€Р»РёС†Р°РјРё")
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

    match = findLast(`СЃ РјРѕРґСѓР»РµРј СЃРІ\\.?\\s*${numberPattern}\\s*РґРѕ\\s*${numberPattern}\\s*РјРј`);
    if (match) {
      return {
        min: parseFloat(match[1].replace(/\s*,\s*/g, ".")),
        max: parseFloat(match[2].replace(/\s*,\s*/g, "."))
      };
    }

    match = findLast(`СЃ РјРѕРґСѓР»РµРј СЃРІ\\.?\\s*${numberPattern}\\s*РјРј`);
    if (match) {
      return { min: parseFloat(match[1].replace(/\s*,\s*/g, ".")), max: Number.POSITIVE_INFINITY };
    }

    match = findLast(`СЃ РјРѕРґСѓР»РµРј РґРѕ\\s*${numberPattern}\\s*РјРј`);
    if (match) {
      return { min: Number.NEGATIVE_INFINITY, max: parseFloat(match[1].replace(/\s*,\s*/g, ".")) };
    }

    return null;
  }

  function formatModuleValue(value) {
    return String(value).replace(".", ",");
  }

  function getModuleRangeLabel(range) {
    if (!Number.isFinite(range.min) && Number.isFinite(range.max)) {
      return `Р”Рѕ ${formatModuleValue(range.max)} РјРј`;
    }

    if (Number.isFinite(range.min) && !Number.isFinite(range.max)) {
      return `РЎРІС‹С€Рµ ${formatModuleValue(range.min)} РјРј`;
    }

    if (Number.isFinite(range.min) && Number.isFinite(range.max)) {
      return `РћС‚ ${formatModuleValue(range.min)} РґРѕ ${formatModuleValue(range.max)} РјРј`;
    }

    return null;
  }

  function buildModuleBuckets(items) {
    const ordered = [...items].sort((a, b) => {
      const aStart = Number.isFinite(a.range.min) ? a.range.min : -1;
      const bStart = Number.isFinite(b.range.min) ? b.range.min : -1;
      if (aStart !== bStart) return aStart - bStart;
      const aEnd = Number.isFinite(a.range.max) ? a.range.max : Number.POSITIVE_INFINITY;
      const bEnd = Number.isFinite(b.range.max) ? b.range.max : Number.POSITIVE_INFINITY;
      return aEnd - bEnd;
    });

    const chunkSize = Math.ceil(ordered.length / 6);
    const buckets = [];
    for (let index = 0; index < ordered.length; index += chunkSize) {
      buckets.push(ordered.slice(index, index + chunkSize));
    }
    return buckets;
  }

  const generalEnumFeatureCatalog = {
    base_hole_kind: {
      question: "\u041a\u0430\u043a\u0438\u043c \u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0431\u0430\u0437\u043e\u0432\u043e\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435?",
      order: ["blind", "through", "combined"],
      values: {
        blind: {
          label: "\u0413\u043b\u0443\u0445\u043e\u0435",
          userText: "\u0411\u0430\u0437\u043e\u0432\u043e\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435 \u0433\u043b\u0443\u0445\u043e\u0435"
        },
        through: {
          label: "\u0421\u043a\u0432\u043e\u0437\u043d\u043e\u0435",
          userText: "\u0411\u0430\u0437\u043e\u0432\u043e\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435 \u0441\u043a\u0432\u043e\u0437\u043d\u043e\u0435"
        },
        combined: {
          label: "\u041a\u043e\u043c\u0431\u0438\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0435",
          userText: "\u0411\u0430\u0437\u043e\u0432\u043e\u0435 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\u0438\u0435 \u043a\u043e\u043c\u0431\u0438\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u043e\u0435"
        }
      }
    }
  };

  function buildEnumOptionSplit(parentCode, items, candidateCodes, featureKey, definition) {
    const buckets = new Map();

    candidateCodes.forEach((code) => {
      const value = items[code]?.[featureKey];
      if (!value || !definition.values[value]) {
        return;
      }
      if (!buckets.has(value)) {
        buckets.set(value, []);
      }
      buckets.get(value).push(code);
    });

    if (buckets.size < 2 || buckets.size > 4) {
      return null;
    }

    const coveredCount = [...buckets.values()].reduce((sum, codes) => sum + codes.length, 0);
    if (coveredCount !== candidateCodes.length) {
      return null;
    }

    const orderedValues = definition.order.filter((value) => buckets.has(value));
    return {
      parentCode,
      mode: "options",
      feature: {
        question: definition.question
      },
      options: orderedValues.map((value) => ({
        type: "adaptive",
        label: definition.values[value].label,
        userText: definition.values[value].userText,
        candidateCodes: buckets.get(value),
        featureConstraints: {
          [featureKey]: value
        }
      }))
    };
  }

  function buildModuleSplit(nodes, parentCode) {
    const items = nodes
      .map((node) => ({ node, range: extractModuleRange(pathIndex.get(node.code) || []) }))
      .filter((item) => item.range);

    if (items.length !== nodes.length || items.length < 2) {
      return null;
    }

    const buckets = buildModuleBuckets(items);
    if (buckets.length < 2 || buckets.length > 6) {
      return null;
    }

    const options = buckets.map((bucket) => {
      const first = bucket[0].range;
      const last = bucket[bucket.length - 1].range;
      const label = getModuleRangeLabel({ min: first.min, max: last.max });
      return {
        type: "adaptive",
        label,
        userText: `РњРѕРґСѓР»СЊ ${label.toLowerCase()}`,
        candidateCodes: bucket.map((item) => item.node.code),
        featureConstraints: null
      };
    });

    return {
      parentCode,
      mode: "options",
      feature: {
        question: "РљР°РєРѕР№ РґРёР°РїР°Р·РѕРЅ РјРѕРґСѓР»СЏ РїРѕРґС…РѕРґРёС‚?"
      },
      options
    };
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
        if (descriptor.polarity && !group.positiveText) group.positiveText = `СЃ ${descriptor.body}`;
        if (!descriptor.polarity && !group.negativeText) group.negativeText = `Р±РµР· ${descriptor.body}`;
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
          question: prettyQuestionBody ? `Р’РµСЂРЅРѕ Р»Рё, С‡С‚Рѕ РґРµС‚Р°Р»СЊ ${prettyQuestionBody}?` : "РљР°РєРѕР№ РїСЂРёР·РЅР°Рє Р»СѓС‡С€Рµ РїРѕРґС…РѕРґРёС‚?",
          trueLabel: "Р”Р°",
          falseLabel: "РќРµС‚",
          trueUserText: prettyPositiveBody ? `Р”Р°, РґРµС‚Р°Р»СЊ ${prettyPositiveBody}` : "Р”Р°",
          falseUserText: prettyNegativeBody ? `РќРµС‚, РґРµС‚Р°Р»СЊ ${prettyNegativeBody}` : "РќРµС‚"
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
    if (/\u0431\u0435\u0437 \u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause)) setFeatureValue(features, "has_center_hole", false);
    if (/\u043a\u0440\u043e\u043c\u0435 \u0448\u0430\u0440\w*/.test(clause)) setFeatureValue(features, "is_sphere", false);
    if (/\u0448\u0430\u0440\w*/.test(clause) && !/\u043a\u0440\u043e\u043c\u0435 \u0448\u0430\u0440\w*/.test(clause)) setFeatureValue(features, "is_sphere", true);
    if (/\u0441\u043f\u043b\u043e\u0448\u043d\w*/.test(clause)) setFeatureValue(features, "is_hollow_sphere", false);
    if (/\b\u043f\u043e\u043b(?:\u044b\u0439|\u0430\u044f|\u043e\u0435|\u044b\u0435|\u043e\u0433\u043e|\u043e\u0439|\u044b\u0445)\w*/.test(clause)) setFeatureValue(features, "is_hollow_sphere", true);
    if (/\u0431\u0435\u0437 \u044d\u043b-?\u0442\w* \u0434\u043b\u044f \u043f\u043e\u0434\u0432\u0435\u0441\u043a\u0438/.test(clause)) setFeatureValue(features, "has_suspension_element", false);
    if (/\u0441 \u044d\u043b-?\u0442\w* \u0434\u043b\u044f \u043f\u043e\u0434\u0432\u0435\u0441\u043a\u0438/.test(clause)) setFeatureValue(features, "has_suspension_element", true);
    if (/\u0431\u0435\u0437 \u043c\u0435\u0441\u0442\u043d\w* \u0438\u0437\u0433\u0438\u0431\w*/.test(clause)) setFeatureValue(features, "has_local_bends", false);
    if (/\u0441 \u043c\u0435\u0441\u0442\u043d\w* \u0438\u0437\u0433\u0438\u0431\w*/.test(clause)) setFeatureValue(features, "has_local_bends", true);
    if (/\u0431\u0435\u0437 \u043f\u0430\u0437\w*/.test(clause) && !/\u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\w*|\u0442\u043e\u0440\u0446\w*|\u0448\u043b\u0438\u0446\w*/.test(clause)) setFeatureValue(features, "has_slots", false);
    if (/\u0441 \u043f\u0430\u0437\w*/.test(clause) && !/\u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\w*|\u0442\u043e\u0440\u0446\w*|\u0448\u043b\u0438\u0446\w*/.test(clause)) setFeatureValue(features, "has_slots", true);
    if (/\u0431\u0435\u0437 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\w*/.test(clause) && !/\u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w*|\u0432\u043d\u0435 \u043e\u0441\u0438/.test(clause)) setFeatureValue(features, "has_holes", false);
    if ((/\u0441 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\w*/.test(clause) || /\u0438\/\u0438\u043b\u0438 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\w*/.test(clause)) && !/\u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w*|\u0432\u043d\u0435 \u043e\u0441\u0438/.test(clause)) setFeatureValue(features, "has_holes", true);
    if (/\u0431\u0435\u0437 \u043f\u0430\u0437\w* \u0438 \u0432\u044b\u0441\u0442\u0443\u043f\w* \u043d\u0430 \u0442\u043e\u0440\u0446\w* \u0441\u0442\u0443\u043f\u0438\u0446\w*/.test(clause)) setFeatureValue(features, "has_hub_face_slots_or_lugs", false);
    if (/\u0441 \u043f\u0430\u0437\w* \u0438 \u0432\u044b\u0441\u0442\u0443\u043f\w* \u043d\u0430 \u0442\u043e\u0440\u0446\w* \u0441\u0442\u0443\u043f\u0438\u0446\w*/.test(clause)) setFeatureValue(features, "has_hub_face_slots_or_lugs", true);
    if (/\u043a\u0440\u043e\u043c\u0435 \u043a\u043e\u043b\u044c\u0446\u0435\u0432\w*/.test(clause)) setFeatureValue(features, "is_ring_sector", false);
    if (/\u043a\u043e\u043b\u044c\u0446\u0435\u0432\w*/.test(clause) && !/\u043a\u0440\u043e\u043c\u0435 \u043a\u043e\u043b\u044c\u0446\u0435\u0432\w*/.test(clause)) setFeatureValue(features, "is_ring_sector", true);
    if (/\u0441 \u0432\u043d\u0443\u0442\u0440\w* \u043e\u0441\u043d\w* \u0431\u0430\u0437\w*/.test(clause)) setFeatureValue(features, "has_inner_base", true);
    if (/\u0441 \u043d\u0430\u0440\w* \u043e\u0441\u043d\w* \u0431\u0430\u0437\w*/.test(clause)) setFeatureValue(features, "has_inner_base", false);
    if (/\u0431\u0435\u0437 \u0444\u043b\u0430\u043d\u0446\w*/.test(clause)) setFeatureValue(features, "has_flanges", false);
    if (/\u0441 \u0444\u043b\u0430\u043d\u0446\w*/.test(clause)) setFeatureValue(features, "has_flanges", true);
    if (/\u043f\u043e \u043f\u0440\u043e\u0444\u0438\u043b\w* \u0437\u0443\u0431\w*/.test(clause)) setFeatureValue(features, "base_by_tooth_profile", true);
    if (/\u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w* \u0433\u043b\u0443\u0445\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause) || /\u0433\u043b\u0443\u0445\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause)) {
      setFeatureValue(features, "has_center_hole", true);
      setFeatureValue(features, "is_blind_hole", true);
    }
    if (/\u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w* \u0441\u043a\u0432\u043e\u0437\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause) || /\u0441\u043a\u0432\u043e\u0437\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause)) {
      setFeatureValue(features, "has_center_hole", true);
      setFeatureValue(features, "is_blind_hole", false);
    }
    if (/\u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause) && !/\u0431\u0435\u0437 \u0446\u0435\u043d\u0442\u0440\u0430\u043b\u044c\u043d\w* \u043e\u0442\u0432\u0435\u0440\u0441\u0442/.test(clause)) {
      setFeatureValue(features, "has_center_hole", true);
    }
    if (/\u0431\u0435\u0437 \u0440\u0435\u0437\u044c\u0431/.test(clause)) setFeatureValue(features, "has_thread_in_hole", false);
    if (/\u0441 \u0440\u0435\u0437\u044c\u0431/.test(clause) || /\u0440\u0435\u0437\u044c\u0431\u043e\u0432/.test(clause)) setFeatureValue(features, "has_thread_in_hole", true);
    if (/\u0441\u0442\u0443\u043f\u0435\u043d\u0447\u0430\u0442/.test(clause)) setFeatureValue(features, "is_stepped_hole", true);
    if (/\u0433\u043b\u0430\u0434\u043a/.test(clause)) setFeatureValue(features, "is_stepped_hole", false);
    if (/\u043d\u0435\u043a\u0440\u0443\u0433\u043b/.test(clause)) setFeatureValue(features, "is_round_hole", false);
    if (/\u043a\u0440\u0443\u0433\u043b/.test(clause) && !/\u043d\u0435\u043a\u0440\u0443\u0433\u043b/.test(clause)) setFeatureValue(features, "is_round_hole", true);
    if (/\u0431\u0435\u0437 \u043a\u043e\u043b\u044c\u0446\u0435\u0432\w* \u043f\u0430\u0437\w* \u043d\u0430 \u0442\u043e\u0440\u0446/.test(clause)) setFeatureValue(features, "has_face_ring_grooves", false);
    if (/\u0441 \u043a\u043e\u043b\u044c\u0446\u0435\u0432\w* \u043f\u0430\u0437\w* \u043d\u0430 \u0442\u043e\u0440\u0446/.test(clause)) setFeatureValue(features, "has_face_ring_grooves", true);
    if ((/\u0431\u0435\u0437 \u043f\u0430\u0437\w* \u0438 \u0448\u043b\u0438\u0446\w* \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442/.test(clause))
      || (/\u0431\u0435\u0437 \u043f\u0430\u0437\w* \u0448\u043b\u0438\u0446\w* \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442/.test(clause))
      || (/\u0431\u0435\u0437 \u043f\u0430\u0437\w* \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442/.test(clause))
      || (/\u0431\u0435\u0437 \u0448\u043b\u0438\u0446\w* \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442/.test(clause))) {
      setFeatureValue(features, "has_outer_slots_or_splines", false);
    }
    if ((/\u0441 \u043f\u0430\u0437\w*(?:,?\s*\u0448\u043b\u0438\u0446\w*| \u0438\/\u0438\u043b\u0438 \u0448\u043b\u0438\u0446\w*| \u0448\u043b\u0438\u0446\w*)? \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442/.test(clause))
      || (/\u0441[\u043e]?\s*\u0448\u043b\u0438\u0446\w* \u043d\u0430 \u043d\u0430\u0440\u0443\u0436\u043d\w* \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442/.test(clause))) {
      setFeatureValue(features, "has_outer_slots_or_splines", true);
    }
    if (/\u0431\u0435\u0437 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\w* \u0432\u043d\u0435 \u043e\u0441\u0438/.test(clause)) setFeatureValue(features, "has_off_axis_holes", false);
    if (/\u0441 \u043e\u0442\u0432\u0435\u0440\u0441\u0442\w* \u0432\u043d\u0435 \u043e\u0441\u0438/.test(clause)) setFeatureValue(features, "has_off_axis_holes", true);
  }

  function extractRotationFeaturesFromPath(pathSegments) {
    const features = {};
    parseEskdClauses(pathSegments).forEach((clause) => mapClauseToFeatures(clause, features));
    return features;
  }

  function extractGeneralFeaturesFromPath(pathSegments) {
    const features = {};
    parseEskdClauses(pathSegments).forEach((clause) => mapClauseToFeatures(clause, features));

    const leafSegment = normalizeDescriptionText(pathSegments[pathSegments.length - 1] || "");
    if (/\u043a\u043e\u043c\u0431\u0438\u043d\u0438\u0440/.test(leafSegment)) {
      features.base_hole_kind = "combined";
    } else if (/\u0441\u043a\u0432\u043e\u0437/.test(leafSegment)) {
      features.base_hole_kind = "through";
    } else if (/\u0433\u043b\u0443\u0445/.test(leafSegment)) {
      features.base_hole_kind = "blind";
    }

    if (/\u0431\u0435\u0437 \u0440\u0435\u0431\u0435\u0440 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f/.test(leafSegment)) {
      features.has_cooling_ribs = false;
    } else if (/\u0441 \u0440\u0435\u0431\u0440\u0430\u043c\u0438 \u043e\u0445\u043b\u0430\u0436\u0434\u0435\u043d\u0438\u044f/.test(leafSegment)) {
      features.has_cooling_ribs = true;
    }

    if (/\u043d\u0435\u043f\u0430\u0440\u0430\u043b/.test(leafSegment)) {
      features.base_hole_orientation_parallel = false;
    } else if (/\u043f\u0430\u0440\u0430\u043b/.test(leafSegment) && !/\u043f\u0430\u0440\u0430\u043b\.\s*\u0438\s*\u043d\u0435\u043f\u0430\u0440\u0430\u043b/.test(leafSegment)) {
      features.base_hole_orientation_parallel = true;
    }

    return features;
  }

  function getChildren(node) {
    if (!node || !node.children) return [];
    return Object.values(node.children).filter(Boolean).sort(compareNodeCodes);
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

  function getGeneralHeuristicSplit(nodes) {
    const candidateCodes = nodes.map((node) => node.code);
    const items = {};
    nodes.forEach((node) => {
      items[node.code] = extractGeneralFeaturesFromPath(pathIndex.get(node.code) || []);
    });

    const parentCode = getSharedParentCode(nodes) || "general";
    const enumSplit = buildEnumOptionSplit(parentCode, items, candidateCodes, "base_hole_kind", generalEnumFeatureCatalog.base_hole_kind);
    if (enumSplit) {
      return enumSplit;
    }

    return evaluateAdaptiveSplit(generalFeatureCatalog, items, candidateCodes, parentCode);
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

    const rotationSplit = getRotationHeuristicSplit(nodes);
    if (rotationSplit) return rotationSplit;

    return getGeneralHeuristicSplit(nodes);
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
    if (explicitValue !== undefined) return explicitValue;
    if (node.code.startsWith("71") || node.code.startsWith("72")) {
      return extractRotationFeaturesFromPath(pathIndex.get(node.code) || [])[featureKey];
    }
    return extractGeneralFeaturesFromPath(pathIndex.get(node.code) || [])[featureKey];
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
    if (options.length === 0) return "РџРѕРґС…РѕРґСЏС‰РёРµ РІР°СЂРёР°РЅС‚С‹ РЅРµ РЅР°Р№РґРµРЅС‹";
    const codeLength = options[0].code.length;
    const prefixes = activeBranchPrefixes || [];
    const isRotationBranch = prefixes.length > 0 && prefixes.every((prefix) => prefix.startsWith("71") || prefix.startsWith("72"));

    if (isRotationBranch && codeLength === 3) return "\u041a\u0430\u043a\u0430\u044f \u0433\u0440\u0443\u043f\u043f\u0430 \u0434\u0435\u0442\u0430\u043b\u0435\u0439 \u0431\u043b\u0438\u0436\u0435 \u043f\u043e \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e?";
    if (isRotationBranch && codeLength === 4) return "\u041a\u0430\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0444\u043e\u0440\u043c\u044b \u0431\u043b\u0438\u0436\u0435 \u0432\u0441\u0435\u0433\u043e?";
    if (isRotationBranch && codeLength === 5) return "\u041a\u0430\u043a\u043e\u0439 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u043f\u0440\u0438\u0437\u043d\u0430\u043a \u043b\u0443\u0447\u0448\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442?";
    if (isRotationBranch) return "\u041a\u0430\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u0442\u043e\u0447\u043d\u0435\u0435?";
    if (codeLength <= 2) return "Р’С‹Р±РµСЂРё РЅР°РёР±РѕР»РµРµ РїРѕРґС…РѕРґСЏС‰РёР№ СЂР°Р·РґРµР»";
    if (codeLength === 3) return "\u0427\u0442\u043e \u043b\u0443\u0447\u0448\u0435 \u0432\u0441\u0435\u0433\u043e \u043e\u043f\u0438\u0441\u044b\u0432\u0430\u0435\u0442 \u0438\u0437\u0434\u0435\u043b\u0438\u0435?";
    if (codeLength === 4) return "\u041a\u0430\u043a\u043e\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f \u0431\u043b\u0438\u0436\u0435?";
    if (codeLength === 5) return "\u041a\u0430\u043a\u043e\u0439 \u043f\u0440\u0438\u0437\u043d\u0430\u043a \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u043b\u0443\u0447\u0448\u0435?";
    return "\u041a\u0430\u043a\u043e\u0435 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u0442\u043e\u0447\u043d\u0435\u0435?";
  }

  return {
    loadData(treeData, flowData, adaptiveData) {
      treeRoots = Object.values(treeData).filter(Boolean).sort(compareNodeCodes);
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
