#!/usr/bin/env node

import inquirer from "inquirer";
import archiver from "archiver";
import fuzzy from "fuzzy";
import CheckboxPlusPrompt from "inquirer-checkbox-plus-prompt";
import chalk from "chalk";
import fs from "fs";
import { exit } from "process";

const globalIgnoredFilesAndDirs = [".git"];
let recursiveFlag = false;
let allowFlag = false;

const help = function () {
  const helpText = `tzip

tzip is an interactive command line application for creating compressed archives

Usage: tzip [options]

Options
  -h, --help      Diplays this help message
  -r:             Display individual files in nested subdirectories (default off)
  -a:             Allow files in all directories, included hidden directories and those in .gitignore if one exists (default off)
  `;

  console.log(helpText);
};

const getNestedFiles = function (allFiles = [], currentSubDirectory = "") {
  let dirPath =
    process.cwd() + (currentSubDirectory ? "/" : "") + currentSubDirectory;
  let files = fs.readdirSync(dirPath);

  for (let i = 0; i < files.length; ++i) {
    let statSync = fs.lstatSync(currentSubDirectory + files[i]);
    if (statSync.isFile()) {
      if (!allowFlag) {
        if (globalIgnoredFilesAndDirs.some((entry) => entry.test(files[i]))) {
          continue;
        }
      }
      allFiles.push(currentSubDirectory + files[i]);
    } else if (statSync.isDirectory()) {
      if (!allowFlag) {
        if (globalIgnoredFilesAndDirs.includes(files[i])) {
          continue;
        }
      }
      allFiles = getNestedFiles(allFiles, currentSubDirectory + files[i] + "/");
    }
  }

  return allFiles;
};

const main = function () {
  let files;
  let dirPath = process.cwd();

  if (!allowFlag) {
    if (fs.existsSync(".gitignore")) {
      globalIgnoredFilesAndDirs.push(
        ...fs.readFileSync(".gitignore", "utf-8").split("\n")
      );
    }
  }

  if (recursiveFlag) {
    files = getNestedFiles();
  } else {
    files = fs.readdirSync(dirPath);
    if (!allowFlag) {
      files = files.filter((file) => !globalIgnoredFilesAndDirs.includes(file));
    }
  }

  const zipFormats = ["zip", "tar"];

  inquirer.registerPrompt("checkbox-plus", CheckboxPlusPrompt);

  inquirer
    .prompt([
      {
        type: "input",
        name: "zipName",
        message: "Enter name of zip file:",
      },
      {
        type: "list",
        name: "zipFormat",
        message: "Select compression file type",
        choices: zipFormats,
      },
      {
        type: "confirm",
        name: "fileOverwriteConfirm",
        message: `That file already exists, do you want to overwrite it?`,
        when(answers) {
          return fs.existsSync(`${answers.zipName}.${answers.zipFormat}`);
        },
      },
      {
        type: "checkbox-plus",
        name: "filesToZip",
        message:
          "Select all files to be added to zip folder. Select " +
          chalk.bold(chalk.cyan("<Space>")) +
          " to add file and " +
          chalk.bold(chalk.cyan("type")) +
          " to search for files",
        pageSize: 10,
        highlight: true,
        searchable: true,
        source: function (answersSoFar, input) {
          input = input || "";

          return new Promise(function (resolve) {
            var fuzzyResult = fuzzy.filter(input, files);

            var data = fuzzyResult.map(function (element) {
              return element.original;
            });

            resolve(data);
          });
        },
        when(answers) {
          return (
            answers.fileOverwriteConfirm === undefined ||
            answers.fileOverwriteConfirm
          );
        },
      },
    ])
    .then((answers) => {
      if (
        answers.fileOverwriteConfirm === undefined ||
        answers.fileOverwriteConfirm
      ) {
        createZip(answers.zipName, answers.filesToZip, answers.zipFormat);
      }
    });

  function createZip(zipName, items, zipFormat) {
    console.log(zipFormat);
    // The following few lines of code is boilerplate archiver code

    // create a file to stream archive data to.
    const output = fs.createWriteStream(`${dirPath}/${zipName}.${zipFormat}`);
    const archive = archiver(zipFormat, {
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
      } else if (statSync.isDirectory()) {
        archive.directory(`${item}/`, item);
      }
    });

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    // 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
    archive.finalize();
  }
};

const args = process.argv;

for (let i = 2; i < process.argv.length; ++i) {
  if (process.argv[i].includes("-")) {
    for (let j = 0; j < process.argv[i].length; ++j) {
      if (process.argv[i].charAt(j) === "h") {
        help();
        exit();
      } else if (process.argv[i].charAt(j) === "r") {
        recursiveFlag = true;
      } else if (process.argv[i].charAt(j) === "a") {
        allowFlag = true;
      }
    }
  }
}

main();
