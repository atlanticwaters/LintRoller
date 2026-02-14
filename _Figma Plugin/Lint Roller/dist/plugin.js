"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/shared/types.ts
  function getDefaultConfig() {
    return {
      rules: {
        "no-hardcoded-colors": { enabled: true, severity: "error" },
        "no-hardcoded-typography": { enabled: true, severity: "warning" },
        "no-hardcoded-spacing": { enabled: true, severity: "warning" },
        "no-hardcoded-radii": { enabled: true, severity: "warning" },
        "no-hardcoded-stroke-weight": { enabled: true, severity: "warning" },
        "no-hardcoded-sizing": { enabled: true, severity: "warning" },
        "no-orphaned-variables": { enabled: true, severity: "error" },
        "no-unknown-styles": { enabled: true, severity: "warning" },
        "prefer-semantic-variables": { enabled: true, severity: "warning" }
      },
      skipHiddenLayers: true,
      skipLockedLayers: false
    };
  }

  // src/shared/color-distance.ts
  function hexToRgb(hex) {
    const cleaned = hex.replace(/^#/, "");
    let fullHex = cleaned;
    if (cleaned.length === 3) {
      fullHex = cleaned.split("").map((c) => c + c).join("");
    }
    if (fullHex.length === 8) {
      fullHex = fullHex.slice(0, 6);
    }
    if (fullHex.length !== 6) {
      return null;
    }
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }
    return { r, g, b };
  }
  function rgbToXyz(rgb) {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    r *= 100;
    g *= 100;
    b *= 100;
    return {
      x: r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
      y: r * 0.2126729 + g * 0.7151522 + b * 0.072175,
      z: r * 0.0193339 + g * 0.119192 + b * 0.9503041
    };
  }
  function xyzToLab(xyz) {
    const refX = 95.047;
    const refY = 100;
    const refZ = 108.883;
    let x = xyz.x / refX;
    let y = xyz.y / refY;
    let z = xyz.z / refZ;
    const epsilon = 8856e-6;
    const kappa = 903.3;
    x = x > epsilon ? Math.pow(x, 1 / 3) : (kappa * x + 16) / 116;
    y = y > epsilon ? Math.pow(y, 1 / 3) : (kappa * y + 16) / 116;
    z = z > epsilon ? Math.pow(z, 1 / 3) : (kappa * z + 16) / 116;
    return {
      L: 116 * y - 16,
      a: 500 * (x - y),
      b: 200 * (y - z)
    };
  }
  function hexToLab(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const xyz = rgbToXyz(rgb);
    return xyzToLab(xyz);
  }
  function deltaE2000(lab1, lab2) {
    const L1 = lab1.L;
    const a1 = lab1.a;
    const b1 = lab1.b;
    const L2 = lab2.L;
    const a2 = lab2.a;
    const b2 = lab2.b;
    const kL = 1;
    const kC = 1;
    const kH = 1;
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cab = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));
    const a1Prime = a1 * (1 + G);
    const a2Prime = a2 * (1 + G);
    const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
    const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
    const h1Prime = calculateHPrime(a1Prime, b1);
    const h2Prime = calculateHPrime(a2Prime, b2);
    const deltaLPrime = L2 - L1;
    const deltaCPrime = C2Prime - C1Prime;
    const deltaHPrime = calculateDeltaHPrime(C1Prime, C2Prime, h1Prime, h2Prime);
    const LPrimeAvg = (L1 + L2) / 2;
    const CPrimeAvg = (C1Prime + C2Prime) / 2;
    const hPrimeAvg = calculateHPrimeAvg(C1Prime, C2Prime, h1Prime, h2Prime);
    const T = 1 - 0.17 * Math.cos(degToRad(hPrimeAvg - 30)) + 0.24 * Math.cos(degToRad(2 * hPrimeAvg)) + 0.32 * Math.cos(degToRad(3 * hPrimeAvg + 6)) - 0.2 * Math.cos(degToRad(4 * hPrimeAvg - 63));
    const deltaTheta = 30 * Math.exp(-Math.pow((hPrimeAvg - 275) / 25, 2));
    const RC = 2 * Math.sqrt(Math.pow(CPrimeAvg, 7) / (Math.pow(CPrimeAvg, 7) + Math.pow(25, 7)));
    const SL = 1 + 0.015 * Math.pow(LPrimeAvg - 50, 2) / Math.sqrt(20 + Math.pow(LPrimeAvg - 50, 2));
    const SC = 1 + 0.045 * CPrimeAvg;
    const SH = 1 + 0.015 * CPrimeAvg * T;
    const RT = -Math.sin(degToRad(2 * deltaTheta)) * RC;
    const deltaE = Math.sqrt(
      Math.pow(deltaLPrime / (kL * SL), 2) + Math.pow(deltaCPrime / (kC * SC), 2) + Math.pow(deltaHPrime / (kH * SH), 2) + RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
    );
    return deltaE;
  }
  function calculateHPrime(aPrime, b) {
    if (aPrime === 0 && b === 0) {
      return 0;
    }
    let h = radToDeg(Math.atan2(b, aPrime));
    if (h < 0) {
      h += 360;
    }
    return h;
  }
  function calculateDeltaHPrime(C1Prime, C2Prime, h1Prime, h2Prime) {
    if (C1Prime * C2Prime === 0) {
      return 0;
    }
    let deltaH = h2Prime - h1Prime;
    if (Math.abs(deltaH) > 180) {
      if (h2Prime <= h1Prime) {
        deltaH += 360;
      } else {
        deltaH -= 360;
      }
    }
    return 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(degToRad(deltaH / 2));
  }
  function calculateHPrimeAvg(C1Prime, C2Prime, h1Prime, h2Prime) {
    if (C1Prime * C2Prime === 0) {
      return h1Prime + h2Prime;
    }
    if (Math.abs(h1Prime - h2Prime) <= 180) {
      return (h1Prime + h2Prime) / 2;
    }
    if (h1Prime + h2Prime < 360) {
      return (h1Prime + h2Prime + 360) / 2;
    }
    return (h1Prime + h2Prime - 360) / 2;
  }
  function degToRad(deg) {
    return deg * Math.PI / 180;
  }
  function radToDeg(rad) {
    return rad * 180 / Math.PI;
  }
  function findClosestColors(targetHex, colorTokens, colorLab, maxResults = 5, maxDeltaE = 10) {
    const targetLabResult = hexToLab(targetHex);
    if (!targetLabResult) {
      return [];
    }
    const targetLab = targetLabResult;
    const normalizedTarget = targetHex.toLowerCase();
    const matches = [];
    for (const [hex, tokenPath] of colorTokens.entries()) {
      const normalizedHex = hex.toLowerCase();
      if (normalizedHex === normalizedTarget || normalizedHex === normalizedTarget.slice(0, 7)) {
        matches.push({
          tokenPath,
          tokenHex: hex,
          deltaE: 0,
          isExact: true
        });
        continue;
      }
      let tokenLabValue = null;
      if (colorLab) {
        const cached = colorLab.get(hex);
        if (cached) {
          tokenLabValue = cached;
        }
      }
      if (!tokenLabValue) {
        tokenLabValue = hexToLab(hex);
      }
      if (!tokenLabValue) continue;
      const deltaE = deltaE2000(targetLab, tokenLabValue);
      if (deltaE <= maxDeltaE) {
        matches.push({
          tokenPath,
          tokenHex: hex,
          deltaE,
          isExact: false
        });
      }
    }
    matches.sort((a, b) => {
      if (a.isExact && !b.isExact) return -1;
      if (!a.isExact && b.isExact) return 1;
      return a.deltaE - b.deltaE;
    });
    return matches.slice(0, maxResults);
  }
  function getDeltaEDescription(deltaE) {
    if (deltaE === 0) {
      return "exact match";
    } else if (deltaE < 1) {
      return "visually identical";
    } else if (deltaE < 2) {
      return "barely perceptible difference";
    } else if (deltaE < 5) {
      return "slight difference";
    } else if (deltaE < 10) {
      return "noticeable difference";
    } else {
      return "significant difference";
    }
  }

  // src/shared/token-parser.ts
  function isAliasValue(value) {
    return typeof value === "string" && /^\{[^}]+\}$/.test(value);
  }
  function extractAliasPath(value) {
    return value.slice(1, -1);
  }
  function isToken(obj) {
    return typeof obj === "object" && obj !== null && "$value" in obj && !("$themes" in obj);
  }
  function normalizeColor(value) {
    if (value.startsWith("#")) {
      return value.toLowerCase();
    }
    return value;
  }
  var TokenParser = class {
    constructor() {
      this.rawTokens = /* @__PURE__ */ new Map();
      this.resolvedTokens = /* @__PURE__ */ new Map();
      this.resolutionStack = /* @__PURE__ */ new Set();
    }
    /**
     * Parse token files and resolve all aliases
     */
    parseTokenFiles(files, metadata) {
      this.rawTokens.clear();
      this.resolvedTokens.clear();
      const orderedFiles = this.orderFiles(files, metadata);
      for (const file of orderedFiles) {
        this.parseTokenFile(file.content, file.path);
      }
      this.resolveAllAliases();
      return this.buildCollection();
    }
    /**
     * Order files according to metadata tokenSetOrder
     */
    orderFiles(files, metadata) {
      if (!(metadata == null ? void 0 : metadata.tokenSetOrder)) {
        return files;
      }
      const ordered = [];
      const remaining = new Set(files);
      for (const setPath of metadata.tokenSetOrder) {
        const file = files.find((f) => f.path === setPath || f.path.replace(/\.json$/, "") === setPath);
        if (file) {
          ordered.push(file);
          remaining.delete(file);
        }
      }
      for (const file of remaining) {
        ordered.push(file);
      }
      return ordered;
    }
    /**
     * Recursively parse a token file into the raw tokens map
     */
    parseTokenFile(content, sourcePath, pathPrefix = "") {
      for (const [key, value] of Object.entries(content)) {
        if (key.startsWith("$")) {
          continue;
        }
        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (isToken(value)) {
          this.rawTokens.set(currentPath, {
            $value: value.$value,
            $type: value.$type,
            $description: value.$description,
            $extensions: value.$extensions,
            _sourcePath: sourcePath
          });
        } else if (typeof value === "object" && value !== null) {
          this.parseTokenFile(value, sourcePath, currentPath);
        }
      }
    }
    /**
     * Resolve all aliases in the raw tokens
     */
    resolveAllAliases() {
      for (const path of this.rawTokens.keys()) {
        if (!this.resolvedTokens.has(path)) {
          this.resolveToken(path);
        }
      }
    }
    /**
     * Resolve a single token, following alias chain if needed
     */
    resolveToken(path) {
      if (this.resolvedTokens.has(path)) {
        return this.resolvedTokens.get(path);
      }
      const raw = this.rawTokens.get(path);
      if (!raw) {
        throw new Error(`Token not found: ${path}`);
      }
      if (this.resolutionStack.has(path)) {
        const cycle = [...this.resolutionStack, path].join(" -> ");
        throw new Error(`Circular reference detected: ${cycle}`);
      }
      const value = raw.$value;
      if (isAliasValue(value)) {
        const aliasPath = extractAliasPath(value);
        this.resolutionStack.add(path);
        let referenced;
        try {
          referenced = this.resolveToken(aliasPath);
        } catch (error) {
          if (error.message.includes("Token not found")) {
            const resolved3 = {
              path,
              rawValue: value,
              resolvedValue: value,
              // Keep alias as-is
              type: raw.$type || "color",
              description: raw.$description,
              isAlias: true,
              aliasPath,
              sourceFile: raw._sourcePath
            };
            this.resolvedTokens.set(path, resolved3);
            this.resolutionStack.delete(path);
            return resolved3;
          }
          throw error;
        }
        this.resolutionStack.delete(path);
        const resolved2 = {
          path,
          rawValue: value,
          resolvedValue: referenced.resolvedValue,
          type: raw.$type || referenced.type,
          description: raw.$description,
          isAlias: true,
          aliasPath,
          sourceFile: raw._sourcePath
        };
        this.resolvedTokens.set(path, resolved2);
        return resolved2;
      }
      let resolvedValue = value;
      if (raw.$type === "color" && typeof value === "string") {
        resolvedValue = normalizeColor(value);
      }
      if ((raw.$type === "number" || raw.$type === "dimension") && typeof value === "string") {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          resolvedValue = parsed;
        }
      }
      const resolved = {
        path,
        rawValue: value,
        resolvedValue,
        type: raw.$type || "color",
        description: raw.$description,
        isAlias: false,
        sourceFile: raw._sourcePath
      };
      this.resolvedTokens.set(path, resolved);
      return resolved;
    }
    /**
     * Check if a token is a semantic token (should be preferred for suggestions)
     * Semantic tokens are those that reference core tokens and provide contextual meaning
     */
    isSemanticToken(token) {
      var _a;
      if ((_a = token.sourceFile) == null ? void 0 : _a.includes("semantic")) {
        return true;
      }
      if (token.path.startsWith("system.") || token.path.startsWith("component.")) {
        return true;
      }
      if (token.isAlias && token.aliasPath) {
        return true;
      }
      return false;
    }
    /**
     * Build the final TokenCollection with lookup indexes
     * Prioritizes semantic tokens over core tokens for suggestions
     */
    buildCollection() {
      const tokens = new Map(this.resolvedTokens);
      const byType = /* @__PURE__ */ new Map();
      const colorValues = /* @__PURE__ */ new Map();
      const colorTokensByHex = /* @__PURE__ */ new Map();
      const numberValues = /* @__PURE__ */ new Map();
      const colorLab = /* @__PURE__ */ new Map();
      const colorIsSemanticMap = /* @__PURE__ */ new Map();
      for (const token of tokens.values()) {
        const typeList = byType.get(token.type) || [];
        typeList.push(token);
        byType.set(token.type, typeList);
        if (token.type === "color" && typeof token.resolvedValue === "string") {
          const hex = token.resolvedValue.toLowerCase();
          if (hex.startsWith("#")) {
            const isSemantic = this.isSemanticToken(token);
            const existingIsSemantic = colorIsSemanticMap.get(hex) || false;
            const allPaths = colorTokensByHex.get(hex) || [];
            if (isSemantic) {
              allPaths.unshift(token.path);
            } else {
              allPaths.push(token.path);
            }
            colorTokensByHex.set(hex, allPaths);
            if (!colorValues.has(hex) || isSemantic && !existingIsSemantic) {
              colorValues.set(hex, token.path);
              colorIsSemanticMap.set(hex, isSemantic);
              const lab = hexToLab(hex);
              if (lab) {
                colorLab.set(hex, lab);
              }
            }
          }
        }
        if ((token.type === "number" || token.type === "dimension") && typeof token.resolvedValue === "number") {
          const list = numberValues.get(token.resolvedValue) || [];
          const isSemantic = this.isSemanticToken(token);
          if (isSemantic) {
            list.unshift(token.path);
          } else {
            list.push(token.path);
          }
          numberValues.set(token.resolvedValue, list);
        }
      }
      return {
        tokens,
        byType,
        colorValues,
        colorTokensByHex,
        numberValues,
        colorLab
      };
    }
  };

  // src/plugin/scanner.ts
  var FigmaScanner = class {
    constructor(config) {
      this.config = config;
    }
    /**
     * Gather all nodes to scan based on scope
     */
    async gatherNodes(scope) {
      const options = {
        skipHidden: this.config.skipHiddenLayers,
        skipLocked: this.config.skipLockedLayers
      };
      switch (scope.type) {
        case "selection":
          return this.flattenNodes(figma.currentPage.selection, options);
        case "current_page":
          return this.flattenNodes(figma.currentPage.children, options);
        case "full_document": {
          const allNodes = [];
          for (const page of figma.root.children) {
            const pageNodes = this.flattenNodes(page.children, options);
            allNodes.push(...pageNodes);
          }
          return allNodes;
        }
      }
    }
    /**
     * Flatten a node tree into an array, respecting skip options
     */
    flattenNodes(nodes, options) {
      const result = [];
      const traverse = (node) => {
        if (options.skipHidden && "visible" in node && !node.visible) {
          return;
        }
        if (options.skipLocked && "locked" in node && node.locked) {
          return;
        }
        result.push(node);
        if ("children" in node) {
          const children = node.children;
          for (const child of children) {
            traverse(child);
          }
        }
      };
      for (const node of nodes) {
        traverse(node);
      }
      return result;
    }
    /**
     * Get the layer path for a node (e.g., "Frame > Group > Rectangle")
     */
    static getLayerPath(node) {
      const path = [node.name];
      let current = node.parent;
      while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
        path.unshift(current.name);
        current = current.parent;
      }
      return path.join(" > ");
    }
    /**
     * Navigate to a node in Figma
     */
    static async selectNode(nodeId) {
      const node = figma.getNodeById(nodeId);
      if (!node) {
        return false;
      }
      let page = node.parent;
      while (page && page.type !== "PAGE") {
        page = page.parent;
      }
      if (page && page.type === "PAGE") {
        await figma.setCurrentPageAsync(page);
      }
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      return true;
    }
  };

  // src/plugin/inspector.ts
  function rgbToHex(color) {
    const r = Math.round(color.r * 255).toString(16).padStart(2, "0");
    const g = Math.round(color.g * 255).toString(16).padStart(2, "0");
    const b = Math.round(color.b * 255).toString(16).padStart(2, "0");
    if ("a" in color && color.a < 1) {
      const a = Math.round(color.a * 255).toString(16).padStart(2, "0");
      return `#${r}${g}${b}${a}`.toLowerCase();
    }
    return `#${r}${g}${b}`.toLowerCase();
  }
  var PropertyInspector = class {
    /**
     * Inspect fills and strokes for color bindings
     */
    inspectPaints(node) {
      const results = [];
      if ("fills" in node && Array.isArray(node.fills)) {
        const boundVars = node.boundVariables || {};
        const fillBindings = boundVars.fills;
        for (let i = 0; i < node.fills.length; i++) {
          const fill = node.fills[i];
          if (fill.type === "SOLID" && fill.visible !== false) {
            const binding = fillBindings == null ? void 0 : fillBindings[i];
            results.push({
              property: `fills[${i}]`,
              isBound: !!(binding == null ? void 0 : binding.id),
              boundVariableId: binding == null ? void 0 : binding.id,
              rawValue: fill.color
            });
          }
        }
      }
      if ("strokes" in node && Array.isArray(node.strokes)) {
        const boundVars = node.boundVariables || {};
        const strokeBindings = boundVars.strokes;
        for (let i = 0; i < node.strokes.length; i++) {
          const stroke = node.strokes[i];
          if (stroke.type === "SOLID" && stroke.visible !== false) {
            const binding = strokeBindings == null ? void 0 : strokeBindings[i];
            results.push({
              property: `strokes[${i}]`,
              isBound: !!(binding == null ? void 0 : binding.id),
              boundVariableId: binding == null ? void 0 : binding.id,
              rawValue: stroke.color
            });
          }
        }
      }
      return results;
    }
    /**
     * Inspect typography properties on text nodes
     */
    inspectTypography(node) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      const results = [];
      const boundVars = node.boundVariables || {};
      const textStyleId = node.textStyleId;
      const hasTextStyle = textStyleId && textStyleId !== "" && typeof textStyleId !== "symbol";
      if (hasTextStyle) {
        if (typeof node.paragraphSpacing === "number" && node.paragraphSpacing > 0) {
          results.push({
            property: "paragraphSpacing",
            isBound: !!((_a = boundVars.paragraphSpacing) == null ? void 0 : _a.id),
            boundVariableId: (_b = boundVars.paragraphSpacing) == null ? void 0 : _b.id,
            rawValue: node.paragraphSpacing
          });
        }
        return results;
      }
      if (node.fontSize !== figma.mixed) {
        results.push({
          property: "fontSize",
          isBound: !!((_c = boundVars.fontSize) == null ? void 0 : _c.id),
          boundVariableId: (_d = boundVars.fontSize) == null ? void 0 : _d.id,
          rawValue: node.fontSize
        });
      }
      if (node.lineHeight !== figma.mixed) {
        const lineHeight = node.lineHeight;
        if (lineHeight.unit !== "AUTO") {
          results.push({
            property: "lineHeight",
            isBound: !!((_e = boundVars.lineHeight) == null ? void 0 : _e.id),
            boundVariableId: (_f = boundVars.lineHeight) == null ? void 0 : _f.id,
            rawValue: lineHeight.value
          });
        }
      }
      if (node.letterSpacing !== figma.mixed) {
        const letterSpacing = node.letterSpacing;
        if (letterSpacing.value !== 0) {
          results.push({
            property: "letterSpacing",
            isBound: !!((_g = boundVars.letterSpacing) == null ? void 0 : _g.id),
            boundVariableId: (_h = boundVars.letterSpacing) == null ? void 0 : _h.id,
            rawValue: letterSpacing.value
          });
        }
      }
      if (typeof node.paragraphSpacing === "number" && node.paragraphSpacing > 0) {
        results.push({
          property: "paragraphSpacing",
          isBound: !!((_i = boundVars.paragraphSpacing) == null ? void 0 : _i.id),
          boundVariableId: (_j = boundVars.paragraphSpacing) == null ? void 0 : _j.id,
          rawValue: node.paragraphSpacing
        });
      }
      return results;
    }
    /**
     * Inspect spacing/layout properties on auto-layout frames
     */
    inspectSpacing(node) {
      var _a, _b, _c, _d, _e, _f;
      const results = [];
      const boundVars = node.boundVariables || {};
      if (node.layoutMode === "NONE") {
        return results;
      }
      if (node.itemSpacing > 0) {
        results.push({
          property: "itemSpacing",
          isBound: !!((_a = boundVars.itemSpacing) == null ? void 0 : _a.id),
          boundVariableId: (_b = boundVars.itemSpacing) == null ? void 0 : _b.id,
          rawValue: node.itemSpacing
        });
      }
      if ("counterAxisSpacing" in node && node.counterAxisSpacing !== null && node.counterAxisSpacing > 0) {
        results.push({
          property: "counterAxisSpacing",
          isBound: !!((_c = boundVars.counterAxisSpacing) == null ? void 0 : _c.id),
          boundVariableId: (_d = boundVars.counterAxisSpacing) == null ? void 0 : _d.id,
          rawValue: node.counterAxisSpacing
        });
      }
      const paddingProps = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
      for (const prop of paddingProps) {
        const value = node[prop];
        if (value > 0) {
          results.push({
            property: prop,
            isBound: !!((_e = boundVars[prop]) == null ? void 0 : _e.id),
            boundVariableId: (_f = boundVars[prop]) == null ? void 0 : _f.id,
            rawValue: value
          });
        }
      }
      return results;
    }
    /**
     * Inspect corner radius properties
     */
    inspectRadius(node) {
      var _a, _b, _c, _d;
      const results = [];
      if (!("cornerRadius" in node)) {
        return results;
      }
      const boundVars = node.boundVariables || {};
      if (typeof node.cornerRadius === "number") {
        if (node.cornerRadius > 0) {
          results.push({
            property: "cornerRadius",
            isBound: !!((_a = boundVars.topLeftRadius) == null ? void 0 : _a.id),
            boundVariableId: (_b = boundVars.topLeftRadius) == null ? void 0 : _b.id,
            rawValue: node.cornerRadius
          });
        }
      } else {
        const corners = [
          { prop: "topLeftRadius", value: node.topLeftRadius },
          { prop: "topRightRadius", value: node.topRightRadius },
          { prop: "bottomLeftRadius", value: node.bottomLeftRadius },
          { prop: "bottomRightRadius", value: node.bottomRightRadius }
        ];
        for (const corner of corners) {
          if (corner.value > 0) {
            results.push({
              property: corner.prop,
              isBound: !!((_c = boundVars[corner.prop]) == null ? void 0 : _c.id),
              boundVariableId: (_d = boundVars[corner.prop]) == null ? void 0 : _d.id,
              rawValue: corner.value
            });
          }
        }
      }
      return results;
    }
    /**
     * Inspect width and height sizing
     */
    inspectSize(node) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
      const results = [];
      if (!("width" in node) || !("height" in node)) {
        return results;
      }
      const boundVars = node.boundVariables || {};
      if (node.width > 0) {
        results.push({
          property: "width",
          isBound: !!((_a = boundVars.width) == null ? void 0 : _a.id),
          boundVariableId: (_b = boundVars.width) == null ? void 0 : _b.id,
          rawValue: node.width
        });
      }
      if (node.height > 0) {
        results.push({
          property: "height",
          isBound: !!((_c = boundVars.height) == null ? void 0 : _c.id),
          boundVariableId: (_d = boundVars.height) == null ? void 0 : _d.id,
          rawValue: node.height
        });
      }
      if ("minWidth" in node && node.minWidth !== null && node.minWidth > 0) {
        results.push({
          property: "minWidth",
          isBound: !!((_e = boundVars.minWidth) == null ? void 0 : _e.id),
          boundVariableId: (_f = boundVars.minWidth) == null ? void 0 : _f.id,
          rawValue: node.minWidth
        });
      }
      if ("minHeight" in node && node.minHeight !== null && node.minHeight > 0) {
        results.push({
          property: "minHeight",
          isBound: !!((_g = boundVars.minHeight) == null ? void 0 : _g.id),
          boundVariableId: (_h = boundVars.minHeight) == null ? void 0 : _h.id,
          rawValue: node.minHeight
        });
      }
      if ("maxWidth" in node && node.maxWidth !== null && node.maxWidth > 0) {
        results.push({
          property: "maxWidth",
          isBound: !!((_i = boundVars.maxWidth) == null ? void 0 : _i.id),
          boundVariableId: (_j = boundVars.maxWidth) == null ? void 0 : _j.id,
          rawValue: node.maxWidth
        });
      }
      if ("maxHeight" in node && node.maxHeight !== null && node.maxHeight > 0) {
        results.push({
          property: "maxHeight",
          isBound: !!((_k = boundVars.maxHeight) == null ? void 0 : _k.id),
          boundVariableId: (_l = boundVars.maxHeight) == null ? void 0 : _l.id,
          rawValue: node.maxHeight
        });
      }
      return results;
    }
    /**
     * Inspect effects (shadows, blurs)
     */
    inspectEffects(node) {
      const results = [];
      if (!("effects" in node) || !Array.isArray(node.effects)) {
        return results;
      }
      for (let i = 0; i < node.effects.length; i++) {
        const effect = node.effects[i];
        if (effect.visible === false) continue;
        if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
          results.push({
            property: `effects[${i}].color`,
            isBound: false,
            // Effects don't support variable bindings currently
            rawValue: effect.color
          });
          results.push({
            property: `effects[${i}].radius`,
            isBound: false,
            rawValue: effect.radius
          });
        }
      }
      return results;
    }
    /**
     * Inspect stroke weight (border width) properties
     */
    inspectStrokeWeight(node) {
      var _a, _b, _c, _d;
      const results = [];
      if (node.type === "COMPONENT_SET") {
        return results;
      }
      if (!("strokes" in node) || !Array.isArray(node.strokes)) {
        return results;
      }
      const hasVisibleStroke = node.strokes.some((s) => s.visible !== false);
      if (!hasVisibleStroke) {
        return results;
      }
      const boundVars = node.boundVariables || {};
      if ("strokeWeight" in node && typeof node.strokeWeight === "number" && node.strokeWeight > 0) {
        results.push({
          property: "strokeWeight",
          isBound: !!((_a = boundVars.strokeWeight) == null ? void 0 : _a.id),
          boundVariableId: (_b = boundVars.strokeWeight) == null ? void 0 : _b.id,
          rawValue: node.strokeWeight
        });
      }
      const perSideProps = ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"];
      for (const prop of perSideProps) {
        if (prop in node) {
          const value = node[prop];
          if (typeof value === "number" && value > 0) {
            results.push({
              property: prop,
              isBound: !!((_c = boundVars[prop]) == null ? void 0 : _c.id),
              boundVariableId: (_d = boundVars[prop]) == null ? void 0 : _d.id,
              rawValue: value
            });
          }
        }
      }
      return results;
    }
    /**
     * Get all inspections for a node based on its type
     */
    inspectNode(node) {
      const inspections = [];
      inspections.push(...this.inspectPaints(node));
      inspections.push(...this.inspectRadius(node));
      inspections.push(...this.inspectStrokeWeight(node));
      if (node.type === "TEXT") {
        inspections.push(...this.inspectTypography(node));
      }
      if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") {
        inspections.push(...this.inspectSpacing(node));
      }
      inspections.push(...this.inspectSize(node));
      inspections.push(...this.inspectEffects(node));
      return inspections;
    }
  };

  // src/plugin/rules/base.ts
  var LintRule = class {
    constructor(config, tokens) {
      this.config = config;
      this.tokens = tokens;
    }
    /**
     * Create a violation object
     */
    createViolation(node, property, currentValue, message, suggestedToken) {
      return {
        id: `${this.id}-${node.id}-${property}`,
        ruleId: this.id,
        severity: this.config.severity,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        layerPath: FigmaScanner.getLayerPath(node),
        property,
        currentValue,
        message,
        suggestedToken
      };
    }
    /**
     * Check if this rule is enabled
     */
    isEnabled() {
      return this.config.enabled;
    }
  };

  // src/plugin/rules/no-hardcoded-colors.ts
  var ICON_NODE_TYPES = ["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"];
  function getContextKeywords(property, nodeType) {
    if (property.includes("stroke")) {
      return ["border"];
    }
    if (property.includes("fill")) {
      if (nodeType === "TEXT") return ["text"];
      if (ICON_NODE_TYPES.includes(nodeType)) return ["icon"];
      return ["background"];
    }
    return [];
  }
  function pickContextualToken(tokenPaths, keywords) {
    if (keywords.length === 0 || tokenPaths.length <= 1) {
      return tokenPaths[0];
    }
    for (const keyword of keywords) {
      const match = tokenPaths.find((p) => {
        const segments = p.toLowerCase().split(/[./]/);
        return segments.includes(keyword);
      });
      if (match) return match;
    }
    return tokenPaths[0];
  }
  var CLOSE_DELTA_E = 10;
  var MAX_DELTA_E = 10;
  var MAX_ALTERNATIVES = 3;
  var NoHardcodedColorsRule = class extends LintRule {
    constructor() {
      super(...arguments);
      this.id = "no-hardcoded-colors";
      this.name = "No Hardcoded Colors";
      this.description = "Flags fills and strokes using literal colors instead of variables";
    }
    check(node, inspections) {
      const violations = [];
      for (const inspection of inspections) {
        if (!inspection.property.includes("fills") && !inspection.property.includes("strokes")) {
          continue;
        }
        if (inspection.isBound) {
          continue;
        }
        if (!inspection.rawValue) {
          continue;
        }
        const color = inspection.rawValue;
        const hexColor = rgbToHex(color);
        if (hexColor.length === 9 && hexColor.endsWith("00")) {
          continue;
        }
        const { matches, alphaStripped } = this.findClosestColorTokens(hexColor);
        if (matches.length > 0 && matches[0].isExact && this.tokens.colorTokensByHex) {
          const contextHex = matches[0].tokenHex.toLowerCase();
          const allPaths = this.tokens.colorTokensByHex.get(contextHex);
          if (allPaths && allPaths.length > 1) {
            const keywords = getContextKeywords(inspection.property, node.type);
            const contextual = pickContextualToken(allPaths, keywords);
            if (contextual && contextual !== matches[0].tokenPath) {
              console.log(`[NoHardcodedColors] Context override: ${matches[0].tokenPath} \u2192 ${contextual} (keywords: ${keywords.join(",")})`);
              matches[0] = __spreadProps(__spreadValues({}, matches[0]), { tokenPath: contextual });
            }
          }
        }
        let suggestedToken;
        let suggestionConfidence;
        let alternativeTokens;
        if (matches.length > 0) {
          const bestMatch = matches[0];
          suggestedToken = bestMatch.tokenPath;
          if (bestMatch.isExact) {
            suggestionConfidence = "exact";
          } else if (bestMatch.deltaE < 2) {
            suggestionConfidence = "close";
          } else if (bestMatch.deltaE < CLOSE_DELTA_E) {
            suggestionConfidence = "approximate";
          } else {
            suggestionConfidence = "approximate";
          }
          if (alphaStripped && suggestionConfidence !== "approximate") {
            suggestionConfidence = "approximate";
          }
          if (matches.length > 1) {
            alternativeTokens = matches.slice(1, MAX_ALTERNATIVES + 1).map((m) => ({
              path: m.tokenPath,
              value: m.tokenHex,
              distance: Math.round(m.deltaE * 10) / 10,
              description: getDeltaEDescription(m.deltaE)
            }));
          }
        }
        let message;
        const alphaNote = alphaStripped ? " (RGB only - alpha differs)" : "";
        if (suggestedToken) {
          if (!alphaStripped && suggestionConfidence === "exact") {
            message = "Hardcoded color " + hexColor + " - exact match available: " + suggestedToken;
          } else if (alphaStripped && matches[0].isExact) {
            message = "Hardcoded color " + hexColor + " - RGB match: " + suggestedToken + alphaNote;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded color " + hexColor + " - closest token: " + suggestedToken + " (" + getDeltaEDescription(bestMatch.deltaE) + ")" + alphaNote;
          }
        } else {
          message = "Hardcoded color " + hexColor + " - should use a design token";
        }
        const violation = this.createViolationWithSuggestions(
          node,
          inspection.property,
          hexColor,
          message,
          suggestedToken,
          suggestionConfidence,
          alternativeTokens
        );
        if (suggestionConfidence === "approximate") {
          violation.canIgnore = true;
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Find closest matching color tokens using Delta E.
     * Returns alphaStripped flag when alpha was removed for RGB-only matching.
     */
    findClosestColorTokens(hex) {
      const alphaStripped = hex.length === 9;
      const hexWithoutAlpha = alphaStripped ? hex.slice(0, 7) : hex;
      const matches = findClosestColors(
        hexWithoutAlpha,
        this.tokens.colorValues,
        this.tokens.colorLab,
        MAX_ALTERNATIVES + 1,
        MAX_DELTA_E
      );
      return { matches, alphaStripped };
    }
    /**
     * Create a violation with suggestion details
     */
    createViolationWithSuggestions(node, property, currentValue, message, suggestedToken, suggestionConfidence, alternativeTokens) {
      const violation = this.createViolation(node, property, currentValue, message, suggestedToken);
      violation.suggestionConfidence = suggestionConfidence;
      violation.alternativeTokens = alternativeTokens;
      return violation;
    }
  };

  // src/shared/number-matching.ts
  var CLOSE_TOLERANCE_PERCENT = 0.25;
  var CLOSE_TOLERANCE_ABSOLUTE = 4;
  var MAX_TOLERANCE_PERCENT = 0.5;
  var MAX_TOLERANCE_ABSOLUTE = 8;
  function findClosestNumbers(targetValue, numberTokens, preferredKeywords = [], maxResults = 5, tolerance = CLOSE_TOLERANCE_PERCENT, absoluteTolerance = CLOSE_TOLERANCE_ABSOLUTE) {
    const matches = [];
    for (const [tokenValue, paths] of numberTokens.entries()) {
      const difference = Math.abs(targetValue - tokenValue);
      const percentDiff = targetValue !== 0 ? difference / targetValue : tokenValue !== 0 ? 1 : 0;
      const isExact = difference === 0;
      const withinExpandedPercent = percentDiff <= MAX_TOLERANCE_PERCENT;
      const withinExpandedAbsolute = difference <= MAX_TOLERANCE_ABSOLUTE;
      if (isExact || withinExpandedPercent || withinExpandedAbsolute) {
        for (const path of paths) {
          matches.push({
            tokenPath: path,
            tokenValue,
            difference,
            percentDifference: percentDiff,
            isExact
          });
        }
      }
    }
    matches.sort((a, b) => {
      if (a.isExact && !b.isExact) return -1;
      if (!a.isExact && b.isExact) return 1;
      if (a.difference !== b.difference) {
        return a.difference - b.difference;
      }
      if (preferredKeywords.length > 0) {
        const aHasKeyword = hasPreferredKeyword(a.tokenPath, preferredKeywords);
        const bHasKeyword = hasPreferredKeyword(b.tokenPath, preferredKeywords);
        if (aHasKeyword && !bHasKeyword) return -1;
        if (!aHasKeyword && bHasKeyword) return 1;
      }
      const aIsSemantic = isSemanticTokenPath(a.tokenPath);
      const bIsSemantic = isSemanticTokenPath(b.tokenPath);
      if (aIsSemantic && !bIsSemantic) return -1;
      if (!aIsSemantic && bIsSemantic) return 1;
      return 0;
    });
    return matches.slice(0, maxResults);
  }
  function hasPreferredKeyword(path, keywords) {
    const lowerPath = path.toLowerCase();
    return keywords.some((kw) => lowerPath.includes(kw.toLowerCase()));
  }
  function isSemanticTokenPath(path) {
    return path.startsWith("system.") || path.startsWith("component.");
  }
  function getNumberMatchDescription(match) {
    if (match.isExact) {
      return "exact match";
    }
    if (match.difference <= 1) {
      return "off by " + match.difference + "px";
    }
    if (match.percentDifference <= 0.05) {
      return "within 5%";
    }
    if (match.percentDifference <= 0.1) {
      return "within 10%";
    }
    return "off by " + Math.round(match.difference) + "px (" + Math.round(match.percentDifference * 100) + "%)";
  }
  var SPACING_KEYWORDS = ["spacing", "space", "gap", "padding", "margin", "inset"];
  var RADIUS_KEYWORDS = ["radius", "corner", "round", "border-radius"];
  var TYPOGRAPHY_KEYWORDS = ["font", "text", "line", "letter", "size", "typography"];
  var STROKE_WIDTH_KEYWORDS = ["stroke", "border-width", "border.width", "stroke-weight", "stroke-width"];
  var SIZING_KEYWORDS = ["size", "dimension", "width", "height", "min", "max"];

  // src/plugin/rules/no-hardcoded-typography.ts
  var TYPOGRAPHY_PROPERTIES = ["fontSize", "lineHeight", "letterSpacing", "paragraphSpacing"];
  var BINDABLE_TYPOGRAPHY_PROPERTIES = ["paragraphSpacing"];
  var MAX_ALTERNATIVES2 = 3;
  var cachedTextStyles = null;
  function clearTextStyleCache() {
    cachedTextStyles = null;
  }
  var NoHardcodedTypographyRule = class extends LintRule {
    constructor() {
      super(...arguments);
      this.id = "no-hardcoded-typography";
      this.name = "No Hardcoded Typography";
      this.description = "Flags text nodes with unbound font properties";
    }
    async check(node, inspections) {
      if (node.type !== "TEXT") {
        return [];
      }
      const textNode = node;
      const violations = [];
      if (cachedTextStyles === null) {
        cachedTextStyles = await this.loadTextStyles();
      }
      for (const inspection of inspections) {
        if (!TYPOGRAPHY_PROPERTIES.includes(inspection.property)) {
          continue;
        }
        if (inspection.isBound) {
          continue;
        }
        if (!inspection.rawValue || inspection.rawValue === 0) {
          continue;
        }
        const value = inspection.rawValue;
        const propertyKeywords = this.getPropertyKeywords(inspection.property);
        const matches = findClosestNumbers(
          value,
          this.tokens.numberValues,
          [...TYPOGRAPHY_KEYWORDS, ...propertyKeywords],
          MAX_ALTERNATIVES2 + 1
        );
        let suggestedToken;
        let suggestionConfidence;
        let alternativeTokens;
        if (matches.length > 0) {
          const bestMatch = matches[0];
          suggestedToken = bestMatch.tokenPath;
          if (bestMatch.isExact) {
            suggestionConfidence = "exact";
          } else if (bestMatch.difference <= 1 || bestMatch.percentDifference <= 0.05) {
            suggestionConfidence = "close";
          } else {
            suggestionConfidence = "approximate";
          }
          if (matches.length > 1) {
            alternativeTokens = matches.slice(1, MAX_ALTERNATIVES2 + 1).map((m) => ({
              path: m.tokenPath,
              value: m.tokenValue,
              distance: m.difference,
              description: getNumberMatchDescription(m)
            }));
          }
        }
        const canAutoFix = BINDABLE_TYPOGRAPHY_PROPERTIES.includes(inspection.property);
        let suggestedTextStyle;
        let canApplyTextStyle = false;
        if (!canAutoFix) {
          const nodeTypography = this.getTextNodeTypography(textNode);
          suggestedTextStyle = this.findMatchingTextStyle(
            inspection.property,
            value,
            nodeTypography
          );
          canApplyTextStyle = suggestedTextStyle !== void 0;
        }
        const propName = this.formatPropertyName(inspection.property);
        let message;
        if (!canAutoFix) {
          if (suggestedTextStyle) {
            message = "Hardcoded " + propName + " value " + value + ' - matching style available: "' + suggestedTextStyle.name + '"';
          } else if (suggestedToken) {
            const bestMatch = matches[0];
            message = "Hardcoded " + propName + " value " + value + " - closest token: " + suggestedToken + " (" + getNumberMatchDescription(bestMatch) + "). No matching text style found.";
          } else {
            message = "Hardcoded " + propName + " value " + value + " - use a text style instead";
          }
        } else if (suggestedToken) {
          if (suggestionConfidence === "exact") {
            message = "Hardcoded " + propName + " value " + value + " - exact match available: " + suggestedToken;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded " + propName + " value " + value + " - closest token: " + suggestedToken + " (" + getNumberMatchDescription(bestMatch) + ")";
          }
        } else {
          message = "Hardcoded " + propName + " value " + value + " - should use a design token";
        }
        const violation = this.createViolation(
          node,
          inspection.property,
          value,
          message,
          canAutoFix ? suggestedToken : void 0
        );
        if (canAutoFix) {
          violation.suggestionConfidence = suggestionConfidence;
          violation.alternativeTokens = alternativeTokens;
        }
        if (suggestedTextStyle) {
          violation.suggestedTextStyle = suggestedTextStyle;
          violation.canApplyTextStyle = canApplyTextStyle;
        }
        if (!canAutoFix && !canApplyTextStyle) {
          violation.canIgnore = true;
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Load all text styles from the document
     */
    async loadTextStyles() {
      try {
        const styles = await figma.getLocalTextStylesAsync();
        return styles.map((style) => {
          let lineHeightValue = null;
          if (style.lineHeight && typeof style.lineHeight === "object") {
            const lh = style.lineHeight;
            if (lh.unit === "PIXELS") {
              lineHeightValue = lh.value;
            } else if (lh.unit === "PERCENT") {
              lineHeightValue = lh.value / 100 * style.fontSize;
            }
          }
          return {
            id: style.id,
            name: style.name,
            fontSize: style.fontSize,
            lineHeight: lineHeightValue,
            letterSpacing: style.letterSpacing ? style.letterSpacing.value : 0
          };
        });
      } catch (error) {
        console.error("[Typography] Error loading text styles:", error);
        return [];
      }
    }
    /**
     * Get typography values from a text node
     */
    getTextNodeTypography(textNode) {
      const fontSize = typeof textNode.fontSize === "number" ? textNode.fontSize : 0;
      let lineHeight = null;
      if (textNode.lineHeight && typeof textNode.lineHeight === "object") {
        const lh = textNode.lineHeight;
        if (lh.unit === "PIXELS") {
          lineHeight = lh.value;
        } else if (lh.unit === "PERCENT") {
          lineHeight = lh.value / 100 * fontSize;
        }
      }
      let letterSpacing = 0;
      if (textNode.letterSpacing && typeof textNode.letterSpacing === "object") {
        letterSpacing = textNode.letterSpacing.value;
      }
      return { fontSize, lineHeight, letterSpacing };
    }
    /**
     * Find a text style that matches the given property value
     */
    findMatchingTextStyle(property, value, nodeTypography) {
      var _a;
      if (!cachedTextStyles || cachedTextStyles.length === 0) {
        return void 0;
      }
      const matchingStyles = [];
      for (const style of cachedTextStyles) {
        let propertyMatches = false;
        let isExactMatch = true;
        const MATCH_TOLERANCE = 2;
        switch (property) {
          case "fontSize":
            propertyMatches = Math.abs(style.fontSize - value) <= MATCH_TOLERANCE;
            if (propertyMatches) {
              isExactMatch = Math.abs(style.fontSize - value) < 0.5;
              if (nodeTypography.lineHeight !== null && style.lineHeight !== null) {
                isExactMatch = isExactMatch && Math.abs(style.lineHeight - nodeTypography.lineHeight) < 1;
              }
              if (Math.abs(style.letterSpacing - nodeTypography.letterSpacing) > 0.1) {
                isExactMatch = false;
              }
            }
            break;
          case "lineHeight":
            if (style.lineHeight !== null) {
              propertyMatches = Math.abs(style.lineHeight - value) <= MATCH_TOLERANCE;
              if (propertyMatches) {
                isExactMatch = Math.abs(style.lineHeight - value) < 0.5;
                if (Math.abs(style.fontSize - nodeTypography.fontSize) > 0.5) {
                  isExactMatch = false;
                }
              }
            }
            break;
          case "letterSpacing":
            propertyMatches = Math.abs(style.letterSpacing - value) <= 0.5;
            if (propertyMatches) {
              isExactMatch = Math.abs(style.letterSpacing - value) < 0.1;
              if (Math.abs(style.fontSize - nodeTypography.fontSize) > 0.5) {
                isExactMatch = false;
              }
            }
            break;
        }
        if (propertyMatches) {
          matchingStyles.push({
            style,
            matchQuality: isExactMatch ? "exact" : "partial"
          });
        }
      }
      matchingStyles.sort((a, b) => {
        if (a.matchQuality === "exact" && b.matchQuality !== "exact") return -1;
        if (a.matchQuality !== "exact" && b.matchQuality === "exact") return 1;
        return a.style.name.localeCompare(b.style.name);
      });
      if (matchingStyles.length > 0) {
        const best = matchingStyles[0];
        return {
          id: best.style.id,
          name: best.style.name,
          fontSize: best.style.fontSize,
          lineHeight: (_a = best.style.lineHeight) != null ? _a : void 0,
          letterSpacing: best.style.letterSpacing,
          matchQuality: best.matchQuality
        };
      }
      return void 0;
    }
    /**
     * Get property-specific keywords for matching
     */
    getPropertyKeywords(property) {
      switch (property) {
        case "fontSize":
          return ["size", "font-size"];
        case "lineHeight":
          return ["line", "height", "leading"];
        case "letterSpacing":
          return ["letter", "tracking"];
        case "paragraphSpacing":
          return ["paragraph"];
        default:
          return [];
      }
    }
    /**
     * Format property name for display
     */
    formatPropertyName(property) {
      switch (property) {
        case "fontSize":
          return "font size";
        case "lineHeight":
          return "line height";
        case "letterSpacing":
          return "letter spacing";
        case "paragraphSpacing":
          return "paragraph spacing";
        default:
          return property;
      }
    }
  };

  // src/plugin/rules/no-hardcoded-spacing.ts
  var SPACING_PROPERTIES = [
    "itemSpacing",
    "counterAxisSpacing",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft"
  ];
  var MAX_ALTERNATIVES3 = 3;
  var NoHardcodedSpacingRule = class extends LintRule {
    constructor() {
      super(...arguments);
      this.id = "no-hardcoded-spacing";
      this.name = "No Hardcoded Spacing";
      this.description = "Flags auto-layout frames with hardcoded gap and padding values";
    }
    check(node, inspections) {
      if (node.type !== "FRAME" && node.type !== "COMPONENT" && node.type !== "INSTANCE") {
        return [];
      }
      const frameNode = node;
      if (frameNode.layoutMode === "NONE") {
        return [];
      }
      const violations = [];
      for (const inspection of inspections) {
        if (!SPACING_PROPERTIES.includes(inspection.property)) {
          continue;
        }
        if (inspection.isBound) {
          continue;
        }
        if (!inspection.rawValue || inspection.rawValue === 0) {
          continue;
        }
        const value = inspection.rawValue;
        const matches = findClosestNumbers(
          value,
          this.tokens.numberValues,
          SPACING_KEYWORDS,
          MAX_ALTERNATIVES3 + 1
        );
        let suggestedToken;
        let suggestionConfidence;
        let alternativeTokens;
        if (matches.length > 0) {
          const bestMatch = matches[0];
          suggestedToken = bestMatch.tokenPath;
          if (bestMatch.isExact) {
            suggestionConfidence = "exact";
          } else if (bestMatch.difference <= 1 || bestMatch.percentDifference <= 0.05) {
            suggestionConfidence = "close";
          } else {
            suggestionConfidence = "approximate";
          }
          if (matches.length > 1) {
            alternativeTokens = matches.slice(1, MAX_ALTERNATIVES3 + 1).map((m) => ({
              path: m.tokenPath,
              value: m.tokenValue,
              distance: m.difference,
              description: getNumberMatchDescription(m)
            }));
          }
        }
        const propName = this.formatPropertyName(inspection.property);
        let message;
        if (suggestedToken) {
          if (suggestionConfidence === "exact") {
            message = "Hardcoded " + propName + " value " + value + "px - exact match available: " + suggestedToken;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded " + propName + " value " + value + "px - closest token: " + suggestedToken + " (" + getNumberMatchDescription(bestMatch) + ")";
          }
        } else {
          message = "Hardcoded " + propName + " value " + value + "px - should use a design token";
        }
        const violation = this.createViolation(
          node,
          inspection.property,
          value,
          message,
          suggestedToken
        );
        violation.suggestionConfidence = suggestionConfidence;
        violation.alternativeTokens = alternativeTokens;
        if (suggestionConfidence === "approximate") {
          violation.canIgnore = true;
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Format property name for display
     */
    formatPropertyName(property) {
      switch (property) {
        case "itemSpacing":
          return "gap";
        case "counterAxisSpacing":
          return "counter axis gap";
        case "paddingTop":
          return "padding top";
        case "paddingRight":
          return "padding right";
        case "paddingBottom":
          return "padding bottom";
        case "paddingLeft":
          return "padding left";
        default:
          return property;
      }
    }
  };

  // src/plugin/rules/no-hardcoded-radii.ts
  var RADIUS_PROPERTIES = [
    "cornerRadius",
    "topLeftRadius",
    "topRightRadius",
    "bottomLeftRadius",
    "bottomRightRadius"
  ];
  var MAX_ALTERNATIVES4 = 3;
  var NoHardcodedRadiiRule = class extends LintRule {
    constructor() {
      super(...arguments);
      this.id = "no-hardcoded-radii";
      this.name = "No Hardcoded Radii";
      this.description = "Flags nodes with hardcoded corner radius values";
    }
    check(node, inspections) {
      if (!("cornerRadius" in node)) {
        return [];
      }
      const violations = [];
      for (const inspection of inspections) {
        if (!RADIUS_PROPERTIES.includes(inspection.property)) {
          continue;
        }
        if (inspection.isBound) {
          continue;
        }
        if (!inspection.rawValue || inspection.rawValue === 0) {
          continue;
        }
        const value = inspection.rawValue;
        const matches = findClosestNumbers(
          value,
          this.tokens.numberValues,
          RADIUS_KEYWORDS,
          MAX_ALTERNATIVES4 + 1
        );
        let suggestedToken;
        let suggestionConfidence;
        let alternativeTokens;
        if (matches.length > 0) {
          const bestMatch = matches[0];
          suggestedToken = bestMatch.tokenPath;
          if (bestMatch.isExact) {
            suggestionConfidence = "exact";
          } else if (bestMatch.difference <= 1 || bestMatch.percentDifference <= 0.05) {
            suggestionConfidence = "close";
          } else {
            suggestionConfidence = "approximate";
          }
          if (matches.length > 1) {
            alternativeTokens = matches.slice(1, MAX_ALTERNATIVES4 + 1).map((m) => ({
              path: m.tokenPath,
              value: m.tokenValue,
              distance: m.difference,
              description: getNumberMatchDescription(m)
            }));
          }
        }
        const propName = this.formatPropertyName(inspection.property);
        let message;
        if (suggestedToken) {
          if (suggestionConfidence === "exact") {
            message = "Hardcoded " + propName + " value " + value + "px - exact match available: " + suggestedToken;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded " + propName + " value " + value + "px - closest token: " + suggestedToken + " (" + getNumberMatchDescription(bestMatch) + ")";
          }
        } else {
          message = "Hardcoded " + propName + " value " + value + "px - should use a design token";
        }
        const violation = this.createViolation(
          node,
          inspection.property,
          value,
          message,
          suggestedToken
        );
        violation.suggestionConfidence = suggestionConfidence;
        violation.alternativeTokens = alternativeTokens;
        if (suggestionConfidence === "approximate") {
          violation.canIgnore = true;
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Format property name for display
     */
    formatPropertyName(property) {
      switch (property) {
        case "cornerRadius":
          return "corner radius";
        case "topLeftRadius":
          return "top-left radius";
        case "topRightRadius":
          return "top-right radius";
        case "bottomLeftRadius":
          return "bottom-left radius";
        case "bottomRightRadius":
          return "bottom-right radius";
        default:
          return property;
      }
    }
  };

  // src/plugin/rules/no-hardcoded-stroke-weight.ts
  var STROKE_WEIGHT_PROPERTIES = [
    "strokeWeight",
    "strokeTopWeight",
    "strokeRightWeight",
    "strokeBottomWeight",
    "strokeLeftWeight"
  ];
  var MAX_ALTERNATIVES5 = 3;
  var NoHardcodedStrokeWeightRule = class extends LintRule {
    constructor() {
      super(...arguments);
      this.id = "no-hardcoded-stroke-weight";
      this.name = "No Hardcoded Stroke Weight";
      this.description = "Flags nodes with hardcoded border width values";
    }
    check(node, inspections) {
      if (node.type === "COMPONENT_SET") {
        return [];
      }
      if (!("strokes" in node) || !Array.isArray(node.strokes)) {
        return [];
      }
      const hasVisibleStroke = node.strokes.some((s) => s.visible !== false);
      if (!hasVisibleStroke) {
        return [];
      }
      const violations = [];
      for (const inspection of inspections) {
        if (!STROKE_WEIGHT_PROPERTIES.includes(inspection.property)) {
          continue;
        }
        if (inspection.isBound) {
          continue;
        }
        if (!inspection.rawValue || inspection.rawValue === 0) {
          continue;
        }
        const value = inspection.rawValue;
        const matches = findClosestNumbers(
          value,
          this.tokens.numberValues,
          STROKE_WIDTH_KEYWORDS,
          MAX_ALTERNATIVES5 + 1
        );
        let suggestedToken;
        let suggestionConfidence;
        let alternativeTokens;
        if (matches.length > 0) {
          const bestMatch = matches[0];
          suggestedToken = bestMatch.tokenPath;
          if (bestMatch.isExact) {
            suggestionConfidence = "exact";
          } else if (bestMatch.difference <= 1 || bestMatch.percentDifference <= 0.05) {
            suggestionConfidence = "close";
          } else {
            suggestionConfidence = "approximate";
          }
          if (matches.length > 1) {
            alternativeTokens = matches.slice(1, MAX_ALTERNATIVES5 + 1).map((m) => ({
              path: m.tokenPath,
              value: m.tokenValue,
              distance: m.difference,
              description: getNumberMatchDescription(m)
            }));
          }
        }
        const propName = this.formatPropertyName(inspection.property);
        let message;
        if (suggestedToken) {
          if (suggestionConfidence === "exact") {
            message = "Hardcoded " + propName + " value " + value + "px - exact match available: " + suggestedToken;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded " + propName + " value " + value + "px - closest token: " + suggestedToken + " (" + getNumberMatchDescription(bestMatch) + ")";
          }
        } else {
          message = "Hardcoded " + propName + " value " + value + "px - should use a design token";
        }
        const violation = this.createViolation(
          node,
          inspection.property,
          value,
          message,
          suggestedToken
        );
        violation.suggestionConfidence = suggestionConfidence;
        violation.alternativeTokens = alternativeTokens;
        if (suggestionConfidence === "approximate") {
          violation.canIgnore = true;
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Format property name for display
     */
    formatPropertyName(property) {
      switch (property) {
        case "strokeWeight":
          return "stroke weight";
        case "strokeTopWeight":
          return "top stroke weight";
        case "strokeRightWeight":
          return "right stroke weight";
        case "strokeBottomWeight":
          return "bottom stroke weight";
        case "strokeLeftWeight":
          return "left stroke weight";
        default:
          return property;
      }
    }
  };

  // src/plugin/rules/no-hardcoded-sizing.ts
  var SIZING_PROPERTIES = [
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight"
  ];
  var MAX_ALTERNATIVES6 = 3;
  var NoHardcodedSizingRule = class extends LintRule {
    constructor() {
      super(...arguments);
      this.id = "no-hardcoded-sizing";
      this.name = "No Hardcoded Sizing";
      this.description = "Flags nodes with hardcoded width/height values";
    }
    check(node, inspections) {
      if (!("width" in node) || !("height" in node)) {
        return [];
      }
      const violations = [];
      for (const inspection of inspections) {
        if (!SIZING_PROPERTIES.includes(inspection.property)) {
          continue;
        }
        if (inspection.isBound) {
          continue;
        }
        if (!inspection.rawValue || inspection.rawValue === 0) {
          continue;
        }
        if (inspection.property === "width" && "layoutSizingHorizontal" in node) {
          const sizing = node.layoutSizingHorizontal;
          if (sizing === "HUG" || sizing === "FILL") {
            continue;
          }
        }
        if (inspection.property === "height" && "layoutSizingVertical" in node) {
          const sizing = node.layoutSizingVertical;
          if (sizing === "HUG" || sizing === "FILL") {
            continue;
          }
        }
        const value = inspection.rawValue;
        const matches = findClosestNumbers(
          value,
          this.tokens.numberValues,
          SIZING_KEYWORDS,
          MAX_ALTERNATIVES6 + 1
        );
        let suggestedToken;
        let suggestionConfidence;
        let alternativeTokens;
        if (matches.length > 0) {
          const bestMatch = matches[0];
          suggestedToken = bestMatch.tokenPath;
          if (bestMatch.isExact) {
            suggestionConfidence = "exact";
          } else if (bestMatch.difference <= 1 || bestMatch.percentDifference <= 0.05) {
            suggestionConfidence = "close";
          } else {
            suggestionConfidence = "approximate";
          }
          if (matches.length > 1) {
            alternativeTokens = matches.slice(1, MAX_ALTERNATIVES6 + 1).map((m) => ({
              path: m.tokenPath,
              value: m.tokenValue,
              distance: m.difference,
              description: getNumberMatchDescription(m)
            }));
          }
        }
        const propName = this.formatPropertyName(inspection.property);
        let message;
        if (suggestedToken) {
          if (suggestionConfidence === "exact") {
            message = "Hardcoded " + propName + " value " + value + "px - exact match available: " + suggestedToken;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded " + propName + " value " + value + "px - closest token: " + suggestedToken + " (" + getNumberMatchDescription(bestMatch) + ")";
          }
        } else {
          message = "Hardcoded " + propName + " value " + value + "px - should use a design token";
        }
        const violation = this.createViolation(
          node,
          inspection.property,
          value,
          message,
          suggestedToken
        );
        violation.suggestionConfidence = suggestionConfidence;
        violation.alternativeTokens = alternativeTokens;
        if (suggestionConfidence === "approximate") {
          violation.canIgnore = true;
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Format property name for display
     */
    formatPropertyName(property) {
      switch (property) {
        case "width":
          return "width";
        case "height":
          return "height";
        case "minWidth":
          return "min width";
        case "minHeight":
          return "min height";
        case "maxWidth":
          return "max width";
        case "maxHeight":
          return "max height";
        default:
          return property;
      }
    }
  };

  // src/shared/path-utils.ts
  function normalizePath(path) {
    return path.toLowerCase().replace(/\./g, "/").replace(/\s*\/\s*/g, "/").replace(/\s+/g, "-").replace(/^\/+|\/+$/g, "");
  }
  function pathEndsWith(fullPath, suffix) {
    const normalizedFull = normalizePath(fullPath);
    const normalizedSuffix = normalizePath(suffix);
    if (normalizedFull === normalizedSuffix) {
      return true;
    }
    return normalizedFull.endsWith("/" + normalizedSuffix);
  }
  function buildNormalizedPathMap(paths) {
    const map = /* @__PURE__ */ new Map();
    for (const path of paths) {
      map.set(normalizePath(path), path);
    }
    return map;
  }
  function findMatchingTokenPath(variableName, tokenPaths, collectionName) {
    const normalizedName = normalizePath(variableName);
    const normalizedTokens = buildNormalizedPathMap(tokenPaths);
    if (normalizedTokens.has(normalizedName)) {
      return normalizedTokens.get(normalizedName);
    }
    if (collectionName) {
      const withCollection = normalizePath(`${collectionName}/${variableName}`);
      if (normalizedTokens.has(withCollection)) {
        return normalizedTokens.get(withCollection);
      }
    }
    for (const [normalized, original] of normalizedTokens) {
      if (pathEndsWith(normalized, normalizedName)) {
        return original;
      }
    }
    for (const [normalized, original] of normalizedTokens) {
      if (pathEndsWith(normalizedName, normalized)) {
        return original;
      }
    }
    return void 0;
  }

  // src/plugin/variables.ts
  async function getLocalVariables() {
    const variables = await figma.variables.getLocalVariablesAsync();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionMap = /* @__PURE__ */ new Map();
    for (const collection of collections) {
      collectionMap.set(collection.id, collection);
    }
    const result = /* @__PURE__ */ new Map();
    for (const variable of variables) {
      const collection = collectionMap.get(variable.variableCollectionId);
      result.set(variable.id, {
        id: variable.id,
        name: variable.name,
        collectionId: variable.variableCollectionId,
        collectionName: (collection == null ? void 0 : collection.name) || "Unknown",
        resolvedType: variable.resolvedType
      });
    }
    return result;
  }
  function buildMatchedVariableIdSet(variables, tokens) {
    const tokenPaths = Array.from(tokens.tokens.keys());
    const matchedIds = /* @__PURE__ */ new Set();
    for (const variable of variables.values()) {
      const matchedPath = findMatchingTokenPath(
        variable.name,
        tokenPaths,
        variable.collectionName
      );
      if (matchedPath) {
        matchedIds.add(variable.id);
      }
    }
    return matchedIds;
  }
  function getTokenPathForVariable(variable, tokens) {
    const tokenPaths = Array.from(tokens.tokens.keys());
    return findMatchingTokenPath(
      variable.name,
      tokenPaths,
      variable.collectionName
    );
  }

  // src/plugin/rules/no-orphaned-variables.ts
  var ICON_NODE_TYPES2 = ["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"];
  function getContextKeywords2(property, nodeType) {
    if (property.includes("stroke")) return ["border"];
    if (property.includes("fill")) {
      if (nodeType === "TEXT") return ["text"];
      if (ICON_NODE_TYPES2.includes(nodeType)) return ["icon"];
      return ["background"];
    }
    return [];
  }
  function pickContextualToken2(tokenPaths, keywords) {
    if (keywords.length === 0 || tokenPaths.length <= 1) {
      return tokenPaths[0];
    }
    for (const keyword of keywords) {
      const match = tokenPaths.find((p) => {
        const segments = p.toLowerCase().split(/[./]/);
        return segments.includes(keyword);
      });
      if (match) return match;
    }
    return tokenPaths[0];
  }
  var MAX_COLOR_DELTA_E = 10;
  var MAX_ALTERNATIVES7 = 3;
  var NUMBER_TOLERANCE_PERCENT = 0.5;
  var NoOrphanedVariablesRule = class extends LintRule {
    constructor(config, tokens, figmaVariables, matchedVariableIds) {
      super(config, tokens);
      this.id = "no-orphaned-variables";
      this.name = "No Orphaned Variables";
      this.description = "Flags nodes bound to variables that do not exist in the token set";
      this.figmaVariables = figmaVariables;
      this.matchedVariableIds = matchedVariableIds;
    }
    /**
     * Check is now async to support fetching variable values
     */
    async check(node, inspections) {
      const violations = [];
      for (const inspection of inspections) {
        if (!inspection.isBound || !inspection.boundVariableId) {
          continue;
        }
        const variableInfo = this.figmaVariables.get(inspection.boundVariableId);
        if (!variableInfo) {
          const suggestion = await this.findReplacementForMissingVariable(
            node,
            inspection.property,
            inspection.boundVariableId,
            inspection.rawValue
          );
          let message = `Bound to missing variable ID: ${inspection.boundVariableId}`;
          if (suggestion.suggestedToken) {
            message += `. Suggested replacement: ${suggestion.suggestedToken}`;
          }
          const violation = this.createViolation(
            node,
            inspection.property,
            inspection.boundVariableId,
            message,
            suggestion.suggestedToken
          );
          violation.canUnbind = true;
          violation.suggestionConfidence = suggestion.confidence;
          violation.alternativeTokens = suggestion.alternatives;
          if (suggestion.confidence === "approximate") {
            violation.canIgnore = true;
          }
          violations.push(violation);
        } else if (this.matchedVariableIds.size > 0 && !this.matchedVariableIds.has(inspection.boundVariableId)) {
          const matchedTokenPath = getTokenPathForVariable(variableInfo, this.tokens);
          if (matchedTokenPath) {
            continue;
          }
          const normalizedVarName = normalizePath(variableInfo.name);
          const normalizedCollName = normalizePath(variableInfo.collectionName);
          if (normalizedVarName.startsWith("system/") || normalizedVarName.startsWith("component/") || normalizedCollName === "system" || normalizedCollName.includes("semantic") || normalizedCollName.includes("component")) {
            continue;
          }
          const pathMismatchToken = this.findPathMismatchToken(variableInfo.name);
          if (pathMismatchToken) {
            const message2 = `Variable "${variableInfo.name}" has path syntax mismatch with token "${pathMismatchToken}". The paths match after normalization but use different separators (/ vs .).`;
            const violation2 = this.createViolation(
              node,
              inspection.property,
              variableInfo.name,
              message2,
              pathMismatchToken
            );
            violation2.canUnbind = true;
            violation2.suggestionConfidence = "exact";
            violation2.isPathMismatch = true;
            violation2.normalizedMatchPath = pathMismatchToken;
            violations.push(violation2);
            continue;
          }
          const suggestion = await this.findReplacementToken(
            inspection.boundVariableId,
            variableInfo,
            inspection.property,
            node.type
          );
          let message = `Variable "${variableInfo.name}" is not defined in the token set`;
          if (suggestion.suggestedToken && suggestion.confidence !== "exact") {
            message += `. Closest token: ${suggestion.suggestedToken}`;
          } else if (suggestion.suggestedToken) {
            message += `. Exact match: ${suggestion.suggestedToken}`;
          }
          const violation = this.createViolation(
            node,
            inspection.property,
            variableInfo.name,
            message,
            suggestion.suggestedToken
          );
          violation.canUnbind = true;
          violation.suggestionConfidence = suggestion.confidence;
          violation.alternativeTokens = suggestion.alternatives;
          if (suggestion.confidence === "approximate") {
            violation.canIgnore = true;
          }
          violations.push(violation);
        }
      }
      return violations;
    }
    /**
     * Check if a variable name matches a token path after normalization
     * This detects path syntax mismatches (/ vs . notation)
     */
    findPathMismatchToken(variableName) {
      const normalizedVarName = normalizePath(variableName);
      for (const tokenPath of this.tokens.tokens.keys()) {
        const normalizedTokenPath = normalizePath(tokenPath);
        if (normalizedVarName === normalizedTokenPath && variableName !== tokenPath) {
          return tokenPath;
        }
      }
      return void 0;
    }
    /**
     * Find a replacement token for a missing variable.
     *
     * Two-step approach:
     * 1. Try resolving the variable via Figma API (handles library variables
     *    that aren't in the local collection)
     * 2. Fall back to reading the node's actual visual value (including paint
     *    opacity, which rawValue from the inspector lacks)
     */
    async findReplacementForMissingVariable(node, property, boundVariableId, rawValue) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(boundVariableId);
        if (variable) {
          const collection = await figma.variables.getVariableCollectionByIdAsync(
            variable.variableCollectionId
          );
          if (collection && collection.modes.length > 0) {
            const defaultModeId = collection.defaultModeId;
            let value = variable.valuesByMode[defaultModeId];
            if (variable.resolvedType === "COLOR") {
              if (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
                const resolved = await this.resolveVariableAlias(value);
                if (resolved) value = resolved;
              }
              if (value && typeof value === "object" && value !== null && "r" in value) {
                console.log("[OrphanedVariables] Resolved missing variable via API: " + variable.name);
                return this.findColorReplacement(value, property, node.type);
              }
            } else if (variable.resolvedType === "FLOAT") {
              if (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
                const resolved = await this.resolveVariableAlias(value);
                if (typeof resolved === "number") value = resolved;
              }
              if (typeof value === "number") {
                console.log("[OrphanedVariables] Resolved missing variable via API: " + variable.name);
                return this.findNumberReplacement(value, property);
              }
            }
          }
        }
      } catch (e) {
      }
      try {
        if (property.includes("fills") || property.includes("strokes")) {
          const colorValue = this.readColorFromNode(node, property);
          if (colorValue) {
            console.log("[OrphanedVariables] Read color from node for: " + property);
            return this.findColorReplacement(colorValue, property, node.type);
          }
          if (rawValue && typeof rawValue === "object" && "r" in rawValue) {
            return this.findColorReplacement(
              rawValue,
              property,
              node.type
            );
          }
        }
        if (typeof rawValue === "number") {
          return this.findNumberReplacement(rawValue, property);
        }
        const numberProps = [
          "itemSpacing",
          "counterAxisSpacing",
          "paddingTop",
          "paddingRight",
          "paddingBottom",
          "paddingLeft",
          "cornerRadius",
          "topLeftRadius",
          "topRightRadius",
          "bottomLeftRadius",
          "bottomRightRadius",
          "paragraphSpacing"
        ];
        if (numberProps.includes(property)) {
          const nodeValue = node[property];
          if (typeof nodeValue === "number") {
            return this.findNumberReplacement(nodeValue, property);
          }
        }
        return {};
      } catch (error) {
        console.error("[OrphanedVariables] Error finding replacement for missing variable:", error);
        return {};
      }
    }
    /**
     * Read the current color value directly from a node's paint,
     * including paint opacity (which rawValue from the inspector lacks).
     */
    readColorFromNode(node, property) {
      var _a, _b;
      const fillMatch = property.match(/^fills\[(\d+)\]$/);
      if (fillMatch && "fills" in node) {
        const idx = parseInt(fillMatch[1], 10);
        const fills = node.fills;
        if (Array.isArray(fills) && fills[idx] && fills[idx].type === "SOLID") {
          const paint = fills[idx];
          return __spreadProps(__spreadValues({}, paint.color), { a: (_a = paint.opacity) != null ? _a : 1 });
        }
      }
      const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
      if (strokeMatch && "strokes" in node) {
        const idx = parseInt(strokeMatch[1], 10);
        const strokes = node.strokes;
        if (Array.isArray(strokes) && strokes[idx] && strokes[idx].type === "SOLID") {
          const paint = strokes[idx];
          return __spreadProps(__spreadValues({}, paint.color), { a: (_b = paint.opacity) != null ? _b : 1 });
        }
      }
      return null;
    }
    /**
     * Find a replacement token based on the variable's resolved value
     */
    async findReplacementToken(variableId, variableInfo, property, nodeType) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(variableId);
        if (!variable) {
          return {};
        }
        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
        if (!collection || collection.modes.length === 0) {
          return {};
        }
        const defaultModeId = collection.defaultModeId;
        let value = variable.valuesByMode[defaultModeId];
        if (value === void 0) {
          return {};
        }
        if (variableInfo.resolvedType === "COLOR") {
          if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
            const resolved = await this.resolveVariableAlias(value);
            if (!resolved) return {};
            value = resolved;
          }
          return this.findColorReplacement(value, property, nodeType);
        } else if (variableInfo.resolvedType === "FLOAT") {
          if (typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS") {
            const resolved = await this.resolveVariableAlias(value);
            if (typeof resolved !== "number") return {};
            value = resolved;
          }
          return this.findNumberReplacement(value, property);
        }
        return {};
      } catch (error) {
        console.error("[OrphanedVariables] Error finding replacement:", error);
        return {};
      }
    }
    /**
     * Resolve a VariableAlias chain to its final value
     */
    async resolveVariableAlias(alias, visited) {
      const seen = visited || /* @__PURE__ */ new Set();
      if (seen.has(alias.id)) return null;
      seen.add(alias.id);
      try {
        const variable = await figma.variables.getVariableByIdAsync(alias.id);
        if (!variable) return null;
        const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
        if (!collection) return null;
        const value = variable.valuesByMode[collection.defaultModeId];
        if (value === void 0 || value === null) return null;
        if (typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
          return this.resolveVariableAlias(value, seen);
        }
        return value;
      } catch (e) {
        return null;
      }
    }
    /**
     * Find a replacement color token
     */
    findColorReplacement(value, property, nodeType) {
      if (typeof value !== "object" || value === null) {
        return {};
      }
      const colorValue = value;
      if (typeof colorValue.r !== "number") {
        return {};
      }
      const hexColor = rgbToHex(colorValue);
      const hasAlpha = hexColor.length === 9;
      const hexWithoutAlpha = hasAlpha ? hexColor.slice(0, 7) : hexColor;
      const matches = findClosestColors(
        hexWithoutAlpha,
        this.tokens.colorValues,
        this.tokens.colorLab,
        MAX_ALTERNATIVES7 + 1,
        MAX_COLOR_DELTA_E
      );
      if (matches.length === 0) {
        return {};
      }
      let bestMatch = matches[0];
      let confidence;
      if (bestMatch.isExact) {
        confidence = "exact";
        if (property && nodeType && this.tokens.colorTokensByHex) {
          const allPaths = this.tokens.colorTokensByHex.get(bestMatch.tokenHex.toLowerCase());
          if (allPaths && allPaths.length > 1) {
            const keywords = getContextKeywords2(property, nodeType);
            const contextual = pickContextualToken2(allPaths, keywords);
            if (contextual && contextual !== bestMatch.tokenPath) {
              console.log(`[OrphanedVariables] Context override: ${bestMatch.tokenPath} \u2192 ${contextual} (keywords: ${keywords.join(",")})`);
              bestMatch = __spreadProps(__spreadValues({}, bestMatch), { tokenPath: contextual });
            }
          }
        }
      } else if (bestMatch.deltaE < 2) {
        confidence = "close";
      } else {
        confidence = "approximate";
      }
      if (hasAlpha && confidence !== "approximate") {
        confidence = "approximate";
      }
      const alternatives = matches.length > 1 ? matches.slice(1, MAX_ALTERNATIVES7 + 1).map((m) => ({
        path: m.tokenPath,
        value: m.tokenHex,
        distance: Math.round(m.deltaE * 10) / 10,
        description: getDeltaEDescription(m.deltaE)
      })) : void 0;
      return {
        suggestedToken: bestMatch.tokenPath,
        confidence,
        alternatives
      };
    }
    /**
     * Find a replacement number token (for spacing, radius, etc.)
     */
    findNumberReplacement(value, property) {
      let tokenPaths = [];
      if (property.includes("padding") || property.includes("Spacing") || property === "itemSpacing" || property === "counterAxisSpacing") {
        tokenPaths = this.findMatchingNumberTokens(value, "spacing");
      } else if (property.includes("Radius") || property === "cornerRadius") {
        tokenPaths = this.findMatchingNumberTokens(value, "radius");
      } else {
        tokenPaths = this.findMatchingNumberTokens(value, "all");
      }
      if (tokenPaths.length === 0) {
        return {};
      }
      const exactMatch = tokenPaths.find((path) => {
        const token2 = this.tokens.tokens.get(path);
        return token2 && token2.resolvedValue === value;
      });
      if (exactMatch) {
        const alternatives2 = tokenPaths.filter((p) => p !== exactMatch).slice(0, MAX_ALTERNATIVES7).map((path) => {
          var _a;
          const token2 = this.tokens.tokens.get(path);
          return {
            path,
            value: String((_a = token2 == null ? void 0 : token2.resolvedValue) != null ? _a : ""),
            distance: token2 ? Math.abs(token2.resolvedValue - value) : 0,
            description: "similar value"
          };
        });
        return {
          suggestedToken: exactMatch,
          confidence: "exact",
          alternatives: alternatives2.length > 0 ? alternatives2 : void 0
        };
      }
      const suggestedToken = tokenPaths[0];
      const token = this.tokens.tokens.get(suggestedToken);
      const tokenValue = token == null ? void 0 : token.resolvedValue;
      const diff = Math.abs(tokenValue - value);
      const percentDiff = value !== 0 ? diff / value : diff;
      const confidence = percentDiff < 0.05 ? "close" : "approximate";
      const alternatives = tokenPaths.slice(1, MAX_ALTERNATIVES7 + 1).map((path) => {
        var _a;
        const t = this.tokens.tokens.get(path);
        return {
          path,
          value: String((_a = t == null ? void 0 : t.resolvedValue) != null ? _a : ""),
          distance: t ? Math.abs(t.resolvedValue - value) : 0,
          description: "similar value"
        };
      });
      return {
        suggestedToken,
        confidence,
        alternatives: alternatives.length > 0 ? alternatives : void 0
      };
    }
    /**
     * Find number tokens that match a value
     */
    findMatchingNumberTokens(value, category) {
      const matches = [];
      const tolerance = value * NUMBER_TOLERANCE_PERCENT;
      const maxAbsoluteTolerance = 8;
      for (const [path, token] of this.tokens.tokens) {
        if (category === "spacing" && !path.toLowerCase().includes("spacing") && !path.toLowerCase().includes("space")) {
          continue;
        }
        if (category === "radius" && !path.toLowerCase().includes("radius") && !path.toLowerCase().includes("radii")) {
          continue;
        }
        if (token.type !== "dimension" && token.type !== "number") {
          continue;
        }
        const tokenValue = token.resolvedValue;
        if (typeof tokenValue !== "number") {
          continue;
        }
        const diff = Math.abs(tokenValue - value);
        if (diff === 0 || diff <= Math.max(tolerance, maxAbsoluteTolerance)) {
          matches.push({ path, diff });
        }
      }
      matches.sort((a, b) => a.diff - b.diff);
      return matches.map((m) => m.path);
    }
  };

  // src/plugin/rules/no-unknown-styles.ts
  var MAX_COLOR_DELTA_E2 = 10;
  var MAX_ALTERNATIVES8 = 3;
  var NoUnknownStylesRule = class extends LintRule {
    constructor(config, tokens) {
      super(config, tokens);
      this.id = "no-unknown-styles";
      this.name = "No Unknown Styles";
      this.description = "Flags nodes using local styles that do not correspond to tokens";
      this.tokenStyleNames = /* @__PURE__ */ new Set();
      for (const path of tokens.tokens.keys()) {
        this.tokenStyleNames.add(path.toLowerCase());
        this.tokenStyleNames.add(path.toLowerCase().replace(/\./g, "/"));
        this.tokenStyleNames.add(path.toLowerCase().replace(/\./g, " / "));
      }
    }
    async check(node, _inspections) {
      const violations = [];
      if ("fillStyleId" in node && node.fillStyleId && typeof node.fillStyleId === "string") {
        const style = await figma.getStyleByIdAsync(node.fillStyleId);
        if (style && !this.isKnownStyle(style.name)) {
          const suggestion = await this.findColorSuggestion(node, "fills");
          const violation = this.createViolation(
            node,
            "fillStyle",
            style.name,
            `Fill style "${style.name}" is not defined in the token set`,
            suggestion == null ? void 0 : suggestion.suggestedToken
          );
          violation.canDetach = true;
          violation.suggestionConfidence = suggestion == null ? void 0 : suggestion.confidence;
          violation.alternativeTokens = suggestion == null ? void 0 : suggestion.alternatives;
          if ((suggestion == null ? void 0 : suggestion.confidence) === "approximate") {
            violation.canIgnore = true;
          }
          violations.push(violation);
        }
      }
      if ("strokeStyleId" in node && node.strokeStyleId && typeof node.strokeStyleId === "string") {
        const style = await figma.getStyleByIdAsync(node.strokeStyleId);
        if (style && !this.isKnownStyle(style.name)) {
          const suggestion = await this.findColorSuggestion(node, "strokes");
          const violation = this.createViolation(
            node,
            "strokeStyle",
            style.name,
            `Stroke style "${style.name}" is not defined in the token set`,
            suggestion == null ? void 0 : suggestion.suggestedToken
          );
          violation.canDetach = true;
          violation.suggestionConfidence = suggestion == null ? void 0 : suggestion.confidence;
          violation.alternativeTokens = suggestion == null ? void 0 : suggestion.alternatives;
          if ((suggestion == null ? void 0 : suggestion.confidence) === "approximate") {
            violation.canIgnore = true;
          }
          violations.push(violation);
        }
      }
      if (node.type === "TEXT") {
        const textNode = node;
        if (textNode.textStyleId && typeof textNode.textStyleId === "string") {
          const style = await figma.getStyleByIdAsync(textNode.textStyleId);
          if (style && !this.isKnownStyle(style.name)) {
            const violation = this.createViolation(
              node,
              "textStyle",
              style.name,
              `Text style "${style.name}" is not defined in the token set. Detach to convert to individual properties.`
            );
            violation.canDetach = true;
            violations.push(violation);
          }
        }
      }
      if ("effectStyleId" in node && node.effectStyleId && typeof node.effectStyleId === "string") {
        const style = await figma.getStyleByIdAsync(node.effectStyleId);
        if (style && !this.isKnownStyle(style.name)) {
          const violation = this.createViolation(
            node,
            "effectStyle",
            style.name,
            `Effect style "${style.name}" is not defined in the token set. Detach to remove style binding.`
          );
          violation.canDetach = true;
          violations.push(violation);
        }
      }
      return violations;
    }
    /**
     * Find a color token suggestion based on the node's current color
     */
    async findColorSuggestion(node, paintType) {
      try {
        if (!(paintType in node)) return null;
        const paints = node[paintType];
        if (!Array.isArray(paints) || paints.length === 0) return null;
        const solidPaint = paints.find((p) => p.type === "SOLID" && p.visible !== false);
        if (!solidPaint) return null;
        const hexColor = rgbToHex(solidPaint.color);
        const hexWithoutAlpha = hexColor.length === 9 ? hexColor.slice(0, 7) : hexColor;
        const matches = findClosestColors(
          hexWithoutAlpha,
          this.tokens.colorValues,
          this.tokens.colorLab,
          MAX_ALTERNATIVES8 + 1,
          MAX_COLOR_DELTA_E2
        );
        if (matches.length === 0) return null;
        const bestMatch = matches[0];
        let confidence;
        if (bestMatch.isExact) {
          confidence = "exact";
        } else if (bestMatch.deltaE < 2) {
          confidence = "close";
        } else {
          confidence = "approximate";
        }
        const alternatives = matches.length > 1 ? matches.slice(1, MAX_ALTERNATIVES8 + 1).map((m) => ({
          path: m.tokenPath,
          value: m.tokenHex,
          distance: Math.round(m.deltaE * 10) / 10,
          description: getDeltaEDescription(m.deltaE)
        })) : void 0;
        return {
          suggestedToken: bestMatch.tokenPath,
          confidence,
          alternatives
        };
      } catch (error) {
        console.error("[NoUnknownStyles] Error finding color suggestion:", error);
        return null;
      }
    }
    /**
     * Check if a style name matches a known token
     */
    isKnownStyle(styleName) {
      const normalized = styleName.toLowerCase();
      if (this.tokenStyleNames.has(normalized)) {
        return true;
      }
      if (this.tokenStyleNames.has(normalized.replace(/ \/ /g, "/"))) {
        return true;
      }
      if (this.tokenStyleNames.has(normalized.replace(/ \/ /g, ".").replace(/\//g, "."))) {
        return true;
      }
      return false;
    }
  };

  // src/plugin/rules/prefer-semantic-variables.ts
  var ICON_NODE_TYPES3 = ["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"];
  function getContextKeywords3(property, nodeType) {
    if (property.includes("stroke")) return ["border"];
    if (property.includes("fill")) {
      if (nodeType === "TEXT") return ["text"];
      if (ICON_NODE_TYPES3.includes(nodeType)) return ["icon"];
      return ["background"];
    }
    return [];
  }
  function contextScore(normalizedVarName, keywords) {
    if (keywords.length === 0) return 0;
    const segments = normalizedVarName.split("/");
    return keywords.some((k) => segments.includes(k)) ? 10 : 0;
  }
  function isSemanticCollection(collName) {
    return collName === "system" || collName.includes("semantic") || collName.includes("component");
  }
  function isSemanticVar(normalizedVarName, collName) {
    if (normalizedVarName.startsWith("system/") || normalizedVarName.startsWith("component/")) {
      return true;
    }
    return isSemanticCollection(collName);
  }
  function resolveToRgba(variable, defaultModes, variableById, visited) {
    const seen = visited || /* @__PURE__ */ new Set();
    if (seen.has(variable.id)) return null;
    seen.add(variable.id);
    const modeId = defaultModes.get(variable.variableCollectionId);
    if (!modeId) return null;
    const value = variable.valuesByMode[modeId];
    if (!value || typeof value !== "object") return null;
    if ("r" in value) return value;
    if ("type" in value && value.type === "VARIABLE_ALIAS") {
      const aliasId = value.id;
      const aliasVar = variableById.get(aliasId);
      if (!aliasVar) return null;
      return resolveToRgba(aliasVar, defaultModes, variableById, seen);
    }
    return null;
  }
  function resolveToNumber(variable, defaultModes, variableById, visited) {
    const seen = visited || /* @__PURE__ */ new Set();
    if (seen.has(variable.id)) return null;
    seen.add(variable.id);
    const modeId = defaultModes.get(variable.variableCollectionId);
    if (!modeId) return null;
    const value = variable.valuesByMode[modeId];
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
      const aliasId = value.id;
      const aliasVar = variableById.get(aliasId);
      if (!aliasVar) return null;
      return resolveToNumber(aliasVar, defaultModes, variableById, seen);
    }
    return null;
  }
  var PreferSemanticVariablesRule = class extends LintRule {
    constructor(config, tokens, figmaVariables) {
      super(config, tokens);
      this.id = "prefer-semantic-variables";
      this.name = "Prefer Semantic Variables";
      this.description = "Flags nodes bound to core variables when semantic alternatives exist";
      // Lazy-built indexes: resolved value → semantic candidates
      this.semanticColorIndex = null;
      this.semanticNumberIndex = null;
      // Shared resolution data (built once with the index)
      this.variableById = null;
      this.defaultModes = null;
      this.collectionNames = null;
      this.indexBuilt = false;
      this.figmaVariables = figmaVariables;
    }
    async check(node, inspections) {
      if (!this.indexBuilt) {
        await this.buildSemanticIndex();
      }
      const violations = [];
      for (const inspection of inspections) {
        if (!inspection.isBound || !inspection.boundVariableId) continue;
        const varInfo = this.figmaVariables.get(inspection.boundVariableId);
        if (!varInfo) continue;
        const normalizedName = normalizePath(varInfo.name);
        const normalizedCollName = normalizePath(varInfo.collectionName);
        if (isSemanticVar(normalizedName, normalizedCollName)) continue;
        const resolved = await this.resolveVariable(inspection.boundVariableId);
        if (!resolved) continue;
        const candidates = this.findSemanticAlternatives(resolved);
        if (candidates.length === 0) continue;
        const keywords = getContextKeywords3(inspection.property, node.type);
        const best = this.pickBestCandidate(candidates, keywords);
        const valueStr = resolved.type === "color" ? resolved.hex : String(resolved.value);
        const message = 'Core variable "' + varInfo.name + '" should use semantic variable "' + best.variableInfo.name + '" (same value: ' + valueStr + ")";
        const violation = this.createViolation(
          node,
          inspection.property,
          varInfo.name,
          message,
          best.variableInfo.name
        );
        violation.suggestionConfidence = "exact";
        violation.canUnbind = true;
        if (candidates.length > 1) {
          violation.alternativeTokens = candidates.filter((c) => c.variableInfo.id !== best.variableInfo.id).slice(0, 3).map((c) => ({
            path: c.variableInfo.name,
            value: valueStr,
            distance: 0,
            description: "semantic alternative"
          }));
        }
        violations.push(violation);
      }
      return violations;
    }
    /**
     * Build the semantic index: maps resolved values to semantic variable candidates.
     * Called once per scan on first check() invocation.
     */
    async buildSemanticIndex() {
      this.semanticColorIndex = /* @__PURE__ */ new Map();
      this.semanticNumberIndex = /* @__PURE__ */ new Map();
      const variables = await figma.variables.getLocalVariablesAsync();
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      this.collectionNames = /* @__PURE__ */ new Map();
      this.defaultModes = /* @__PURE__ */ new Map();
      for (const c of collections) {
        this.collectionNames.set(c.id, normalizePath(c.name));
        this.defaultModes.set(c.id, c.defaultModeId);
      }
      this.variableById = /* @__PURE__ */ new Map();
      for (const v of variables) {
        this.variableById.set(v.id, v);
      }
      for (const v of variables) {
        if (Object.keys(v.valuesByMode).length === 0) continue;
        const collName = this.collectionNames.get(v.variableCollectionId) || "";
        const normalizedName = normalizePath(v.name);
        if (!isSemanticVar(normalizedName, collName)) continue;
        const candidate = {
          variableInfo: {
            id: v.id,
            name: v.name,
            collectionId: v.variableCollectionId,
            collectionName: collName,
            resolvedType: v.resolvedType
          },
          normalizedName
        };
        if (v.resolvedType === "COLOR") {
          const rgba = resolveToRgba(v, this.defaultModes, this.variableById);
          if (rgba) {
            const hex = rgbToHex(rgba);
            const list = this.semanticColorIndex.get(hex) || [];
            list.push(candidate);
            this.semanticColorIndex.set(hex, list);
          }
        } else if (v.resolvedType === "FLOAT") {
          const num = resolveToNumber(v, this.defaultModes, this.variableById);
          if (num !== null) {
            const list = this.semanticNumberIndex.get(num) || [];
            list.push(candidate);
            this.semanticNumberIndex.set(num, list);
          }
        }
      }
      console.log("[PreferSemantic] Index built: " + this.semanticColorIndex.size + " unique colors, " + this.semanticNumberIndex.size + " unique numbers");
      this.indexBuilt = true;
    }
    /**
     * Resolve a variable to its final color hex or number value.
     */
    async resolveVariable(variableId) {
      if (!this.variableById || !this.defaultModes) return null;
      const variable = this.variableById.get(variableId);
      if (!variable) {
        try {
          const fetched = await figma.variables.getVariableByIdAsync(variableId);
          if (!fetched) return null;
          if (fetched.resolvedType === "COLOR") {
            const rgba = resolveToRgba(fetched, this.defaultModes, this.variableById);
            if (rgba) {
              const hex = rgbToHex(rgba);
              return { type: "color", hex };
            }
          } else if (fetched.resolvedType === "FLOAT") {
            const num = resolveToNumber(fetched, this.defaultModes, this.variableById);
            if (num !== null) return { type: "number", value: num };
          }
          return null;
        } catch (e) {
          return null;
        }
      }
      if (variable.resolvedType === "COLOR") {
        const rgba = resolveToRgba(variable, this.defaultModes, this.variableById);
        if (rgba) {
          const hex = rgbToHex(rgba);
          return { type: "color", hex };
        }
      } else if (variable.resolvedType === "FLOAT") {
        const num = resolveToNumber(variable, this.defaultModes, this.variableById);
        if (num !== null) return { type: "number", value: num };
      }
      return null;
    }
    /**
     * Find semantic variable candidates that resolve to the same value.
     */
    findSemanticAlternatives(resolved) {
      if (resolved.type === "color" && resolved.hex && this.semanticColorIndex) {
        return this.semanticColorIndex.get(resolved.hex) || [];
      }
      if (resolved.type === "number" && resolved.value !== void 0 && this.semanticNumberIndex) {
        return this.semanticNumberIndex.get(resolved.value) || [];
      }
      return [];
    }
    /**
     * Pick the best semantic candidate using context scoring.
     */
    pickBestCandidate(candidates, keywords) {
      if (candidates.length === 1) return candidates[0];
      let best = candidates[0];
      let bestScore = -1;
      for (const c of candidates) {
        const score = contextScore(c.normalizedName, keywords);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      return best;
    }
  };

  // src/plugin/rules/index.ts
  function createRules(config, tokens, figmaVariables, matchedVariableIds) {
    const rules = [];
    if (config.rules["no-hardcoded-colors"].enabled) {
      rules.push(new NoHardcodedColorsRule(config.rules["no-hardcoded-colors"], tokens));
    }
    if (config.rules["no-hardcoded-typography"].enabled) {
      rules.push(new NoHardcodedTypographyRule(config.rules["no-hardcoded-typography"], tokens));
    }
    if (config.rules["no-hardcoded-spacing"].enabled) {
      rules.push(new NoHardcodedSpacingRule(config.rules["no-hardcoded-spacing"], tokens));
    }
    if (config.rules["no-hardcoded-radii"].enabled) {
      rules.push(new NoHardcodedRadiiRule(config.rules["no-hardcoded-radii"], tokens));
    }
    if (config.rules["no-hardcoded-stroke-weight"].enabled) {
      rules.push(new NoHardcodedStrokeWeightRule(config.rules["no-hardcoded-stroke-weight"], tokens));
    }
    if (config.rules["no-hardcoded-sizing"].enabled) {
      rules.push(new NoHardcodedSizingRule(config.rules["no-hardcoded-sizing"], tokens));
    }
    if (config.rules["no-orphaned-variables"].enabled) {
      rules.push(
        new NoOrphanedVariablesRule(
          config.rules["no-orphaned-variables"],
          tokens,
          figmaVariables,
          matchedVariableIds
        )
      );
    }
    if (config.rules["no-unknown-styles"].enabled) {
      rules.push(new NoUnknownStylesRule(config.rules["no-unknown-styles"], tokens));
    }
    if (config.rules["prefer-semantic-variables"].enabled) {
      rules.push(
        new PreferSemanticVariablesRule(
          config.rules["prefer-semantic-variables"],
          tokens,
          figmaVariables
        )
      );
    }
    return rules;
  }

  // src/plugin/fixer.ts
  var _cachedIndex = null;
  var _indexTimestamp = 0;
  var INDEX_TTL_MS = 5e3;
  function resolveToRgba2(variable, defaultModes, variableById, visited) {
    const seen = visited || /* @__PURE__ */ new Set();
    if (seen.has(variable.id)) return null;
    seen.add(variable.id);
    const modeId = defaultModes.get(variable.variableCollectionId);
    if (!modeId) return null;
    const value = variable.valuesByMode[modeId];
    if (!value || typeof value !== "object") return null;
    if ("r" in value) return value;
    if ("type" in value && value.type === "VARIABLE_ALIAS") {
      const aliasId = value.id;
      const aliasVar = variableById.get(aliasId);
      if (!aliasVar) return null;
      return resolveToRgba2(aliasVar, defaultModes, variableById, seen);
    }
    return null;
  }
  function resolveToNumber2(variable, defaultModes, variableById, visited) {
    const seen = visited || /* @__PURE__ */ new Set();
    if (seen.has(variable.id)) return null;
    seen.add(variable.id);
    const modeId = defaultModes.get(variable.variableCollectionId);
    if (!modeId) return null;
    const value = variable.valuesByMode[modeId];
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && "type" in value && value.type === "VARIABLE_ALIAS") {
      const aliasId = value.id;
      const aliasVar = variableById.get(aliasId);
      if (!aliasVar) return null;
      return resolveToNumber2(aliasVar, defaultModes, variableById, seen);
    }
    return null;
  }
  function isSemanticCollection2(collName) {
    return collName === "system" || collName.includes("semantic") || collName.includes("component");
  }
  function isSemanticVar2(normalizedVarName, collName) {
    if (normalizedVarName.startsWith("system/") || normalizedVarName.startsWith("component/")) {
      return true;
    }
    return isSemanticCollection2(collName);
  }
  function isComponentVar(normalizedVarName, collName) {
    return normalizedVarName.startsWith("component/") || collName.includes("component");
  }
  async function buildVariableIndex() {
    const variables = await figma.variables.getLocalVariablesAsync();
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionNames = /* @__PURE__ */ new Map();
    const defaultModes = /* @__PURE__ */ new Map();
    for (const c of collections) {
      collectionNames.set(c.id, normalizePath(c.name));
      defaultModes.set(c.id, c.defaultModeId);
    }
    const byFullPath = /* @__PURE__ */ new Map();
    const byName = /* @__PURE__ */ new Map();
    const variableById = /* @__PURE__ */ new Map();
    for (const v of variables) {
      if (Object.keys(v.valuesByMode).length === 0) continue;
      variableById.set(v.id, v);
      const collName = collectionNames.get(v.variableCollectionId) || "";
      const normalizedName = normalizePath(v.name);
      const fullPath = collName ? collName + "/" + normalizedName : normalizedName;
      byFullPath.set(fullPath, v);
      const list = byName.get(normalizedName) || [];
      list.push(v);
      byName.set(normalizedName, list);
    }
    const byResolvedColor = /* @__PURE__ */ new Map();
    const byResolvedNumber = /* @__PURE__ */ new Map();
    const resolvedColorById = /* @__PURE__ */ new Map();
    const resolvedNumberById = /* @__PURE__ */ new Map();
    for (const v of variables) {
      if (Object.keys(v.valuesByMode).length === 0) continue;
      const collName = collectionNames.get(v.variableCollectionId) || "";
      const normalizedName = normalizePath(v.name);
      const isSemantic = isSemanticVar2(normalizedName, collName);
      if (v.resolvedType === "COLOR") {
        const rgba = resolveToRgba2(v, defaultModes, variableById);
        if (rgba) {
          const hex = rgbToHex(rgba);
          resolvedColorById.set(v.id, hex);
          const list = byResolvedColor.get(hex) || [];
          if (isSemantic) {
            list.unshift(v);
          } else {
            list.push(v);
          }
          byResolvedColor.set(hex, list);
        }
      } else if (v.resolvedType === "FLOAT") {
        const num = resolveToNumber2(v, defaultModes, variableById);
        if (num !== null) {
          resolvedNumberById.set(v.id, num);
          const list = byResolvedNumber.get(num) || [];
          if (isSemantic) {
            list.unshift(v);
          } else {
            list.push(v);
          }
          byResolvedNumber.set(num, list);
        }
      }
    }
    console.log("[Fixer] Index built: " + byFullPath.size + " vars, " + byResolvedColor.size + " unique colors, " + byResolvedNumber.size + " unique numbers");
    return {
      byFullPath,
      byName,
      collectionNames,
      defaultModes,
      byResolvedColor,
      byResolvedNumber,
      resolvedColorById,
      resolvedNumberById
    };
  }
  async function getVariableIndex() {
    const now = Date.now();
    if (_cachedIndex && now - _indexTimestamp < INDEX_TTL_MS) {
      return _cachedIndex;
    }
    _cachedIndex = await buildVariableIndex();
    _indexTimestamp = now;
    return _cachedIndex;
  }
  var _libraryVarCache = null;
  var _libraryCacheTimestamp = 0;
  var LIBRARY_CACHE_TTL_MS = 3e4;
  async function getLibraryVariableMap() {
    const now = Date.now();
    if (_libraryVarCache && now - _libraryCacheTimestamp < LIBRARY_CACHE_TTL_MS) {
      return _libraryVarCache;
    }
    const map = /* @__PURE__ */ new Map();
    try {
      if (!figma.teamLibrary || !figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync) {
        console.log("[Fixer] Team library API not available");
        _libraryVarCache = map;
        _libraryCacheTimestamp = now;
        return map;
      }
      const collections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      for (const collection of collections) {
        const variables = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key);
        for (const v of variables) {
          const normalized = normalizePath(v.name);
          const list = map.get(normalized) || [];
          list.push({
            key: v.key,
            name: v.name,
            resolvedType: v.resolvedType,
            collectionName: collection.name
          });
          map.set(normalized, list);
        }
      }
      console.log("[Fixer] Library variable map: " + map.size + " unique names from " + collections.length + " collections");
    } catch (e) {
      console.warn("[Fixer] Could not fetch library variables:", e);
    }
    _libraryVarCache = map;
    _libraryCacheTimestamp = now;
    return map;
  }
  async function findAndImportLibraryVariable(tokenPath, expectedType, tokens) {
    const libraryVars = await getLibraryVariableMap();
    if (libraryVars.size === 0) return null;
    const pathsToTry = [tokenPath];
    if (tokens) {
      let currentPath = tokenPath;
      const visited = /* @__PURE__ */ new Set();
      while (!visited.has(currentPath)) {
        visited.add(currentPath);
        const token = tokens.tokens.get(currentPath);
        if (token && token.isAlias && token.aliasPath) {
          pathsToTry.push(token.aliasPath);
          currentPath = token.aliasPath;
        } else {
          break;
        }
      }
    }
    for (const path of pathsToTry) {
      const normalized = normalizePath(path);
      const exact = libraryVars.get(normalized);
      if (exact) {
        for (const c of exact) {
          if (!expectedType || c.resolvedType === expectedType) {
            try {
              const imported = await figma.variables.importVariableByKeyAsync(c.key);
              console.log("[Fixer] Imported library variable: " + c.name + " from " + c.collectionName);
              _cachedIndex = null;
              return imported;
            } catch (e) {
              console.warn("[Fixer] Failed to import " + c.name + ":", e);
            }
          }
        }
      }
      let bestMatch = null;
      let bestLen = 0;
      for (const [varName, vars] of libraryVars) {
        const segCount = varName.split("/").length;
        if (segCount >= 2 && segCount > bestLen && pathEndsWith(normalized, varName)) {
          for (const c of vars) {
            if (!expectedType || c.resolvedType === expectedType) {
              bestMatch = c;
              bestLen = segCount;
              break;
            }
          }
        }
      }
      if (bestMatch) {
        try {
          const imported = await figma.variables.importVariableByKeyAsync(bestMatch.key);
          console.log("[Fixer] Imported library variable (suffix): " + bestMatch.name + " from " + bestMatch.collectionName);
          _cachedIndex = null;
          return imported;
        } catch (e) {
          console.warn("[Fixer] Failed to import " + bestMatch.name + ":", e);
        }
      }
    }
    return null;
  }
  var ICON_NODE_TYPES4 = ["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"];
  function getContextKeywords4(property, nodeType) {
    if (property.includes("stroke")) return ["border"];
    if (property.includes("fill")) {
      if (nodeType === "TEXT") return ["text"];
      if (ICON_NODE_TYPES4.includes(nodeType)) return ["icon"];
      return ["background"];
    }
    return [];
  }
  function contextScore2(normalizedVarName, keywords) {
    if (keywords.length === 0) return 0;
    const segments = normalizedVarName.split("/");
    return keywords.some((k) => segments.includes(k)) ? 10 : 0;
  }
  function readCurrentValue(node, property) {
    var _a, _b;
    const fillMatch = property.match(/^fills\[(\d+)\]$/);
    if (fillMatch && "fills" in node) {
      const idx = parseInt(fillMatch[1], 10);
      const fills = node.fills;
      if (Array.isArray(fills) && fills[idx] && fills[idx].type === "SOLID") {
        const paint = fills[idx];
        const opacity = (_a = paint.opacity) != null ? _a : 1;
        const hex = rgbToHex(__spreadProps(__spreadValues({}, paint.color), { a: opacity }));
        return { type: "color", hex };
      }
    }
    const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
    if (strokeMatch && "strokes" in node) {
      const idx = parseInt(strokeMatch[1], 10);
      const strokes = node.strokes;
      if (Array.isArray(strokes) && strokes[idx] && strokes[idx].type === "SOLID") {
        const paint = strokes[idx];
        const opacity = (_b = paint.opacity) != null ? _b : 1;
        const hex = rgbToHex(__spreadProps(__spreadValues({}, paint.color), { a: opacity }));
        return { type: "color", hex };
      }
    }
    const nodeWithProps = node;
    const val = nodeWithProps[property];
    if (typeof val === "number") {
      return { type: "number", value: val };
    }
    return null;
  }
  function typeMatches(v, expected) {
    return !expected || v.resolvedType === expected;
  }
  async function findVariableForToken(tokenPath, index, expectedType, tokens, context, currentValue) {
    const cvDesc = currentValue ? currentValue.type === "color" ? currentValue.hex : String(currentValue.value) : "unknown";
    console.log('[Fixer] Finding variable for "' + tokenPath + '" (current: ' + cvDesc + ")");
    const keywords = context ? getContextKeywords4(context.property, context.nodeType) : [];
    {
      const match = tryNameBasedMatch(tokenPath, index, expectedType, context);
      if (match) {
        if (currentValue && currentValue.type === "color") {
          const varHex = index.resolvedColorById.get(match.id);
          if (varHex && varHex !== currentValue.hex) {
            console.log('[Fixer] Name match "' + match.name + '" rejected: color ' + varHex + " != " + currentValue.hex);
          } else {
            console.log("[Fixer] Name match: " + match.name);
            return match;
          }
        } else if (currentValue && currentValue.type === "number") {
          const varNum = index.resolvedNumberById.get(match.id);
          if (varNum !== void 0 && varNum !== currentValue.value) {
            const diff = Math.abs(varNum - currentValue.value);
            const pctDiff = currentValue.value !== 0 ? diff / Math.abs(currentValue.value) : diff;
            if (diff <= 1 || pctDiff <= 0.05) {
              console.log("[Fixer] Name match (close, diff=" + diff.toFixed(2) + "): " + match.name);
              return match;
            }
            console.log('[Fixer] Name match "' + match.name + '" rejected: number ' + varNum + " != " + currentValue.value + " (diff=" + diff.toFixed(2) + ")");
          } else {
            console.log("[Fixer] Name match: " + match.name);
            return match;
          }
        } else {
          console.log("[Fixer] Name match: " + match.name);
          return match;
        }
      }
    }
    const excludeComponent = (v) => {
      const collName = index.collectionNames.get(v.variableCollectionId) || "";
      return !isComponentVar(normalizePath(v.name), collName);
    };
    if (currentValue && currentValue.type === "color") {
      const candidates = index.byResolvedColor.get(currentValue.hex);
      if (candidates && candidates.length > 0) {
        const nonComponent = candidates.filter((v) => typeMatches(v, expectedType) && excludeComponent(v));
        if (nonComponent.length > 0) {
          const best = pickBestVariable(nonComponent, index, keywords, tokenPath, tokens);
          console.log("[Fixer] Value match (" + nonComponent.length + " candidates, component excluded): " + best.name);
          return best;
        }
        const typed = candidates.filter((v) => typeMatches(v, expectedType));
        if (typed.length > 0) {
          const best = pickBestVariable(typed, index, keywords, tokenPath, tokens);
          console.log("[Fixer] Value match (fallback with component, " + typed.length + " candidates): " + best.name);
          return best;
        }
      }
    }
    if (currentValue && currentValue.type === "number") {
      const candidates = index.byResolvedNumber.get(currentValue.value);
      if (candidates && candidates.length > 0) {
        const nonComponent = candidates.filter((v) => typeMatches(v, expectedType) && excludeComponent(v));
        if (nonComponent.length > 0) {
          const best = pickBestVariable(nonComponent, index, keywords, tokenPath, tokens);
          console.log("[Fixer] Number value match (" + nonComponent.length + " candidates, component excluded): " + best.name);
          return best;
        }
        const typed = candidates.filter((v) => typeMatches(v, expectedType));
        if (typed.length > 0) {
          const best = pickBestVariable(typed, index, keywords, tokenPath, tokens);
          console.log("[Fixer] Number value match (fallback with component, " + typed.length + " candidates): " + best.name);
          return best;
        }
      }
      let bestCloseVar = null;
      let bestCloseDiff = Infinity;
      let bestCloseScore = -Infinity;
      for (const [numVal, vars] of index.byResolvedNumber) {
        const diff = Math.abs(numVal - currentValue.value);
        if (diff > 0 && diff <= 1) {
          const typed = vars.filter((v) => typeMatches(v, expectedType) && excludeComponent(v));
          if (typed.length > 0) {
            const best = pickBestVariable(typed, index, keywords, tokenPath, tokens);
            const nameScore = normalizePath(best.name) === normalizePath(tokenPath) ? 20 : pathEndsWith(normalizePath(tokenPath), normalizePath(best.name)) ? 15 : 0;
            const score = nameScore + contextScore2(normalizePath(best.name), keywords) - diff;
            if (score > bestCloseScore || score === bestCloseScore && diff < bestCloseDiff) {
              bestCloseVar = best;
              bestCloseDiff = diff;
              bestCloseScore = score;
            }
          }
        }
      }
      if (bestCloseVar) {
        console.log("[Fixer] Close number match (diff=" + bestCloseDiff.toFixed(2) + "): " + bestCloseVar.name);
        return bestCloseVar;
      }
    }
    console.log("[Fixer] Trying library variables for: " + tokenPath);
    const libraryVar = await findAndImportLibraryVariable(tokenPath, expectedType, tokens);
    if (libraryVar) {
      return libraryVar;
    }
    console.log("[Fixer] No variable found (local: " + index.byResolvedNumber.size + " number vars, " + index.byResolvedColor.size + " color vars): " + tokenPath);
    return null;
  }
  function tryNameBasedMatch(tokenPath, index, expectedType, context) {
    const normalized = normalizePath(tokenPath);
    const full = index.byFullPath.get(normalized);
    if (full && typeMatches(full, expectedType)) return full;
    const nameMatches = index.byName.get(normalized);
    if (nameMatches) {
      const typed = nameMatches.filter((v) => typeMatches(v, expectedType));
      if (typed.length === 1) return typed[0];
      if (typed.length > 1) return pickBestFromMultiple(typed, index, context);
    }
    let bestSuffix = null;
    let bestLen = 0;
    for (const [varName, vars] of index.byName) {
      const segCount = varName.split("/").length;
      if (segCount >= 2 && segCount > bestLen && pathEndsWith(normalized, varName)) {
        const typed = vars.filter((v) => typeMatches(v, expectedType));
        if (typed.length > 0) {
          bestSuffix = typed.length === 1 ? typed[0] : pickBestFromMultiple(typed, index, context);
          bestLen = segCount;
        }
      }
    }
    return bestSuffix;
  }
  function pickBestFromMultiple(vars, index, context) {
    const keywords = context ? getContextKeywords4(context.property, context.nodeType) : [];
    const system = [];
    const nonComponent = [];
    for (const v of vars) {
      const normalizedName = normalizePath(v.name);
      const collName = index.collectionNames.get(v.variableCollectionId) || "";
      if (isComponentVar(normalizedName, collName)) continue;
      nonComponent.push(v);
      if (isSemanticVar2(normalizedName, collName)) system.push(v);
    }
    const pool = system.length > 0 ? system : nonComponent.length > 0 ? nonComponent : vars;
    if (pool.length === 1) return pool[0];
    let best = pool[0];
    let bestScore = -1;
    for (const v of pool) {
      let score = 0;
      score += contextScore2(normalizePath(v.name), keywords);
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  }
  function pickBestVariable(candidates, index, keywords, tokenPath, _tokens) {
    if (candidates.length === 1) return candidates[0];
    const system = [];
    const core = [];
    for (const v of candidates) {
      const normalizedName = normalizePath(v.name);
      const collName = index.collectionNames.get(v.variableCollectionId) || "";
      if (isComponentVar(normalizedName, collName)) {
        continue;
      }
      if (isSemanticVar2(normalizedName, collName)) {
        system.push(v);
      } else {
        core.push(v);
      }
    }
    const pool = system.length > 0 ? system : core;
    if (pool.length === 1) return pool[0];
    const normalizedTokenPath = normalizePath(tokenPath);
    let best = pool[0];
    let bestScore = -Infinity;
    for (const v of pool) {
      let score = 0;
      const normalizedName = normalizePath(v.name);
      const collName = index.collectionNames.get(v.variableCollectionId) || "";
      const fullPath = collName ? collName + "/" + normalizedName : normalizedName;
      score += contextScore2(normalizedName, keywords);
      if (fullPath === normalizedTokenPath || normalizedName === normalizedTokenPath) {
        score += 20;
      } else if (normalizedName.split("/").length >= 2 && pathEndsWith(normalizedTokenPath, normalizedName)) {
        score += 15;
      }
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  }
  function getExpectedVariableType(ruleId) {
    switch (ruleId) {
      case "no-hardcoded-colors":
      case "no-unknown-styles":
        return "COLOR";
      case "no-hardcoded-spacing":
      case "no-hardcoded-radii":
      case "no-hardcoded-stroke-weight":
      case "no-hardcoded-sizing":
      case "no-hardcoded-typography":
        return "FLOAT";
      default:
        return void 0;
    }
  }
  function colorToString(paint) {
    const r = Math.round(paint.color.r * 255);
    const g = Math.round(paint.color.g * 255);
    const b = Math.round(paint.color.b * 255);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  async function applyColorBinding(node, property, variable) {
    var _a, _b;
    const fillMatch = property.match(/^fills\[(\d+)\]$/);
    const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
    if (fillMatch && "fills" in node) {
      const idx = parseInt(fillMatch[1], 10);
      const fills = node.fills;
      if (!Array.isArray(fills) || !fills[idx]) {
        return { success: false, message: "Fill not found at index " + idx };
      }
      try {
        const paint = fills[idx];
        const beforeValue = ((_a = paint.boundVariables) == null ? void 0 : _a.color) ? `var(${paint.boundVariables.color.id})` : paint.type === "SOLID" ? colorToString(paint) : "gradient/image";
        const newFills = [...fills];
        newFills[idx] = figma.variables.setBoundVariableForPaint(
          newFills[idx],
          "color",
          variable
        );
        node.fills = newFills;
        return { success: true, beforeValue, afterValue: variable.name, actionType: "rebind" };
      } catch (e) {
        return { success: false, message: "Fill bind failed: " + (e instanceof Error ? e.message : String(e)) };
      }
    }
    if (strokeMatch && "strokes" in node) {
      const idx = parseInt(strokeMatch[1], 10);
      const strokes = node.strokes;
      if (!Array.isArray(strokes) || !strokes[idx]) {
        return { success: false, message: "Stroke not found at index " + idx };
      }
      try {
        const paint = strokes[idx];
        const beforeValue = ((_b = paint.boundVariables) == null ? void 0 : _b.color) ? `var(${paint.boundVariables.color.id})` : paint.type === "SOLID" ? colorToString(paint) : "gradient/image";
        const newStrokes = [...strokes];
        newStrokes[idx] = figma.variables.setBoundVariableForPaint(
          newStrokes[idx],
          "color",
          variable
        );
        node.strokes = newStrokes;
        return { success: true, beforeValue, afterValue: variable.name, actionType: "rebind" };
      } catch (e) {
        return { success: false, message: "Stroke bind failed: " + (e instanceof Error ? e.message : String(e)) };
      }
    }
    return { success: false, message: "Unknown color property: " + property };
  }
  function getNumberPropertyValue(node, property) {
    const nodeWithProps = node;
    const boundVars = node.boundVariables;
    if (boundVars && boundVars[property]) {
      return `var(${boundVars[property].id})`;
    }
    const value = nodeWithProps[property];
    return typeof value === "number" ? String(value) : "unknown";
  }
  async function applyNumberBinding(node, property, variable) {
    if (!("boundVariables" in node)) {
      return { success: false, message: "Node does not support variable bindings" };
    }
    const fieldMap = {
      itemSpacing: "itemSpacing",
      counterAxisSpacing: "counterAxisSpacing",
      paddingTop: "paddingTop",
      paddingRight: "paddingRight",
      paddingBottom: "paddingBottom",
      paddingLeft: "paddingLeft",
      cornerRadius: "topLeftRadius",
      topLeftRadius: "topLeftRadius",
      topRightRadius: "topRightRadius",
      bottomLeftRadius: "bottomLeftRadius",
      bottomRightRadius: "bottomRightRadius",
      strokeWeight: "strokeWeight",
      strokeTopWeight: "strokeTopWeight",
      strokeRightWeight: "strokeRightWeight",
      strokeBottomWeight: "strokeBottomWeight",
      strokeLeftWeight: "strokeLeftWeight",
      width: "width",
      height: "height",
      minWidth: "minWidth",
      maxWidth: "maxWidth",
      minHeight: "minHeight",
      maxHeight: "maxHeight"
    };
    const field = fieldMap[property];
    if (!field) {
      return { success: false, message: "Property is not bindable: " + property };
    }
    try {
      const beforeValue = getNumberPropertyValue(node, property);
      const bindableNode = node;
      if (property === "cornerRadius" && "cornerRadius" in node && typeof node.cornerRadius === "number") {
        bindableNode.setBoundVariable("topLeftRadius", variable);
        bindableNode.setBoundVariable("topRightRadius", variable);
        bindableNode.setBoundVariable("bottomLeftRadius", variable);
        bindableNode.setBoundVariable("bottomRightRadius", variable);
      } else {
        bindableNode.setBoundVariable(field, variable);
      }
      return { success: true, beforeValue, afterValue: variable.name, actionType: "rebind" };
    } catch (e) {
      return { success: false, message: "Number bind failed: " + (e instanceof Error ? e.message : String(e)) };
    }
  }
  async function applyTypographyBinding(node, property, variable) {
    if (node.type !== "TEXT") {
      return { success: false, message: "Node is not a text node" };
    }
    if (property === "paragraphSpacing") {
      try {
        const textNode = node;
        const beforeValue = getNumberPropertyValue(textNode, "paragraphSpacing");
        textNode.setBoundVariable("paragraphSpacing", variable);
        return { success: true, beforeValue, afterValue: variable.name, actionType: "rebind" };
      } catch (e) {
        return { success: false, message: "Typography bind failed: " + (e instanceof Error ? e.message : String(e)) };
      }
    }
    return {
      success: false,
      message: property + ' cannot be bound to variables. Use "Apply Style" with an existing text style instead.'
    };
  }
  async function detachAndRebind(node, styleProperty, tokenPath, index, tokens) {
    const paintProperty = styleProperty === "fillStyle" ? "fills[0]" : "strokes[0]";
    if (styleProperty === "fillStyle" && "fillStyleId" in node) {
      node.fillStyleId = "";
    } else if (styleProperty === "strokeStyle" && "strokeStyleId" in node) {
      node.strokeStyleId = "";
    } else {
      return { success: false, message: "Node does not support style: " + styleProperty };
    }
    const currentValue = readCurrentValue(node, paintProperty);
    if (!currentValue || currentValue.type !== "color") {
      return { success: true, message: "Style detached (no solid paint to rebind)", actionType: "detach" };
    }
    const variable = await findVariableForToken(
      tokenPath,
      index,
      "COLOR",
      tokens,
      { property: paintProperty, nodeType: node.type },
      currentValue
    );
    if (!variable) {
      return { success: true, message: "Style detached (no matching variable found for rebind)", actionType: "detach" };
    }
    console.log('[Fixer] Detach+rebind: binding "' + variable.name + '" -> ' + paintProperty + ' on "' + node.name + '"');
    const bindResult = await applyColorBinding(node, paintProperty, variable);
    if (bindResult.success) {
      return { success: true, beforeValue: "style", afterValue: variable.name, actionType: "rebind" };
    }
    return { success: true, message: "Style detached but rebind failed: " + bindResult.message, actionType: "detach" };
  }
  async function applyFix(nodeId, property, tokenPath, ruleId, _themeConfigs, tokens) {
    console.log("[Fixer] applyFix:", { nodeId, property, tokenPath, ruleId });
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
        return { success: false, message: "Node not found: " + nodeId };
      }
      const sceneNode = node;
      const index = await getVariableIndex();
      if (ruleId === "no-unknown-styles") {
        if (property === "fillStyle" || property === "strokeStyle") {
          return detachAndRebind(sceneNode, property, tokenPath, index, tokens);
        }
        return detachStyle(nodeId, property);
      }
      const expectedType = getExpectedVariableType(ruleId);
      const currentValue = readCurrentValue(sceneNode, property);
      const variable = await findVariableForToken(
        tokenPath,
        index,
        expectedType,
        tokens,
        { property, nodeType: sceneNode.type },
        currentValue
      );
      if (!variable) {
        return {
          success: false,
          message: "No Figma variable found for token: " + tokenPath + (currentValue && currentValue.type === "number" ? " (value: " + currentValue.value + ")" : currentValue && currentValue.type === "color" ? " (color: " + currentValue.hex + ")" : "") + ". Ensure variables are synced via Tokens Studio or available in a team library."
        };
      }
      console.log('[Fixer] Binding "' + variable.name + '" -> ' + property + ' on "' + sceneNode.name + '"');
      switch (ruleId) {
        case "no-hardcoded-colors":
          return applyColorBinding(sceneNode, property, variable);
        case "no-hardcoded-spacing":
        case "no-hardcoded-radii":
        case "no-hardcoded-stroke-weight":
        case "no-hardcoded-sizing":
          return applyNumberBinding(sceneNode, property, variable);
        case "no-hardcoded-typography":
          return applyTypographyBinding(sceneNode, property, variable);
        case "no-orphaned-variables":
        case "prefer-semantic-variables":
          if (variable.resolvedType === "COLOR") {
            return applyColorBinding(sceneNode, property, variable);
          }
          if (variable.resolvedType === "FLOAT") {
            if (["fontSize", "lineHeight", "letterSpacing", "paragraphSpacing"].includes(property)) {
              return applyTypographyBinding(sceneNode, property, variable);
            }
            return applyNumberBinding(sceneNode, property, variable);
          }
          return { success: false, message: "Cannot rebind variable type: " + variable.resolvedType };
        default:
          return { success: false, message: "Auto-fix not supported for: " + ruleId };
      }
    } catch (e) {
      const msg = "Fix error: " + (e instanceof Error ? e.message : String(e));
      console.error("[Fixer]", msg);
      return { success: false, message: msg };
    }
  }
  async function applyBulkFix(fixes, themeConfigs, onProgress, tokens) {
    let successful = 0;
    let failed = 0;
    const errors = [];
    const actions = [];
    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      let nodeName = "Unknown";
      try {
        const node = await figma.getNodeByIdAsync(fix.nodeId);
        if (node && "name" in node) nodeName = node.name;
      } catch (e) {
      }
      const result = await applyFix(
        fix.nodeId,
        fix.property,
        fix.tokenPath,
        fix.ruleId,
        themeConfigs,
        tokens
      );
      const action = {
        nodeId: fix.nodeId,
        nodeName,
        property: fix.property,
        actionType: result.actionType || "rebind",
        beforeValue: result.beforeValue || "unknown",
        afterValue: result.afterValue || fix.tokenPath,
        status: result.success ? "success" : "failed",
        errorMessage: result.message,
        timestamp: Date.now()
      };
      actions.push(action);
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.message) errors.push(fix.nodeId + ": " + result.message);
      }
      if (onProgress) {
        onProgress({ current: i + 1, total: fixes.length, currentAction: action });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { successful, failed, errors, actions };
  }
  function getBoundVariableFromPaint(paint) {
    var _a, _b;
    return ((_b = (_a = paint.boundVariables) == null ? void 0 : _a.color) == null ? void 0 : _b.id) || null;
  }
  async function unbindVariable(nodeId, property) {
    var _a;
    console.log("[Fixer] unbindVariable:", { nodeId, property });
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
        return { success: false, message: "Node not found: " + nodeId };
      }
      const sceneNode = node;
      const fillMatch = property.match(/^fills\[(\d+)\]$/);
      const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
      if (fillMatch && "fills" in sceneNode) {
        const index = parseInt(fillMatch[1], 10);
        const fills = sceneNode.fills;
        if (Array.isArray(fills) && fills[index]) {
          const paint = fills[index];
          const boundVarId = getBoundVariableFromPaint(paint);
          const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);
          if (paint.type === "SOLID") {
            const newFills = [...fills];
            newFills[index] = {
              type: "SOLID",
              color: paint.color,
              opacity: paint.opacity,
              visible: paint.visible,
              blendMode: paint.blendMode
            };
            sceneNode.fills = newFills;
            return { success: true, beforeValue, afterValue: colorToString(paint), actionType: "unbind" };
          }
        }
      }
      if (strokeMatch && "strokes" in sceneNode) {
        const index = parseInt(strokeMatch[1], 10);
        const strokes = sceneNode.strokes;
        if (Array.isArray(strokes) && strokes[index]) {
          const paint = strokes[index];
          const boundVarId = getBoundVariableFromPaint(paint);
          const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);
          if (paint.type === "SOLID") {
            const newStrokes = [...strokes];
            newStrokes[index] = {
              type: "SOLID",
              color: paint.color,
              opacity: paint.opacity,
              visible: paint.visible,
              blendMode: paint.blendMode
            };
            sceneNode.strokes = newStrokes;
            return { success: true, beforeValue, afterValue: colorToString(paint), actionType: "unbind" };
          }
        }
      }
      if (sceneNode.type === "TEXT" && property === "paragraphSpacing") {
        const textNode = sceneNode;
        const beforeValue = getNumberPropertyValue(textNode, "paragraphSpacing");
        const currentValue = String(textNode.paragraphSpacing);
        textNode.setBoundVariable("paragraphSpacing", null);
        return { success: true, beforeValue, afterValue: currentValue, actionType: "unbind" };
      }
      if ("setBoundVariable" in sceneNode) {
        const bindableNode = sceneNode;
        const propertyToField = {
          itemSpacing: "itemSpacing",
          counterAxisSpacing: "counterAxisSpacing",
          paddingTop: "paddingTop",
          paddingRight: "paddingRight",
          paddingBottom: "paddingBottom",
          paddingLeft: "paddingLeft",
          topLeftRadius: "topLeftRadius",
          topRightRadius: "topRightRadius",
          bottomLeftRadius: "bottomLeftRadius",
          bottomRightRadius: "bottomRightRadius",
          cornerRadius: "topLeftRadius",
          strokeWeight: "strokeWeight",
          strokeTopWeight: "strokeTopWeight",
          strokeRightWeight: "strokeRightWeight",
          strokeBottomWeight: "strokeBottomWeight",
          strokeLeftWeight: "strokeLeftWeight",
          width: "width",
          height: "height",
          minWidth: "minWidth",
          maxWidth: "maxWidth",
          minHeight: "minHeight",
          maxHeight: "maxHeight"
        };
        const field = propertyToField[property];
        if (field) {
          const beforeValue = getNumberPropertyValue(sceneNode, property);
          const nodeWithProps = sceneNode;
          const currentValue = String((_a = nodeWithProps[property]) != null ? _a : "unknown");
          if (property === "cornerRadius") {
            bindableNode.setBoundVariable("topLeftRadius", null);
            bindableNode.setBoundVariable("topRightRadius", null);
            bindableNode.setBoundVariable("bottomLeftRadius", null);
            bindableNode.setBoundVariable("bottomRightRadius", null);
          } else {
            bindableNode.setBoundVariable(field, null);
          }
          return { success: true, beforeValue, afterValue: currentValue, actionType: "unbind" };
        }
      }
      return { success: false, message: "Cannot unbind property: " + property };
    } catch (e) {
      const msg = "Unbind error: " + (e instanceof Error ? e.message : String(e));
      console.error("[Fixer]", msg);
      return { success: false, message: msg };
    }
  }
  async function detachStyle(nodeId, property) {
    console.log("[Fixer] detachStyle:", { nodeId, property });
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
        return { success: false, message: "Node not found: " + nodeId };
      }
      const sceneNode = node;
      switch (property) {
        case "fillStyle":
          if ("fillStyleId" in sceneNode) {
            const nodeWithStyle = sceneNode;
            const beforeValue = nodeWithStyle.fillStyleId || "none";
            nodeWithStyle.fillStyleId = "";
            return { success: true, message: "Fill style detached", beforeValue, afterValue: "detached", actionType: "detach" };
          }
          break;
        case "strokeStyle":
          if ("strokeStyleId" in sceneNode) {
            const nodeWithStyle = sceneNode;
            const beforeValue = nodeWithStyle.strokeStyleId || "none";
            nodeWithStyle.strokeStyleId = "";
            return { success: true, message: "Stroke style detached", beforeValue, afterValue: "detached", actionType: "detach" };
          }
          break;
        case "textStyle":
          if (sceneNode.type === "TEXT") {
            const textNode = sceneNode;
            const rawStyleId = textNode.textStyleId;
            const beforeValue = typeof rawStyleId === "symbol" ? "mixed" : rawStyleId || "none";
            await textNode.setTextStyleIdAsync("");
            return { success: true, message: "Text style detached", beforeValue, afterValue: "detached", actionType: "detach" };
          }
          break;
        case "effectStyle":
          if ("effectStyleId" in sceneNode) {
            const nodeWithStyle = sceneNode;
            const beforeValue = nodeWithStyle.effectStyleId || "none";
            nodeWithStyle.effectStyleId = "";
            return { success: true, message: "Effect style detached", beforeValue, afterValue: "detached", actionType: "detach" };
          }
          break;
        default:
          return { success: false, message: "Unknown style property: " + property };
      }
      return { success: false, message: "Node does not support style: " + property };
    } catch (e) {
      const msg = "Detach style error: " + (e instanceof Error ? e.message : String(e));
      console.error("[Fixer]", msg);
      return { success: false, message: msg };
    }
  }
  async function bulkDetachStyles(detaches) {
    let successful = 0;
    let failed = 0;
    const errors = [];
    for (const detach of detaches) {
      const result = await detachStyle(detach.nodeId, detach.property);
      if (result.success) {
        successful++;
      } else {
        failed++;
        if (result.message) errors.push(detach.nodeId + ": " + result.message);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { successful, failed, errors };
  }
  async function applyTextStyle(nodeId, textStyleId) {
    console.log("[Fixer] applyTextStyle:", { nodeId, textStyleId });
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type !== "TEXT") {
        return { success: false, message: "Node not found or not a text node: " + nodeId };
      }
      const textNode = node;
      const style = await figma.getStyleByIdAsync(textStyleId);
      if (!style || style.type !== "TEXT") {
        return { success: false, message: "Text style not found: " + textStyleId };
      }
      const rawStyleId = textNode.textStyleId;
      const beforeValue = typeof rawStyleId === "symbol" ? "mixed styles" : rawStyleId || "no style";
      await textNode.setTextStyleIdAsync(textStyleId);
      return { success: true, beforeValue, afterValue: style.name, actionType: "apply-style" };
    } catch (e) {
      const msg = "Apply text style error: " + (e instanceof Error ? e.message : String(e));
      console.error("[Fixer]", msg);
      return { success: false, message: msg };
    }
  }

  // src/plugin/sync.ts
  function getTokenLayer(token) {
    const sourceFile = token.sourceFile.toLowerCase();
    if (sourceFile.includes("core") || sourceFile.includes("primitives")) {
      return "core";
    }
    if (sourceFile.includes("semantic")) {
      return "semantic";
    }
    if (sourceFile.includes("component")) {
      return "component";
    }
    if (token.path.startsWith("system.") || token.path.startsWith("core.")) {
      return "core";
    }
    if (token.path.startsWith("component.")) {
      return "component";
    }
    return "semantic";
  }
  function tokenPathToVariableName(tokenPath) {
    return tokenPath.replace(/\./g, "/");
  }
  function variableNameToTokenPath(variableName) {
    return variableName.replace(/\//g, ".");
  }
  function getVariableType(token) {
    switch (token.type) {
      case "color":
        return "COLOR";
      case "number":
      case "dimension":
        return "FLOAT";
      default:
        return "FLOAT";
    }
  }
  function hexToFigmaRGB(hex) {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return { r, g, b };
  }
  function parseDimension(value) {
    if (typeof value === "number") {
      return value;
    }
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ""));
    return isNaN(numericValue) ? 0 : numericValue;
  }
  function tokenValueToFigmaValue(token) {
    const value = token.resolvedValue;
    switch (token.type) {
      case "color":
        if (typeof value === "string" && value.startsWith("#")) {
          return hexToFigmaRGB(value);
        }
        return null;
      case "number":
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const num = parseFloat(value);
          return isNaN(num) ? null : num;
        }
        return null;
      case "dimension":
        return parseDimension(value);
      default:
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "string") {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return num;
          }
        }
        return null;
    }
  }
  async function getOrCreateCollection(name, modes) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    let collection = collections.find((c) => c.name === name);
    if (!collection) {
      collection = figma.variables.createVariableCollection(name);
      console.log(`[Sync] Created collection: ${name}`);
    }
    const existingModeNames = collection.modes.map((m) => m.name);
    for (const modeName of modes) {
      if (!existingModeNames.includes(modeName)) {
        if (collection.modes.length === 1 && collection.modes[0].name === "Mode 1") {
          collection.renameMode(collection.modes[0].modeId, modeName);
          console.log(`[Sync] Renamed default mode to: ${modeName}`);
        } else {
          collection.addMode(modeName);
          console.log(`[Sync] Added mode: ${modeName}`);
        }
      }
    }
    return collection;
  }
  async function findVariableByName(collection, name) {
    for (const varId of collection.variableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(varId);
        if (variable && variable.name === name) {
          return variable;
        }
      } catch (e) {
      }
    }
    return null;
  }
  function getModeValues(token, tokens, themes, collection) {
    const modeValues = /* @__PURE__ */ new Map();
    const baseValue = tokenValueToFigmaValue(token);
    if (baseValue === null) {
      return modeValues;
    }
    const layer = getTokenLayer(token);
    if (layer === "semantic") {
      for (const mode of collection.modes) {
        const modeName = mode.name.toLowerCase();
        let modeValue = baseValue;
        const matchingTheme = themes.find(
          (t) => t.name.toLowerCase().includes(modeName) || t.group && t.group.toLowerCase().includes(modeName)
        );
        if (matchingTheme) {
        }
        modeValues.set(mode.modeId, modeValue);
      }
    } else {
      for (const mode of collection.modes) {
        modeValues.set(mode.modeId, baseValue);
      }
    }
    return modeValues;
  }
  function valuesEqual(a, b) {
    if (typeof a === "number" && typeof b === "number") {
      return Math.abs(a - b) < 1e-4;
    }
    if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
      const aRGB = a;
      const bRGB = b;
      return Math.abs(aRGB.r - bRGB.r) < 1e-4 && Math.abs(aRGB.g - bRGB.g) < 1e-4 && Math.abs(aRGB.b - bRGB.b) < 1e-4;
    }
    return a === b;
  }
  async function analyzeSyncDiff(tokens, themes, options = {}) {
    var _a, _b, _c, _d;
    const diff = {
      toCreate: [],
      toUpdate: [],
      toDelete: [],
      unchanged: 0
    };
    const collectionNames = {
      core: ((_a = options.collectionNames) == null ? void 0 : _a.core) || "Core",
      semantic: ((_b = options.collectionNames) == null ? void 0 : _b.semantic) || "Semantic",
      component: ((_c = options.collectionNames) == null ? void 0 : _c.component) || "Component"
    };
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collectionsByName = /* @__PURE__ */ new Map();
    for (const col of collections) {
      collectionsByName.set(col.name, col);
    }
    const seenVariableIds = /* @__PURE__ */ new Set();
    for (const [tokenPath, token] of tokens.tokens) {
      const figmaValue = tokenValueToFigmaValue(token);
      if (figmaValue === null) {
        continue;
      }
      const layer = getTokenLayer(token);
      const collectionName = collectionNames[layer];
      const variableName = tokenPathToVariableName(tokenPath);
      const collection = collectionsByName.get(collectionName);
      if (!collection) {
        diff.toCreate.push({
          path: tokenPath,
          layer,
          value: token.resolvedValue
        });
        continue;
      }
      const existingVariable = await findVariableByName(collection, variableName);
      if (!existingVariable) {
        diff.toCreate.push({
          path: tokenPath,
          layer,
          value: token.resolvedValue
        });
        continue;
      }
      seenVariableIds.add(existingVariable.id);
      const modeId = collection.modes[0].modeId;
      const currentValue = existingVariable.valuesByMode[modeId];
      if (!valuesEqual(currentValue, figmaValue)) {
        diff.toUpdate.push({
          path: tokenPath,
          layer,
          oldValue: typeof currentValue === "object" ? JSON.stringify(currentValue) : currentValue,
          newValue: token.resolvedValue
        });
      } else {
        diff.unchanged++;
      }
    }
    if (options.deleteOrphans) {
      for (const [name, collection] of collectionsByName) {
        if (!Object.values(collectionNames).includes(name)) {
          continue;
        }
        const layer = (_d = Object.entries(collectionNames).find(([, v]) => v === name)) == null ? void 0 : _d[0];
        if (!layer) continue;
        for (const varId of collection.variableIds) {
          if (!seenVariableIds.has(varId)) {
            const variable = await figma.variables.getVariableByIdAsync(varId);
            if (variable) {
              diff.toDelete.push({
                path: variableNameToTokenPath(variable.name),
                layer,
                variableId: varId
              });
            }
          }
        }
      }
    }
    return diff;
  }
  async function syncTokensToVariables(tokens, themes, options = {}, onProgress) {
    var _a, _b, _c, _d, _e, _f;
    const opts = {
      createNew: (_a = options.createNew) != null ? _a : true,
      updateExisting: (_b = options.updateExisting) != null ? _b : true,
      deleteOrphans: (_c = options.deleteOrphans) != null ? _c : false,
      collectionNames: {
        core: ((_d = options.collectionNames) == null ? void 0 : _d.core) || "Core",
        semantic: ((_e = options.collectionNames) == null ? void 0 : _e.semantic) || "Semantic",
        component: ((_f = options.collectionNames) == null ? void 0 : _f.component) || "Component"
      }
    };
    const result = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [],
      collections: []
    };
    try {
      const modeNames = [];
      for (const theme of themes) {
        if (theme.name && !modeNames.includes(theme.name)) {
          modeNames.push(theme.name);
        }
      }
      if (modeNames.length === 0) {
        modeNames.push("Light", "Dark");
      }
      onProgress == null ? void 0 : onProgress({
        phase: "analyzing",
        current: 0,
        total: tokens.tokens.size,
        message: "Analyzing tokens..."
      });
      const tokensByLayer = /* @__PURE__ */ new Map();
      tokensByLayer.set("core", []);
      tokensByLayer.set("semantic", []);
      tokensByLayer.set("component", []);
      for (const token of tokens.tokens.values()) {
        const layer = getTokenLayer(token);
        tokensByLayer.get(layer).push(token);
      }
      const layers = ["core", "semantic", "component"];
      let totalProcessed = 0;
      const totalTokens = tokens.tokens.size;
      for (const layer of layers) {
        const layerTokens = tokensByLayer.get(layer) || [];
        if (layerTokens.length === 0) continue;
        const collectionName = opts.collectionNames[layer];
        const collection = await getOrCreateCollection(collectionName, modeNames);
        const collectionResult = {
          collectionId: collection.id,
          collectionName,
          layer,
          variablesCreated: 0,
          variablesUpdated: 0,
          variablesDeleted: 0
        };
        const existingVarNames = /* @__PURE__ */ new Set();
        for (const varId of collection.variableIds) {
          const variable = await figma.variables.getVariableByIdAsync(varId);
          if (variable) {
            existingVarNames.add(variable.name);
          }
        }
        for (const token of layerTokens) {
          totalProcessed++;
          const variableName = tokenPathToVariableName(token.path);
          const figmaValue = tokenValueToFigmaValue(token);
          if (figmaValue === null) {
            result.skipped++;
            continue;
          }
          const variableType = getVariableType(token);
          onProgress == null ? void 0 : onProgress({
            phase: existingVarNames.has(variableName) ? "updating" : "creating",
            current: totalProcessed,
            total: totalTokens,
            message: `Processing ${token.path}`
          });
          try {
            const existingVariable = await findVariableByName(collection, variableName);
            if (existingVariable) {
              if (opts.updateExisting) {
                const modeValues = getModeValues(token, tokens, themes, collection);
                for (const [modeId, value] of modeValues) {
                  existingVariable.setValueForMode(modeId, value);
                }
                collectionResult.variablesUpdated++;
                result.updated++;
              } else {
                result.skipped++;
              }
              existingVarNames.delete(variableName);
            } else if (opts.createNew) {
              const variable = figma.variables.createVariable(
                variableName,
                collection,
                variableType
              );
              if (token.description) {
                variable.description = token.description;
              }
              const modeValues = getModeValues(token, tokens, themes, collection);
              for (const [modeId, value] of modeValues) {
                variable.setValueForMode(modeId, value);
              }
              collectionResult.variablesCreated++;
              result.created++;
            }
          } catch (error) {
            const errorMsg = `Failed to sync ${token.path}: ${error instanceof Error ? error.message : "Unknown error"}`;
            result.errors.push(errorMsg);
            console.error("[Sync]", errorMsg);
          }
        }
        if (opts.deleteOrphans) {
          for (const orphanName of existingVarNames) {
            onProgress == null ? void 0 : onProgress({
              phase: "deleting",
              current: totalProcessed,
              total: totalTokens,
              message: `Removing orphaned: ${orphanName}`
            });
            try {
              const orphanVariable = await findVariableByName(collection, orphanName);
              if (orphanVariable) {
                orphanVariable.remove();
                collectionResult.variablesDeleted++;
                result.deleted++;
              }
            } catch (error) {
              result.errors.push(`Failed to delete ${orphanName}: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
          }
        }
        result.collections.push(collectionResult);
      }
      onProgress == null ? void 0 : onProgress({
        phase: "complete",
        current: totalTokens,
        total: totalTokens,
        message: `Sync complete: ${result.created} created, ${result.updated} updated`
      });
    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("[Sync] Fatal error:", error);
    }
    return result;
  }
  async function resetVariables(tokens, themes, onProgress) {
    return syncTokensToVariables(tokens, themes, {
      createNew: false,
      updateExisting: true,
      deleteOrphans: false
    }, onProgress);
  }
  async function getSyncStatus(tokens, collectionNames) {
    const names = {
      core: (collectionNames == null ? void 0 : collectionNames.core) || "Core",
      semantic: (collectionNames == null ? void 0 : collectionNames.semantic) || "Semantic",
      component: (collectionNames == null ? void 0 : collectionNames.component) || "Component"
    };
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    let totalVariables = 0;
    const collectionInfo = [];
    for (const [layer, name] of Object.entries(names)) {
      const collection = collections.find((c) => c.name === name);
      if (collection) {
        totalVariables += collection.variableIds.length;
        collectionInfo.push({
          name,
          layer,
          variableCount: collection.variableIds.length,
          modeCount: collection.modes.length
        });
      }
    }
    let syncableTokens = 0;
    for (const token of tokens.tokens.values()) {
      if (tokenValueToFigmaValue(token) !== null) {
        syncableTokens++;
      }
    }
    return {
      totalTokens: syncableTokens,
      totalVariables,
      collections: collectionInfo,
      syncedPercentage: syncableTokens > 0 ? Math.round(totalVariables / syncableTokens * 100) : 0
    };
  }

  // src/plugin/main.ts
  var tokenCollection = null;
  var loadedThemeConfigs = [];
  var currentConfig = getDefaultConfig();
  var isLoadingTokens = false;
  function postMessage(message) {
    figma.ui.postMessage(message);
  }
  figma.showUI(__html__, {
    width: 420,
    height: 600,
    themeColors: false
  });
  function processTokenFiles(files) {
    if (isLoadingTokens) return;
    isLoadingTokens = true;
    try {
      console.log("[Plugin] Processing token files from UI...");
      const parser = new TokenParser();
      tokenCollection = parser.parseTokenFiles(files);
      console.log(`[Plugin] Loaded ${tokenCollection.tokens.size} tokens from ${files.length} files`);
      console.log(`[Plugin] Color values in index: ${tokenCollection.colorValues.size}`);
      console.log(`[Plugin] Number values in index: ${tokenCollection.numberValues.size}`);
      if (tokenCollection.colorValues.size > 0) {
        const sampleColors = Array.from(tokenCollection.colorValues.entries()).slice(0, 10);
        console.log("[Plugin] Sample color tokens (semantic preferred):", sampleColors);
        let semanticCount = 0;
        let coreCount = 0;
        for (const tokenPath of tokenCollection.colorValues.values()) {
          if (tokenPath.startsWith("system.") || tokenPath.startsWith("component.")) {
            semanticCount++;
          } else {
            coreCount++;
          }
        }
        console.log(`[Plugin] Color token index: ${semanticCount} semantic, ${coreCount} core`);
      } else {
        console.warn("[Plugin] No color tokens found! Checking token types...");
        const colorTokens = tokenCollection.byType.get("color") || [];
        console.log(`[Plugin] Tokens with type "color": ${colorTokens.length}`);
        if (colorTokens.length > 0) {
          console.log("[Plugin] Sample color tokens by type:", colorTokens.slice(0, 3).map((t) => ({
            path: t.path,
            resolvedValue: t.resolvedValue,
            type: t.type
          })));
        }
      }
      postMessage({
        type: "TOKENS_LOADED",
        tokenCount: tokenCollection.tokens.size,
        tokenPaths: Array.from(tokenCollection.tokens.keys())
      });
    } catch (error) {
      console.error("[Plugin] Failed to process tokens:", error);
      postMessage({
        type: "ERROR",
        message: `Failed to process tokens: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    } finally {
      isLoadingTokens = false;
    }
  }
  function buildSummary(violations) {
    const byRule = {
      "no-hardcoded-colors": 0,
      "no-hardcoded-typography": 0,
      "no-hardcoded-spacing": 0,
      "no-hardcoded-radii": 0,
      "no-hardcoded-stroke-weight": 0,
      "no-hardcoded-sizing": 0,
      "no-orphaned-variables": 0,
      "no-unknown-styles": 0,
      "prefer-semantic-variables": 0
    };
    const bySeverity = {
      error: 0,
      warning: 0,
      info: 0
    };
    for (const violation of violations) {
      byRule[violation.ruleId]++;
      bySeverity[violation.severity]++;
    }
    return {
      total: violations.length,
      byRule,
      bySeverity
    };
  }
  async function handleStartScan(scope, config) {
    if (!tokenCollection) {
      postMessage({ type: "ERROR", message: "Tokens not loaded yet. Please wait..." });
      return;
    }
    const startTime = Date.now();
    try {
      clearTextStyleCache();
      currentConfig = config;
      const scanner = new FigmaScanner(config);
      const inspector = new PropertyInspector();
      const figmaVariables = await getLocalVariables();
      const matchedVariableIds = buildMatchedVariableIdSet(figmaVariables, tokenCollection);
      console.log(`Found ${matchedVariableIds.size} variables with matching tokens out of ${figmaVariables.size} total`);
      const rules = createRules(config, tokenCollection, figmaVariables, matchedVariableIds);
      const nodes = await scanner.gatherNodes(scope);
      postMessage({
        type: "SCAN_STARTED",
        totalNodes: nodes.length
      });
      const violations = [];
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const inspections = inspector.inspectNode(node);
        for (const rule of rules) {
          const ruleViolations = await rule.check(node, inspections);
          violations.push(...ruleViolations);
        }
        if (i % 50 === 0 || i === nodes.length - 1) {
          postMessage({
            type: "SCAN_PROGRESS",
            processed: i + 1,
            total: nodes.length
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      const results = {
        violations,
        summary: buildSummary(violations),
        metadata: {
          scannedNodes: nodes.length,
          scanDurationMs: Date.now() - startTime,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
      postMessage({ type: "SCAN_COMPLETE", results });
    } catch (error) {
      console.error("Scan failed:", error);
      postMessage({
        type: "ERROR",
        message: error instanceof Error ? error.message : "Unknown error during scan"
      });
    }
  }
  async function handleSelectNode(nodeId) {
    const success = await FigmaScanner.selectNode(nodeId);
    postMessage({ type: "NODE_SELECTED", success });
  }
  figma.ui.onmessage = async (msg) => {
    console.log("[Plugin] Received message:", msg.type, msg);
    switch (msg.type) {
      case "START_SCAN":
        await handleStartScan(msg.scope, msg.config);
        break;
      case "SELECT_NODE":
        await handleSelectNode(msg.nodeId);
        break;
      case "UPDATE_CONFIG":
        currentConfig = msg.config;
        break;
      case "GET_TOKENS":
        if (tokenCollection) {
          postMessage({
            type: "TOKENS_LOADED",
            tokenCount: tokenCollection.tokens.size,
            tokenPaths: Array.from(tokenCollection.tokens.keys())
          });
        } else {
          postMessage({
            type: "ERROR",
            message: "Tokens not loaded yet. Please wait for UI to load tokens."
          });
        }
        break;
      case "TOKEN_FILES_LOADED":
        processTokenFiles(msg.files);
        break;
      case "EXPORT_RESULTS":
        break;
      case "APPLY_FIX":
        {
          console.log("[Plugin] APPLY_FIX:", msg.nodeId, msg.property, msg.tokenPath, msg.ruleId);
          console.log("[Plugin] Theme configs available:", loadedThemeConfigs.length);
          try {
            let nodeName = "Unknown";
            const node = await figma.getNodeByIdAsync(msg.nodeId);
            if (node && "name" in node) {
              nodeName = node.name;
            }
            const result = await applyFix(
              msg.nodeId,
              msg.property,
              msg.tokenPath,
              msg.ruleId,
              loadedThemeConfigs,
              tokenCollection
            );
            console.log("[Plugin] APPLY_FIX result:", result);
            postMessage({
              type: "FIX_APPLIED",
              success: result.success,
              nodeId: msg.nodeId,
              property: msg.property,
              message: result.message || (result.success ? void 0 : "Fix failed"),
              nodeName,
              beforeValue: result.beforeValue,
              afterValue: result.afterValue,
              actionType: result.actionType
            });
          } catch (error) {
            console.error("[Plugin] APPLY_FIX error:", error);
            postMessage({
              type: "FIX_APPLIED",
              success: false,
              nodeId: msg.nodeId,
              property: msg.property,
              message: "Error: " + (error instanceof Error ? error.message : "Unknown error")
            });
          }
        }
        break;
      case "APPLY_BULK_FIX":
        {
          const bulkResult = await applyBulkFix(
            msg.fixes,
            loadedThemeConfigs,
            (progress) => {
              postMessage({
                type: "FIX_PROGRESS",
                current: progress.current,
                total: progress.total,
                currentAction: progress.currentAction
              });
            },
            tokenCollection
          );
          postMessage({
            type: "BULK_FIX_COMPLETE",
            successful: bulkResult.successful,
            failed: bulkResult.failed,
            errors: bulkResult.errors,
            actions: bulkResult.actions
          });
        }
        break;
      case "UNBIND_VARIABLE":
        {
          let nodeName = "Unknown";
          const unbindNode = await figma.getNodeByIdAsync(msg.nodeId);
          if (unbindNode && "name" in unbindNode) {
            nodeName = unbindNode.name;
          }
          const unbindResult = await unbindVariable(msg.nodeId, msg.property);
          postMessage({
            type: "FIX_APPLIED",
            success: unbindResult.success,
            nodeId: msg.nodeId,
            property: msg.property,
            message: unbindResult.message,
            nodeName,
            beforeValue: unbindResult.beforeValue,
            afterValue: unbindResult.afterValue,
            actionType: unbindResult.actionType
          });
        }
        break;
      case "DETACH_STYLE":
        {
          let detachNodeName = "Unknown";
          const detachNode = await figma.getNodeByIdAsync(msg.nodeId);
          if (detachNode && "name" in detachNode) {
            detachNodeName = detachNode.name;
          }
          const detachResult = await detachStyle(msg.nodeId, msg.property);
          postMessage({
            type: "FIX_APPLIED",
            success: detachResult.success,
            nodeId: msg.nodeId,
            property: msg.property,
            message: detachResult.message,
            nodeName: detachNodeName,
            beforeValue: detachResult.beforeValue,
            afterValue: detachResult.afterValue,
            actionType: detachResult.actionType
          });
        }
        break;
      case "BULK_DETACH_STYLES":
        {
          const bulkDetachResult = await bulkDetachStyles(msg.detaches);
          postMessage({
            type: "BULK_DETACH_COMPLETE",
            successful: bulkDetachResult.successful,
            failed: bulkDetachResult.failed,
            errors: bulkDetachResult.errors
          });
        }
        break;
      case "AUTO_FIX_PATH_MISMATCHES":
        {
          const pathMismatchFixes = msg.fixes.map((fix) => ({
            nodeId: fix.nodeId,
            property: fix.property,
            tokenPath: fix.tokenPath,
            ruleId: "no-orphaned-variables"
          }));
          const pathMismatchResult = await applyBulkFix(
            pathMismatchFixes,
            loadedThemeConfigs,
            (progress) => {
              postMessage({
                type: "FIX_PROGRESS",
                current: progress.current,
                total: progress.total,
                currentAction: progress.currentAction
              });
            },
            tokenCollection
          );
          postMessage({
            type: "BULK_FIX_COMPLETE",
            successful: pathMismatchResult.successful,
            failed: pathMismatchResult.failed,
            errors: pathMismatchResult.errors,
            actions: pathMismatchResult.actions
          });
        }
        break;
      case "APPLY_TEXT_STYLE":
        {
          console.log("[Plugin] APPLY_TEXT_STYLE:", msg.nodeId, msg.textStyleId, msg.property);
          const result = await applyTextStyle(msg.nodeId, msg.textStyleId);
          let nodeName = "Unknown";
          try {
            const node = await figma.getNodeByIdAsync(msg.nodeId);
            if (node && "name" in node) {
              nodeName = node.name;
            }
          } catch (e) {
          }
          postMessage({
            type: "FIX_APPLIED",
            success: result.success,
            nodeId: msg.nodeId,
            property: msg.property,
            message: result.message,
            nodeName,
            beforeValue: result.beforeValue,
            afterValue: result.afterValue,
            actionType: result.actionType
          });
        }
        break;
      case "SAVE_IGNORED_VIOLATIONS":
        {
          try {
            await figma.clientStorage.setAsync("ignoredViolations", msg.ignoredKeys);
            console.log("[Plugin] Saved", msg.ignoredKeys.length, "ignored violations to storage");
          } catch (error) {
            console.error("[Plugin] Failed to save ignored violations:", error);
          }
        }
        break;
      case "LOAD_IGNORED_VIOLATIONS":
        {
          try {
            const ignoredKeys = await figma.clientStorage.getAsync("ignoredViolations");
            postMessage({
              type: "IGNORED_VIOLATIONS_LOADED",
              ignoredKeys: ignoredKeys || []
            });
            console.log("[Plugin] Loaded", (ignoredKeys || []).length, "ignored violations from storage");
          } catch (error) {
            console.error("[Plugin] Failed to load ignored violations:", error);
            postMessage({
              type: "IGNORED_VIOLATIONS_LOADED",
              ignoredKeys: []
            });
          }
        }
        break;
      case "SAVE_TOKEN_SOURCE":
        {
          try {
            await figma.clientStorage.setAsync("tokenSource", msg.source);
            console.log("[Plugin] Saved token source preference:", msg.source);
          } catch (error) {
            console.error("[Plugin] Failed to save token source preference:", error);
          }
        }
        break;
      case "LOAD_TOKEN_SOURCE":
        {
          try {
            const source = await figma.clientStorage.getAsync("tokenSource");
            postMessage({
              type: "TOKEN_SOURCE_LOADED",
              source: source || "local"
            });
            console.log("[Plugin] Loaded token source preference:", source || "local");
          } catch (error) {
            console.error("[Plugin] Failed to load token source preference:", error);
            postMessage({
              type: "TOKEN_SOURCE_LOADED",
              source: "local"
            });
          }
        }
        break;
      case "GET_SYNC_STATUS":
        {
          if (!tokenCollection) {
            postMessage({ type: "ERROR", message: "Tokens not loaded yet" });
            break;
          }
          try {
            const status = await getSyncStatus(tokenCollection);
            postMessage(__spreadValues({
              type: "SYNC_STATUS"
            }, status));
          } catch (error) {
            console.error("[Plugin] Failed to get sync status:", error);
            postMessage({ type: "ERROR", message: "Failed to get sync status" });
          }
        }
        break;
      case "GET_SYNC_DIFF":
        {
          if (!tokenCollection) {
            postMessage({ type: "ERROR", message: "Tokens not loaded yet" });
            break;
          }
          try {
            const diff = await analyzeSyncDiff(tokenCollection, loadedThemeConfigs, msg.options);
            postMessage(__spreadValues({
              type: "SYNC_DIFF"
            }, diff));
          } catch (error) {
            console.error("[Plugin] Failed to analyze sync diff:", error);
            postMessage({ type: "ERROR", message: "Failed to analyze sync diff" });
          }
        }
        break;
      case "START_SYNC":
        {
          if (!tokenCollection) {
            postMessage({ type: "ERROR", message: "Tokens not loaded yet" });
            break;
          }
          try {
            console.log("[Plugin] Starting sync with options:", msg.options);
            const result = await syncTokensToVariables(
              tokenCollection,
              loadedThemeConfigs,
              msg.options,
              (progress) => {
                postMessage(__spreadValues({
                  type: "SYNC_PROGRESS"
                }, progress));
              }
            );
            postMessage(__spreadValues({
              type: "SYNC_COMPLETE"
            }, result));
          } catch (error) {
            console.error("[Plugin] Sync failed:", error);
            postMessage({
              type: "SYNC_COMPLETE",
              success: false,
              created: 0,
              updated: 0,
              deleted: 0,
              skipped: 0,
              errors: [error instanceof Error ? error.message : "Unknown error"],
              collections: []
            });
          }
        }
        break;
      case "RESET_VARIABLES":
        {
          if (!tokenCollection) {
            postMessage({ type: "ERROR", message: "Tokens not loaded yet" });
            break;
          }
          try {
            console.log("[Plugin] Resetting variables to match token source");
            const result = await resetVariables(
              tokenCollection,
              loadedThemeConfigs,
              (progress) => {
                postMessage(__spreadValues({
                  type: "SYNC_PROGRESS"
                }, progress));
              }
            );
            postMessage(__spreadValues({
              type: "SYNC_COMPLETE"
            }, result));
          } catch (error) {
            console.error("[Plugin] Reset failed:", error);
            postMessage({
              type: "SYNC_COMPLETE",
              success: false,
              created: 0,
              updated: 0,
              deleted: 0,
              skipped: 0,
              errors: [error instanceof Error ? error.message : "Unknown error"],
              collections: []
            });
          }
        }
        break;
    }
  };
  console.log("[Plugin] Ready. Waiting for UI to send token files...");
})();
