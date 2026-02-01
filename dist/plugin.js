"use strict";
(() => {
  var __defProp = Object.defineProperty;
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

  // src/shared/types.ts
  function getDefaultConfig() {
    return {
      rules: {
        "no-hardcoded-colors": { enabled: true, severity: "error" },
        "no-hardcoded-typography": { enabled: true, severity: "warning" },
        "no-hardcoded-spacing": { enabled: true, severity: "warning" },
        "no-hardcoded-radii": { enabled: true, severity: "warning" },
        "no-orphaned-variables": { enabled: true, severity: "error" },
        "no-unknown-styles": { enabled: true, severity: "warning" }
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
     * Get all inspections for a node based on its type
     */
    inspectNode(node) {
      const inspections = [];
      inspections.push(...this.inspectPaints(node));
      inspections.push(...this.inspectRadius(node));
      if (node.type === "TEXT") {
        inspections.push(...this.inspectTypography(node));
      }
      if (node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE") {
        inspections.push(...this.inspectSpacing(node));
      }
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
  var CLOSE_DELTA_E = 10;
  var MAX_DELTA_E = 50;
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
        const matches = this.findClosestColorTokens(hexColor);
        console.log(`[NoHardcodedColors] Checking ${hexColor} - found ${matches.length} matches, colorValues size: ${this.tokens.colorValues.size}`);
        if (matches.length > 0) {
          console.log(`[NoHardcodedColors] Best match: ${matches[0].tokenPath} (deltaE: ${matches[0].deltaE})`);
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
        if (suggestedToken) {
          if (suggestionConfidence === "exact") {
            message = "Hardcoded color " + hexColor + " - exact match available: " + suggestedToken;
          } else {
            const bestMatch = matches[0];
            message = "Hardcoded color " + hexColor + " - closest token: " + suggestedToken + " (" + getDeltaEDescription(bestMatch.deltaE) + ")";
          }
        } else {
          message = "Hardcoded color " + hexColor + " - should use a design token";
        }
        violations.push(
          this.createViolationWithSuggestions(
            node,
            inspection.property,
            hexColor,
            message,
            suggestedToken,
            suggestionConfidence,
            alternativeTokens
          )
        );
      }
      return violations;
    }
    /**
     * Find closest matching color tokens using Delta E
     */
    findClosestColorTokens(hex) {
      const hexWithoutAlpha = hex.length === 9 ? hex.slice(0, 7) : hex;
      return findClosestColors(
        hexWithoutAlpha,
        this.tokens.colorValues,
        this.tokens.colorLab,
        MAX_ALTERNATIVES + 1,
        MAX_DELTA_E
      );
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
  var MAX_TOLERANCE_PERCENT = 1;
  var MAX_TOLERANCE_ABSOLUTE = 20;
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
      const aIsSemantic = isSemanticTokenPath(a.tokenPath);
      const bIsSemantic = isSemanticTokenPath(b.tokenPath);
      if (aIsSemantic && !bIsSemantic) return -1;
      if (!aIsSemantic && bIsSemantic) return 1;
      if (preferredKeywords.length > 0) {
        const aHasKeyword = hasPreferredKeyword(a.tokenPath, preferredKeywords);
        const bHasKeyword = hasPreferredKeyword(b.tokenPath, preferredKeywords);
        if (aHasKeyword && !bHasKeyword) return -1;
        if (!aHasKeyword && bHasKeyword) return 1;
      }
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
  function pathContains(fullPath, part) {
    return normalizePath(fullPath).includes(normalizePath(part));
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
  var MAX_COLOR_DELTA_E = 50;
  var MAX_ALTERNATIVES5 = 3;
  var NUMBER_TOLERANCE_PERCENT = 1;
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
          const suggestion = await this.findReplacementFromCurrentValue(
            node,
            inspection.property,
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
          violations.push(violation);
        } else if (this.matchedVariableIds.size > 0 && !this.matchedVariableIds.has(inspection.boundVariableId)) {
          const matchedTokenPath = getTokenPathForVariable(variableInfo, this.tokens);
          if (matchedTokenPath) {
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
            inspection.property
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
     * Find a replacement token based on the node's current visual value
     * Used when the bound variable ID no longer exists in the document
     */
    async findReplacementFromCurrentValue(node, property, rawValue) {
      try {
        if (property.includes("fills") || property.includes("strokes")) {
          if (rawValue && typeof rawValue === "object" && "r" in rawValue) {
            const colorValue = rawValue;
            return this.findColorReplacement(colorValue);
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
          const nodeWithProps = node;
          const value = nodeWithProps[property];
          if (typeof value === "number") {
            return this.findNumberReplacement(value, property);
          }
        }
        return {};
      } catch (error) {
        console.error("[OrphanedVariables] Error finding replacement from current value:", error);
        return {};
      }
    }
    /**
     * Find a replacement token based on the variable's resolved value
     */
    async findReplacementToken(variableId, variableInfo, property) {
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
        const value = variable.valuesByMode[defaultModeId];
        if (value === void 0) {
          return {};
        }
        if (variableInfo.resolvedType === "COLOR") {
          return this.findColorReplacement(value);
        } else if (variableInfo.resolvedType === "FLOAT") {
          return this.findNumberReplacement(value, property);
        }
        return {};
      } catch (error) {
        console.error("[OrphanedVariables] Error finding replacement:", error);
        return {};
      }
    }
    /**
     * Find a replacement color token
     */
    findColorReplacement(value) {
      if (typeof value !== "object" || value === null) {
        return {};
      }
      const colorValue = value;
      if (typeof colorValue.r !== "number") {
        return {};
      }
      const hexColor = rgbToHex(colorValue);
      const hexWithoutAlpha = hexColor.length === 9 ? hexColor.slice(0, 7) : hexColor;
      const matches = findClosestColors(
        hexWithoutAlpha,
        this.tokens.colorValues,
        this.tokens.colorLab,
        MAX_ALTERNATIVES5 + 1,
        MAX_COLOR_DELTA_E
      );
      if (matches.length === 0) {
        return {};
      }
      const bestMatch = matches[0];
      let confidence;
      if (bestMatch.isExact) {
        confidence = "exact";
      } else if (bestMatch.deltaE < 2) {
        confidence = "close";
      } else {
        confidence = "approximate";
      }
      const alternatives = matches.length > 1 ? matches.slice(1, MAX_ALTERNATIVES5 + 1).map((m) => ({
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
        const alternatives2 = tokenPaths.filter((p) => p !== exactMatch).slice(0, MAX_ALTERNATIVES5).map((path) => {
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
      const alternatives = tokenPaths.slice(1, MAX_ALTERNATIVES5 + 1).map((path) => {
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
      const maxAbsoluteTolerance = 20;
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
  var MAX_ALTERNATIVES6 = 3;
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
          MAX_ALTERNATIVES6 + 1,
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
        const alternatives = matches.length > 1 ? matches.slice(1, MAX_ALTERNATIVES6 + 1).map((m) => ({
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
    return rules;
  }

  // src/plugin/fixer.ts
  async function findVariableForToken(tokenPath, _themeConfigs) {
    console.log("[Fixer] Looking for variable for token:", tokenPath);
    const variables = await figma.variables.getLocalVariablesAsync();
    console.log("[Fixer] Searching " + variables.length + " local variables by name");
    if (variables.length === 0) {
      console.log("[Fixer] No local variables found in document");
      return null;
    }
    const normalizedTokenPath = normalizePath(tokenPath);
    console.log("[Fixer] Normalized token path:", normalizedTokenPath);
    const tokenPathSegments = normalizedTokenPath.split("/");
    const lastSegment = tokenPathSegments[tokenPathSegments.length - 1];
    for (const variable of variables) {
      const normalizedVarName = normalizePath(variable.name);
      const varNameSegments = normalizedVarName.split("/");
      const varLastSegment = varNameSegments[varNameSegments.length - 1];
      if (normalizedVarName === normalizedTokenPath) {
        console.log("[Fixer] Found exact name match:", variable.name);
        return variable;
      }
      if (pathEndsWith(tokenPath, variable.name)) {
        console.log("[Fixer] Found partial match (token ends with var):", variable.name);
        return variable;
      }
      if (pathEndsWith(variable.name, tokenPath)) {
        console.log("[Fixer] Found partial match (var ends with token):", variable.name);
        return variable;
      }
      if (lastSegment === varLastSegment) {
        console.log("[Fixer] Found last segment match:", variable.name);
        return variable;
      }
      if (pathContains(variable.name, tokenPath)) {
        console.log("[Fixer] Found contains match:", variable.name);
        return variable;
      }
    }
    console.log("[Fixer] Sample variable names:", variables.slice(0, 5).map((v) => v.name));
    console.log("[Fixer] No matching variable found for:", tokenPath);
    return null;
  }
  function colorToString(paint) {
    const r = Math.round(paint.color.r * 255);
    const g = Math.round(paint.color.g * 255);
    const b = Math.round(paint.color.b * 255);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  async function applyColorFix(node, property, variable) {
    var _a, _b;
    const fillMatch = property.match(/^fills\[(\d+)\]$/);
    const strokeMatch = property.match(/^strokes\[(\d+)\]$/);
    if (fillMatch && "fills" in node) {
      const index = parseInt(fillMatch[1], 10);
      const fills = node.fills;
      if (Array.isArray(fills) && fills[index]) {
        try {
          const paint = fills[index];
          const beforeValue = ((_a = paint.boundVariables) == null ? void 0 : _a.color) ? `var(${paint.boundVariables.color.id})` : paint.type === "SOLID" ? colorToString(paint) : "gradient/image";
          const newFills = [...fills];
          const paintWithVariable = figma.variables.setBoundVariableForPaint(
            newFills[index],
            "color",
            variable
          );
          newFills[index] = paintWithVariable;
          node.fills = newFills;
          return {
            success: true,
            beforeValue,
            afterValue: variable.name,
            actionType: "rebind"
          };
        } catch (error) {
          return {
            success: false,
            message: "Failed to apply fill variable: " + (error instanceof Error ? error.message : "Unknown error")
          };
        }
      }
    }
    if (strokeMatch && "strokes" in node) {
      const index = parseInt(strokeMatch[1], 10);
      const strokes = node.strokes;
      if (Array.isArray(strokes) && strokes[index]) {
        try {
          const paint = strokes[index];
          const beforeValue = ((_b = paint.boundVariables) == null ? void 0 : _b.color) ? `var(${paint.boundVariables.color.id})` : paint.type === "SOLID" ? colorToString(paint) : "gradient/image";
          const newStrokes = [...strokes];
          const paintWithVariable = figma.variables.setBoundVariableForPaint(
            newStrokes[index],
            "color",
            variable
          );
          newStrokes[index] = paintWithVariable;
          node.strokes = newStrokes;
          return {
            success: true,
            beforeValue,
            afterValue: variable.name,
            actionType: "rebind"
          };
        } catch (error) {
          return {
            success: false,
            message: "Failed to apply stroke variable: " + (error instanceof Error ? error.message : "Unknown error")
          };
        }
      }
    }
    return { success: false, message: "Could not find property to fix: " + property };
  }
  function getNumberPropertyValue(node, property) {
    const nodeWithProps = node;
    const boundVars = node.boundVariables;
    if (boundVars && boundVars[property]) {
      return `var(${boundVars[property].id})`;
    }
    const value = nodeWithProps[property];
    if (typeof value === "number") {
      return String(value);
    }
    return "unknown";
  }
  async function applyNumberFix(node, property, variable) {
    try {
      if (!("boundVariables" in node)) {
        return { success: false, message: "Node does not support variable bindings" };
      }
      const propertyMap = {
        // Spacing
        itemSpacing: "itemSpacing",
        counterAxisSpacing: "counterAxisSpacing",
        paddingTop: "paddingTop",
        paddingRight: "paddingRight",
        paddingBottom: "paddingBottom",
        paddingLeft: "paddingLeft",
        // Radius
        cornerRadius: "topLeftRadius",
        // Figma uses individual corners
        topLeftRadius: "topLeftRadius",
        topRightRadius: "topRightRadius",
        bottomLeftRadius: "bottomLeftRadius",
        bottomRightRadius: "bottomRightRadius"
      };
      const bindableField = propertyMap[property];
      if (!bindableField) {
        return { success: false, message: "Property is not bindable: " + property };
      }
      const beforeValue = getNumberPropertyValue(node, property);
      if (property === "cornerRadius" && "cornerRadius" in node) {
        const cornerNode = node;
        if (typeof cornerNode.cornerRadius === "number") {
          cornerNode.setBoundVariable("topLeftRadius", variable);
          cornerNode.setBoundVariable("topRightRadius", variable);
          cornerNode.setBoundVariable("bottomLeftRadius", variable);
          cornerNode.setBoundVariable("bottomRightRadius", variable);
          return {
            success: true,
            beforeValue,
            afterValue: variable.name,
            actionType: "rebind"
          };
        }
      }
      node.setBoundVariable(bindableField, variable);
      return {
        success: true,
        beforeValue,
        afterValue: variable.name,
        actionType: "rebind"
      };
    } catch (error) {
      return {
        success: false,
        message: "Failed to apply variable: " + (error instanceof Error ? error.message : "Unknown error")
      };
    }
  }
  async function applyTypographyFix(node, property, variable) {
    if (node.type !== "TEXT") {
      return { success: false, message: "Node is not a text node" };
    }
    const textNode = node;
    try {
      switch (property) {
        case "paragraphSpacing": {
          const beforeValue = getNumberPropertyValue(textNode, "paragraphSpacing");
          textNode.setBoundVariable("paragraphSpacing", variable);
          return {
            success: true,
            beforeValue,
            afterValue: variable.name,
            actionType: "rebind"
          };
        }
        case "fontSize":
        case "lineHeight":
        case "letterSpacing":
          return {
            success: false,
            message: property + ' cannot be bound to variables. Use "Apply Style" with an existing text style instead.'
          };
        default:
          return { success: false, message: "Unknown typography property: " + property };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: "Failed to apply typography fix: " + errorMsg
      };
    }
  }
  async function applyFix(nodeId, property, tokenPath, ruleId, themeConfigs) {
    console.log("[Fixer] applyFix called:", { nodeId, property, tokenPath, ruleId });
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
        console.log("[Fixer] Node not found:", nodeId);
        return { success: false, message: "Node not found: " + nodeId };
      }
      console.log("[Fixer] Found node:", node.name, node.type);
      const variable = await findVariableForToken(tokenPath, themeConfigs);
      if (!variable) {
        const msg = "No Figma variable found for token: " + tokenPath + ". You may need to sync variables from Tokens Studio first.";
        console.log("[Fixer]", msg);
        return { success: false, message: msg };
      }
      console.log("[Fixer] Found variable:", variable.name, "type:", variable.resolvedType);
      let result;
      switch (ruleId) {
        case "no-hardcoded-colors":
          result = await applyColorFix(node, property, variable);
          break;
        case "no-hardcoded-spacing":
        case "no-hardcoded-radii":
          result = await applyNumberFix(node, property, variable);
          break;
        case "no-hardcoded-typography":
          result = await applyTypographyFix(node, property, variable);
          break;
        case "no-orphaned-variables":
          if (variable.resolvedType === "COLOR") {
            result = await applyColorFix(node, property, variable);
          } else if (variable.resolvedType === "FLOAT") {
            if (property.includes("Radius") || property === "cornerRadius") {
              result = await applyNumberFix(node, property, variable);
            } else if (property.includes("padding") || property.includes("Spacing") || property === "itemSpacing" || property === "counterAxisSpacing") {
              result = await applyNumberFix(node, property, variable);
            } else if (property === "fontSize" || property === "lineHeight" || property === "letterSpacing" || property === "paragraphSpacing") {
              result = await applyTypographyFix(node, property, variable);
            } else {
              result = await applyNumberFix(node, property, variable);
            }
          } else {
            result = { success: false, message: "Cannot rebind variable of type: " + variable.resolvedType };
          }
          break;
        default:
          result = { success: false, message: "Auto-fix not supported for rule: " + ruleId };
      }
      console.log("[Fixer] Fix result:", result);
      return result;
    } catch (error) {
      const msg = "Fix error: " + (error instanceof Error ? error.message : "Unknown error");
      console.error("[Fixer]", msg, error);
      return { success: false, message: msg };
    }
  }
  async function applyBulkFix(fixes, themeConfigs, onProgress) {
    let successful = 0;
    let failed = 0;
    const errors = [];
    const actions = [];
    const total = fixes.length;
    for (let i = 0; i < fixes.length; i++) {
      const fix = fixes[i];
      let nodeName = "Unknown";
      try {
        const node = await figma.getNodeByIdAsync(fix.nodeId);
        if (node && "name" in node) {
          nodeName = node.name;
        }
      } catch (e) {
      }
      const result = await applyFix(
        fix.nodeId,
        fix.property,
        fix.tokenPath,
        fix.ruleId,
        themeConfigs
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
        if (result.message) {
          errors.push(fix.nodeId + ": " + result.message);
        }
      }
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentAction: action
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { successful, failed, errors, actions };
  }
  function getBoundVariableFromPaint(paint) {
    var _a;
    if ((_a = paint.boundVariables) == null ? void 0 : _a.color) {
      return paint.boundVariables.color.id;
    }
    return null;
  }
  async function unbindVariable(nodeId, property) {
    var _a;
    console.log("[Fixer] unbindVariable called:", { nodeId, property });
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
          const newFills = [...fills];
          const paint = newFills[index];
          const boundVarId = getBoundVariableFromPaint(paint);
          const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);
          if (paint.type === "SOLID") {
            newFills[index] = {
              type: "SOLID",
              color: paint.color,
              opacity: paint.opacity,
              visible: paint.visible,
              blendMode: paint.blendMode
            };
            sceneNode.fills = newFills;
            return {
              success: true,
              beforeValue,
              afterValue: colorToString(paint),
              actionType: "unbind"
            };
          }
        }
      }
      if (strokeMatch && "strokes" in sceneNode) {
        const index = parseInt(strokeMatch[1], 10);
        const strokes = sceneNode.strokes;
        if (Array.isArray(strokes) && strokes[index]) {
          const newStrokes = [...strokes];
          const paint = newStrokes[index];
          const boundVarId = getBoundVariableFromPaint(paint);
          const beforeValue = boundVarId ? `var(${boundVarId})` : colorToString(paint);
          if (paint.type === "SOLID") {
            newStrokes[index] = {
              type: "SOLID",
              color: paint.color,
              opacity: paint.opacity,
              visible: paint.visible,
              blendMode: paint.blendMode
            };
            sceneNode.strokes = newStrokes;
            return {
              success: true,
              beforeValue,
              afterValue: colorToString(paint),
              actionType: "unbind"
            };
          }
        }
      }
      if (sceneNode.type === "TEXT" && property === "paragraphSpacing") {
        const textNode = sceneNode;
        const beforeValue = getNumberPropertyValue(textNode, "paragraphSpacing");
        const currentValue = String(textNode.paragraphSpacing);
        textNode.setBoundVariable("paragraphSpacing", null);
        return {
          success: true,
          beforeValue,
          afterValue: currentValue,
          actionType: "unbind"
        };
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
          cornerRadius: "topLeftRadius"
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
          return {
            success: true,
            beforeValue,
            afterValue: currentValue,
            actionType: "unbind"
          };
        }
      }
      return { success: false, message: "Cannot unbind property: " + property };
    } catch (error) {
      const msg = "Unbind error: " + (error instanceof Error ? error.message : "Unknown error");
      console.error("[Fixer]", msg, error);
      return { success: false, message: msg };
    }
  }
  async function detachStyle(nodeId, property) {
    console.log("[Fixer] detachStyle called:", { nodeId, property });
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
            return {
              success: true,
              message: "Fill style detached",
              beforeValue,
              afterValue: "detached",
              actionType: "detach"
            };
          }
          break;
        case "strokeStyle":
          if ("strokeStyleId" in sceneNode) {
            const nodeWithStyle = sceneNode;
            const beforeValue = nodeWithStyle.strokeStyleId || "none";
            nodeWithStyle.strokeStyleId = "";
            return {
              success: true,
              message: "Stroke style detached",
              beforeValue,
              afterValue: "detached",
              actionType: "detach"
            };
          }
          break;
        case "textStyle":
          if (sceneNode.type === "TEXT") {
            const textNode = sceneNode;
            const rawStyleId = textNode.textStyleId;
            const beforeValue = typeof rawStyleId === "symbol" ? "mixed" : rawStyleId || "none";
            await textNode.setTextStyleIdAsync("");
            return {
              success: true,
              message: "Text style detached",
              beforeValue,
              afterValue: "detached",
              actionType: "detach"
            };
          }
          break;
        case "effectStyle":
          if ("effectStyleId" in sceneNode) {
            const nodeWithStyle = sceneNode;
            const beforeValue = nodeWithStyle.effectStyleId || "none";
            nodeWithStyle.effectStyleId = "";
            return {
              success: true,
              message: "Effect style detached",
              beforeValue,
              afterValue: "detached",
              actionType: "detach"
            };
          }
          break;
        default:
          return { success: false, message: "Unknown style property: " + property };
      }
      return { success: false, message: "Node does not support style: " + property };
    } catch (error) {
      const msg = "Detach style error: " + (error instanceof Error ? error.message : "Unknown error");
      console.error("[Fixer]", msg, error);
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
        if (result.message) {
          errors.push(detach.nodeId + ": " + result.message);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return { successful, failed, errors };
  }
  async function applyTextStyle(nodeId, textStyleId) {
    console.log("[Fixer] applyTextStyle called:", { nodeId, textStyleId });
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
      return {
        success: true,
        beforeValue,
        afterValue: style.name,
        actionType: "apply-style"
      };
    } catch (error) {
      const msg = "Apply text style error: " + (error instanceof Error ? error.message : "Unknown error");
      console.error("[Fixer]", msg, error);
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
      "no-orphaned-variables": 0,
      "no-unknown-styles": 0
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
              loadedThemeConfigs
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
            }
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
            }
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
