# Aerial Sources Downloader

This script...

- gets the URL of the sources
- downloads the source
- untars the source
- converts the binary string files into JSON
- packs the source and the strings into a [HSSP Archive](https://github.com/HSSPfile/docs/#README)

## Usage

1. Clone the repo
2. Run `npm i` to install the dependencies
3. Run `node . <VERSION>` (replace the \<VERSION\> with an integer above 9, this is the tvOS version).
4. Do whatever you want with the newly created _resources-\<VERSION\>.hssp_ file in the out folder.

## License

This project is [licensed under the MIT License](./LICENSE).
