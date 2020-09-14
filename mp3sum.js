#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const util = require("util");
const stream = require("stream");
const streamFinished = util.promisify(stream.finished);

const invalidHash = "".padEnd(32, "0");

const rawListOutputFilePath = __dirname + "/mp3sum-list.txt";
const rawListOutputFile = fs.createWriteStream(rawListOutputFilePath, {flags : "w"});
const duplicateListOutputFilePath = __dirname + "/mp3sum-duplicates.txt";
const duplicateListOutputFile = fs.createWriteStream(duplicateListOutputFilePath, {flags : "w"});
const outputStdout = process.stdout;

const outputRawList = function(d) {
  rawListOutputFile.write(util.format(d) + "\n");
  outputStdout.write(util.format(d) + "\n");
};
const outputDuplicateList = function(d) {
  duplicateListOutputFile.write(util.format(d) + "\n");
  outputStdout.write(util.format(d) + "\n");
};

async function closeStream(stream) {
	stream.end();
	await streamFinished(stream);
}

function getAudioBuffer(fileBuffer) {
	let startIndex = 0;
	let endIndex = fileBuffer.length;

	const id3v1StartIndex = fileBuffer.length - 128;
	const id3v2StartIndex = 0;
	const id3v1 = fileBuffer.toString("utf8", id3v1StartIndex, id3v1StartIndex + 3);
	const id3v2 = fileBuffer.toString("utf8", id3v2StartIndex, id3v2StartIndex + 3);

	if (id3v1 === "TAG") {
		// console.log("remove id3v1 tag");
		endIndex = id3v1StartIndex;

		const id3v1EnhancedStartIndex = id3v1StartIndex - 227;
		const id3v1Enhanced = fileBuffer.toString("utf8", id3v1EnhancedStartIndex, id3v1EnhancedStartIndex + 4);

		if (id3v1Enhanced === "TAG+") {
			// console.log("remove id3v1 enhanced tag");
			endIndex = id3v1EnhancedStartIndex;
		}
	}

	if (id3v2 === "ID3") {
		// console.log("remove id3v2 tag");
		const tagSize = (fileBuffer[6] << 21) + (fileBuffer[7] << 14) + (fileBuffer[8] << 7) + fileBuffer[9];
		const hasFooter = (fileBuffer[5] & 0x10) !== 0;
		startIndex = hasFooter ? tagSize + 20 : tagSize + 10;
	}

	return fileBuffer.subarray(startIndex, endIndex);
}

async function processFile(filePath) {
	try {
		const fileBuffer = fs.readFileSync(filePath);
		const audioBuffer = getAudioBuffer(fileBuffer);
		const hash = crypto.createHash("md5").update(audioBuffer).digest("hex");
		outputRawList(hash + " " + filePath);
	} catch (e) {
		outputRawList(invalidHash + " " + filePath);
	}
}

async function processAllMp3s(dirPath, callback, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = await processAllMp3s(dirPath + "/" + file, callback, arrayOfFiles);
    } else if (file.endsWith(".mp3")) {
			const filePath = path.join(dirPath, "/", file);
			await callback(filePath);
      arrayOfFiles.push(filePath);
    }
	}

  return arrayOfFiles;
}

async function report() {
	const args = process.argv.slice(2);
	const startPath = args[0];

	await processAllMp3s(startPath, processFile);
	await closeStream(rawListOutputFile);

	const file = fs.readFileSync(rawListOutputFilePath);
	const files = file.toString().split("\n").sort();

	const duplicates = files.reduce(function(accumulator, line) {
		if (line.trim().length === 0) {
			return accumulator;
		}

		const hash = line.substr(0, 32);
		const filePath = line.substring(33);
		accumulator[hash] = accumulator[hash] || [];
    accumulator[hash].push(filePath);
    return accumulator;
	}, {});

	console.log("\nDUPLICATES:\n");

	for (let key of Object.keys(duplicates)) {
		const paths = duplicates[key];

		if (paths.length === 1 && key !== invalidHash) {
			continue;
		}

		outputDuplicateList("=== " + key + " ===");

		for (let path of paths) {
			outputDuplicateList(path);
		}

		outputDuplicateList("");
	}

	await closeStream(duplicateListOutputFile);
}

report();

