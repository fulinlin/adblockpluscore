/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2017 eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

/* globals ElemHideEmulation, splitSelector,
   parseSelectorContent,
   parseSelector, positionInParent, makeSelector,
   PlainSelector, HasSelector, PropsSelector */

let myUrl = document.currentScript.src;

exports.tearDown = function(callback)
{
  let styleElements = document.head.getElementsByTagName("style");
  while (styleElements.length)
    styleElements[0].parentNode.removeChild(styleElements[0]);

  let child;
  while (child = document.body.firstChild)
    child.parentNode.removeChild(child);

  callback();
};

function unexpectedError(error)
{
  console.error(error);
  this.ok(false, "Unexpected error: " + error);
}

function expectHidden(test, element)
{
  test.equal(window.getComputedStyle(element).display, "none",
             "The element's display property should be set to 'none'");
}

function expectVisible(test, element)
{
  test.notEqual(window.getComputedStyle(element).display, "none",
                "The element's display property should not be set to 'none'");
}

function findUniqueId()
{
  let id = "elemHideEmulationTest-" + Math.floor(Math.random() * 10000);
  if (!document.getElementById(id))
    return id;
  return findUniqueId();
}

function insertStyleRule(rule)
{
  let styleElement;
  let styleElements = document.head.getElementsByTagName("style");
  if (styleElements.length)
    styleElement = styleElements[0];
  else
  {
    styleElement = document.createElement("style");
    document.head.appendChild(styleElement);
  }
  styleElement.sheet.insertRule(rule, styleElement.sheet.cssRules.length);
}

// insert a <div> with a unique id and a CSS rule
// for the the selector matching the id.
function createElementWithStyle(styleBlock, parent)
{
  let element = document.createElement("div");
  element.id = findUniqueId();
  if (!parent)
    document.body.appendChild(element);
  else
    parent.appendChild(element);
  insertStyleRule("#" + element.id + " " + styleBlock);
  return element;
}

// Will ensure the class ElemHideEmulation is loaded.
// NOTE: if it never loads, this will probably hang.
function loadElemHideEmulation()
{
  if (typeof ElemHideEmulation == "undefined")
  {
    return loadScript(myUrl + "/../../../lib/common.js").then(() =>
    {
      return loadScript(myUrl + "/../../../chrome/content/elemHideEmulation.js");
    }).then(() =>
    {
      return loadElemHideEmulation();
    });
  }

  return Promise.resolve();
}

// Create a new ElemHideEmulation instance with @selectors.
function applyElemHideEmulation(selectors)
{
  return loadElemHideEmulation().then(() =>
  {
    let elemHideEmulation = new ElemHideEmulation(
      window,
      callback =>
      {
        let patterns = [];
        selectors.forEach(selector =>
        {
          patterns.push({selector});
        });
        callback(patterns);
      },
      newSelectors =>
      {
        if (!newSelectors.length)
          return;
        let selector = newSelectors.join(", ");
        insertStyleRule(selector + "{display: none !important;}");
      },
      elems =>
      {
        for (let elem of elems)
          elem.style.display = "none";
      }
    );

    elemHideEmulation.apply();
    return Promise.resolve(elemHideEmulation);
  });
}

// internals testing

