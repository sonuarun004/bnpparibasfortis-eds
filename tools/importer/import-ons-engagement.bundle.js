/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
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
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-ons-engagement.js
  var import_ons_engagement_exports = {};
  __export(import_ons_engagement_exports, {
    default: () => import_ons_engagement_default
  });

  // tools/importer/parsers/columns-feature.js
  function parse(element, { document }) {
    const image = element.querySelector(".rich-text-img img, img");
    const heading = element.querySelector(".rich-text-title, h2, h1, h3");
    const paragraphs = Array.from(
      element.querySelectorAll(".rich-text-content-inner > p, .rich-text-content-inner p")
    ).filter((p) => p.textContent.trim() !== "" || p.querySelector("img, a"));
    if (!image && !heading && paragraphs.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const imageCell = image ? [image] : "";
    const textCell = [];
    if (heading) textCell.push(heading);
    textCell.push(...paragraphs);
    const wrapper = element.querySelector(".rich-text-wrapper");
    const imageOnRight = wrapper && wrapper.classList.contains("right");
    const cells = [];
    cells.push(imageOnRight ? [textCell, imageCell] : [imageCell, textCell]);
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-feature", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-partner.js
  function parse2(element, { document }) {
    const image = element.querySelector("img");
    const heading = element.querySelector(".multi-pp-title, h3, h2, h4");
    const paragraphs = Array.from(element.querySelectorAll("p")).filter(
      (p) => p.textContent.trim() !== "" || p.querySelector("img, a")
    );
    if (!image && !heading && paragraphs.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    let imageCell = "";
    if (image) {
      const imgFrag = document.createDocumentFragment();
      imgFrag.appendChild(document.createComment(" field:image "));
      imgFrag.appendChild(image);
      imageCell = imgFrag;
    }
    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(document.createComment(" field:text "));
    if (heading) textFrag.appendChild(heading);
    paragraphs.forEach((p) => textFrag.appendChild(p));
    const cells = [[imageCell, textFrag]];
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-partner", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/accordion-faq.js
  function parse3(element, { document }) {
    const summaryEl = element.querySelector(
      ".accordion-title, .accordion-header button, .accordion-header"
    );
    const summaryText = summaryEl ? summaryEl.textContent.trim() : "";
    const body = element.querySelector(".collapse, .accordion-body");
    const bodyNodes = body ? Array.from(body.childNodes).filter(
      (n) => n.nodeType !== 3 || n.textContent.trim() !== ""
    ) : [];
    if (!summaryText && bodyNodes.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const summaryFrag = document.createDocumentFragment();
    summaryFrag.appendChild(document.createComment(" field:summary "));
    if (summaryText) summaryFrag.appendChild(document.createTextNode(summaryText));
    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(document.createComment(" field:text "));
    if (bodyNodes.length) {
      bodyNodes.forEach((n) => textFrag.appendChild(n));
    } else if (body) {
      textFrag.appendChild(body);
    }
    const cells = [[summaryFrag, textFrag]];
    const block = WebImporter.Blocks.createBlock(document, { name: "accordion-faq", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/bnpparibasfortis-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        ".ccb",
        "#cookies_entry",
        ".cookies_overlay",
        ".cookies_overlay_shade",
        ".wcm-overlay",
        ".wcm-co-browse"
      ]);
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        "header",
        "footer",
        "#sectionkh3l66xk",
        "#sectionkh3l66y7",
        "#sectionl9xup273",
        "#sectionlapiaan1",
        "#sectionm2j6nrpo"
      ]);
    }
  }

  // tools/importer/import-ons-engagement.js
  var parsers = {
    "columns-feature": parse,
    "cards-partner": parse2,
    "accordion-faq": parse3
  };
  var transformers = [
    transform
  ];
  var PAGE_TEMPLATE = {
    name: "ons-engagement",
    description: "Sponsoring / engagement page: intro, alternating image/text feature rows, a partnership card grid, and an FAQ accordion.",
    urls: [
      "https://www.bnpparibasfortis.be/nl/public/over-ons/wie-zijn-we/ons-engagement/sponsoring"
    ],
    blocks: [
      {
        name: "columns-feature",
        instances: [".rich-text-section"]
      },
      {
        name: "cards-partner",
        instances: [".multi-pp-block"]
      },
      {
        name: "accordion-faq",
        instances: [".accordion-item"]
      }
    ],
    sections: [
      {
        id: "rc3",
        name: "main-content",
        selector: ["#sectionkh3l66y3", ".iw_columns.adb_maincontent"],
        style: null,
        blocks: ["columns-feature", "cards-partner", "accordion-faq"],
        defaultContent: [".block-title", "h2.rich-text-title", ".accordion-wrapper h2"]
      }
    ]
  };
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), {
      template: PAGE_TEMPLATE
    });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document, template) {
    const pageBlocks = [];
    template.blocks.forEach((blockDef) => {
      blockDef.instances.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
          console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
        }
        elements.forEach((element) => {
          pageBlocks.push({
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null
          });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_ons_engagement_default = {
    transform: (payload) => {
      const { document, url, params } = payload;
      const main = document.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        if (!block.element.parentNode) return;
        const parser = parsers[block.name];
        if (parser) {
          try {
            parser(block.element, { document, url, params });
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document);
      WebImporter.rules.transformBackgroundImages(main, document);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const rawPath = new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html?$/, "");
      const path = WebImporter.FileUtils.sanitizePath(rawPath === "" ? "/index" : rawPath);
      return [{
        element: main,
        path,
        report: {
          title: document.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_ons_engagement_exports);
})();
