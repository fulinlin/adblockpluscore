/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-2016 Eyeo GmbH
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

let fs = require("fs");
let path = require("path");
let process = require("process");
let nodeunit = require("nodeunit");
let qunit = require("node-qunit-phantomjs");

let nodeunitFiles = [];
let qunitFiles = [];
function addTestPaths(testPaths, recurse)
{
  for (let testPath of testPaths)
  {
    let stat = fs.statSync(testPath);
    if (stat.isDirectory())
    {
      if (recurse)
      {
        addTestPaths(fs.readdirSync(testPath).map(
          file => path.join(testPath, file)));
      }
      continue;
    }
    if (path.basename(testPath).startsWith("_"))
      continue;
    if (testPath.split(path.sep).includes("browser"))
    {
      if (path.extname(testPath) == ".html")
        qunitFiles.push(testPath);
    }
    else if (path.extname(testPath) == ".js")
      nodeunitFiles.push(testPath);
  }
}
if (process.argv.length > 2)
{
  addTestPaths(process.argv.slice(2), true);
}
else
{
  addTestPaths(
    [path.join(__dirname, "test"), path.join(__dirname, "test", "browser")],
    true
  );
}

if (nodeunitFiles.length)
  nodeunit.reporters.default.run(nodeunitFiles);
for (let file of qunitFiles)
  qunit(file);
