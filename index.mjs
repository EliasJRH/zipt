#!/usr/bin/env node

import inquirer from "inquirer";
import archiver from "archiver";
import fuzzy from "fuzzy";
import CheckboxPlusPrompt from "inquirer-checkbox-plus-prompt";
import chalk from "chalk";
import fs from "fs";

let dirPath = process.cwd();
let choices = fs.readdirSync(dirPath);

inquirer.registerPrompt("checkbox-plus", CheckboxPlusPrompt);

inquirer
  .prompt([
    {
      type: "input",
      name: "zipName",
      message: "Enter name of zip file:",
    },
    {
      type: "checkbox-plus",
      name: "filesToZip",
      message: "Select all files to be added to zip folder. Select " + chalk.bold(chalk.cyan("<Space>")) + " to add file and " + chalk.bold(chalk.cyan("type")) + " to search for files",
      pageSize: 10,
      highlight: true,
      searchable: true,
      source: function (answersSoFar, input) {
        input = input || "";

        return new Promise(function (resolve) {
          var fuzzyResult = fuzzy.filter(input, choices);

          var data = fuzzyResult.map(function (element) {
            return element.original;
          });

          resolve(data);
        });
      },
    },
  ])
  .then((answers) => {
    createZip(answers.zipName, answers.filesToZip);
  });

function createZip(zipName, items) {
  // The following few lines of code is boilerplate archiver code

  // create a file to stream archive data to.
  const output = fs.createWriteStream(`${dirPath}/${zipName}.zip`);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Sets the compression level.
  });

  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on("close", function () {
    console.log(archive.pointer() + " total bytes");
    console.log(
      "archiver has been finalized and the output file descriptor has closed."
    );
  });

  // This event is fired when the data source is drained no matter what was the data source.
  // It is not part of this library but rather from the NodeJS Stream API.
  // @see: https://nodejs.org/api/stream.html#stream_event_end
  output.on("end", function () {
    console.log("Data has been drained");
  });

  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on("warning", function (err) {
    if (err.code === "ENOENT") {
      // log warning
    } else {
      // throw error
      throw err;
    }
  });

  // good practice to catch this error explicitly
  archive.on("error", function (err) {
    throw err;
  });

  // pipe archive data to the file
  archive.pipe(output);

  items.forEach((item) => {
    let statSync = fs.lstatSync(item);
    if (statSync.isFile()) {
      archive.file(item, { name: item });
    }else if (statSync.isDirectory()){
      archive.directory(`${item}/`, item);
    }
  });  

  // finalize the archive (ie we are done appending files but streams have to finish yet)
  // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
  archive.finalize();
}