exports.testParseSelectorContent = function(test)
{
  loadElemHideEmulation().then(() =>
  {
    let parsed = parseSelectorContent(":-abp-has(> div) > div", 10);
    test.equal(parsed.text, "> div");
    test.equal(parsed.end, 15);

    parsed = parseSelectorContent("> div) > div", 0);
    test.equal(parsed.text, "> div");
    test.equal(parsed.end, 5);

    // parens not closed.
    parsed = parseSelectorContent("> div > div", 0);
    test.equal(parsed, null);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testParseSelector = function(test)
{
  loadElemHideEmulation().then(() =>
  {
    let selectors = parseSelector("");
    test.equal(selectors.length, 0);

    let selector = "div > :-abp-properties('background-color: rgb(0, 0, 0)')";
    selectors = parseSelector(selector);
    test.equal(selectors.length, 2);
    test.ok(selectors[0] instanceof PlainSelector);
    test.ok(selectors[1] instanceof PropsSelector);

    selector = "div > :-abp-has(> div.inside) > div";
    selectors = parseSelector(selector);
    test.equal(selectors.length, 3);
    test.ok(selectors[0] instanceof PlainSelector);
    test.ok(selectors[1] instanceof HasSelector);
    test.ok(selectors[2] instanceof PlainSelector);

    selector = "div > div:-abp-has(> div.inside) > div";
    selectors = parseSelector(selector);

    test.equal(selectors.length, 3);
    test.ok(selectors[0] instanceof PlainSelector);
    test.ok(selectors[1] instanceof HasSelector);
    test.ok(selectors[2] instanceof PlainSelector);

    selector = "div > :-abp-has(> div.inside) > :-abp-properties(background-color: rgb(0, 0, 0))";
    selectors = parseSelector(selector);

    test.equal(selectors.length, 4);
    test.ok(selectors[0] instanceof PlainSelector);
    test.ok(selectors[1] instanceof HasSelector);
    test.ok(selectors[2] instanceof PlainSelector);
    test.ok(selectors[3] instanceof PropsSelector);

    selector = "div > :-abp-has(> div.inside > :-abp-properties(background-color: rgb(0, 0, 0))";
    selectors = parseSelector(selector);
    test.equal(selectors, null);

    // -abp-has-unsupported() is unknown. Ensure we fail parsing.
    selector = 'div[arial-label="Story"]:-abp-has(> div > div > span > span:-abp-unsupported("Suggested Post"))';
    selectors = parseSelector(selector);
    test.equal(selectors, null);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

function buildDom(doc)
{
  doc.body.innerHTML = `<div id="parent">
    <div id="middle">
      <div id="middle1"><div id="inside" class="inside"></div></div>
    </div>
    <div id="sibling">
      <div id="tohide">to hide</div>
    </div>
    <div id="sibling2">
      <div id="sibling21"><div id="sibling211" class="inside"></div></div>
    </div>
  </div>`;
  let parent = document.getElementById("parent");
  let middle = document.getElementById("middle");
  let middle1 = document.getElementById("middle1");
  let inside = document.getElementById("inside");
  let sibling = document.getElementById("sibling");
  let sibling2 = document.getElementById("sibling2");
  let toHide = document.getElementById("tohide");
  return {parent, middle, middle1, inside, sibling, sibling2, toHide};
}

exports.testPositionInParent = function(test)
{
  let nodes = buildDom(document);

  loadElemHideEmulation().then(() =>
  {
    test.equal(positionInParent(nodes.middle1), 1);
    test.equal(positionInParent(nodes.inside), 1);
    test.equal(positionInParent(nodes.sibling2), 3);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testMakeSelector = function(test)
{
  let nodes = buildDom(document);

  loadElemHideEmulation().then(() =>
  {
    test.equal(makeSelector(nodes.middle, ""),
               ":root > BODY:nth-child(2) > DIV:nth-child(1) > DIV:nth-child(1)");
    test.equal(makeSelector(nodes.toHide, ""),
               ":root > BODY:nth-child(2) > DIV:nth-child(1) > DIV:nth-child(2) > DIV:nth-child(1)");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPlainSelector = function(test)
{
  buildDom(document);

  loadElemHideEmulation().then(() =>
  {
    let selector = new PlainSelector("div > div");

    let iter = selector.getSelectors("foo > ");
    let value = iter.next();
    test.equal(value.value[0], "foo > div > div");
    test.ok(iter.next().done);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testHasSelector = function(test)
{
  buildDom(document);

  loadElemHideEmulation().then(() =>
  {
    let selector = new HasSelector("> div.inside");

    let iter = selector.getSelectors("", document, document.sheet);
    let value = iter.next();
    test.ok(!value.done);
    test.equal(value.value[0],
               ":root > BODY:nth-child(2) > DIV:nth-child(1) > DIV:nth-child(1) > DIV:nth-child(1)");

    iter = selector.getElements("", document, document.sheet);
    value = iter.next();
    test.ok(!value.done);
    test.equal(value.value.id, "middle1");
    value = iter.next();
    test.ok(!value.done);
    test.equal(value.value.id, "sibling21");
    value = iter.next();
    test.ok(value.done);

    selector = new HasSelector(":-abp-has(> div.inside)");

    test.ok(selector._innerSelectors);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testSplitStyleRule = function(test)
{
  loadElemHideEmulation().then(() =>
  {
    let selectors = splitSelector("div:-abp-has(div) > [-abp-properties='background-color: rgb(0, 0, 0)'] > span");
    test.ok(selectors);
    test.equal(selectors.length, 1, "There is only one selector");

    selectors = splitSelector("div:-abp-has(div), [-abp-properties='background-color: rgb(0, 0, 0)']");
    test.ok(selectors);
    test.equal(selectors.length, 2, "There are two selectors");
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

// API testing

exports.testVerbatimPropertySelector = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithPrefix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithPrefixNoMatch = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #fff}", parent);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertySelectorWithSuffix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let toHide = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0)) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testVerbatimPropertyPseudoSelectorWithPrefixAndSuffix = function(test)
{
  let parent = createElementWithStyle("{background-color: #000}");
  let middle = createElementWithStyle("{background-color: #000}", parent);
  let toHide = createElementWithStyle("{background-color: #000}", middle);
  applyElemHideEmulation(
    ["div > :-abp-properties(background-color: rgb(0, 0, 0)) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithWildcard = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(*color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithRegularExpression = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/.*color: rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\x7B 0,6\\x7D : rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPropertySelectorWithImproperlyEscapedBrace = function(test)
{
  let toHide = createElementWithStyle("{background-color: #000}");
  applyElemHideEmulation(
    [":-abp-properties(/background.\\x7B0,6\\x7D: rgb\\(0, 0, 0\\)/)"]
  ).then(() =>
  {
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testDynamicallyChangedProperty = function(test)
{
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    [":-abp-properties(background-color: rgb(0, 0, 0))"]
  ).then(() =>
  {
    expectVisible(test, toHide);
    insertStyleRule("#" + toHide.id + " {background-color: #000}");
    return new Promise((resolve, reject) =>
    {
      window.setTimeout(() =>
      {
        expectHidden(test, toHide);
        resolve();
      }, 0);
    });
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelector = function(test)
{
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    ["div:-abp-has(div)"]
  ).then(() =>
  {
    expectVisible(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithPrefix = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(div)"]
  ).then(() =>
  {
    expectHidden(test, parent);
    expectVisible(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffix = function(test)
{
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let child = createElementWithStyle("{}", middle);
  applyElemHideEmulation(
    ["div:-abp-has(div) > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectHidden(test, middle);
    expectHidden(test, child);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffixSibling = function(test)
{
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let toHide = createElementWithStyle("{}");
  applyElemHideEmulation(
    ["div:-abp-has(div) + div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

exports.testPseudoClassHasSelectorWithSuffixSiblingChild = function(test)
{
  //  <div>
  //    <div></div>
  //    <div>
  //      <div>to hide</div>
  //    </div>
  //  </div>
  let parent = createElementWithStyle("{}");
  let middle = createElementWithStyle("{}", parent);
  let sibling = createElementWithStyle("{}");
  let toHide = createElementWithStyle("{}", sibling);
  applyElemHideEmulation(
    ["div:-abp-has(div) + div > div"]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectVisible(test, sibling);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};

function runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(test, selector)
{
  document.body.innerHTML = `<div id="parent">
      <div id="middle">
        <div id="middle1"><div id="inside" class="inside"></div></div>
      </div>
      <div id="sibling">
        <div id="tohide">to hide</div>
      </div>
      <div id="sibling2">
        <div id="sibling21"><div id="sibling211" class="inside"></div></div>
      </div>
    </div>`;
  let parent = document.getElementById("parent");
  let middle = document.getElementById("middle");
  let inside = document.getElementById("inside");
  let sibling = document.getElementById("sibling");
  let sibling2 = document.getElementById("sibling2");
  let toHide = document.getElementById("tohide");

  insertStyleRule(".inside {}");

  applyElemHideEmulation(
    [selector]
  ).then(() =>
  {
    expectVisible(test, parent);
    expectVisible(test, middle);
    expectVisible(test, inside);
    expectVisible(test, sibling);
    expectVisible(test, sibling2);
    expectHidden(test, toHide);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
}

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling = function(test)
{
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(test, "div:-abp-has(:-abp-has(div.inside)) + div > div");
};

exports.testPseudoClassHasSelectorWithHasAndWithSuffixSibling2 = function(test)
{
  runTestPseudoClassHasSelectorWithHasAndWithSuffixSibling(test, "div:-abp-has(:-abp-has(> div.inside)) + div > div");
};

exports.testPseudoClassHasSelectorWithPropSelector = function(test)
{
  let parent = createElementWithStyle("{}");
  let child = createElementWithStyle("{background-color: #000}", parent);
  applyElemHideEmulation(
    ["div:-abp-has(:-abp-properties(background-color: rgb(0, 0, 0)))"]
  ).then(() =>
  {
    expectVisible(test, child);
    expectHidden(test, parent);
  }).catch(unexpectedError.bind(test)).then(() => test.done());
};
