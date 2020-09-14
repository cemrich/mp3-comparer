# MP3 comparer

Compares mp3 files while ignoring any id3 tags. Use on a directory to find duplicates.

## Usage

`node mp3sum.js "/path/to/my/directory"`

This will scan the given directory recursively for mp3 files. A list of all files with hashes will be saved to `mp3sum-list.txt` inside the current working diretory. Then duplicates will be saved to `mp3sum-duplicates.txt`. File list and results will also be printed to the console.

## TODO
- [ ] report zero bytes files
- [ ] report unreadable files
