# Google Doc to 11ty

MVP repository for an 11ty site built from a Google Docs export

## Prerequisites

* Node JS (20.x)

## Usage

This repository is made of two parts:
- a series of scripts to convert the export from Google Docs into a hierarchy of Markdown and image files inside the `content` folder.
- an [11ty] setup that'll transform the Markdown files into a static site (in the `_site` folder).

[11ty]: https://11ty.dev

`content` is committed to the repository, so you can run the 11ty site straight away after cloning the repository and installing its dependencies. Guidance on how to import a newer version of the Google Doc follows right after.

### Installing dependencies

Before anything, you'll need to install the project's dependencies with:

```sh
npm ci
```

### Running 11ty

Once the dependencies are installed, you can use the following command to run the project locally:

```sh
npm start
```

This will make 11ty start a server, build the files into HTML and watch for changes to rebuild after you edit.

It should be shown in the console, but you should be able to access the local site at <http://localhost:8080>.

#### Some technical details

A couple of pointers that may help you make sense of what's going around:

- the 11ty configuration is at `eleventy.config.js`

### Updating the content

Importing the content is a three step process:

1. Download the Google Docs as Web Page and unzip it in `_import`
2. Convert the HTML document into Markdown
3. Split the Markdown file into smaller files based on the document's heading

#### Downloading the Google Docs as an HTML archive

On Google Docs, download the document as a Web Page (`File` > `Download` > `Web page (.html, zipped)`). As hinted by the menu in the app, you will obtain a Zip file containing:
- an HTML file
- an `images` folder

Delete any existing copy of these files in the `_import` folder before copying the ones you just obtained. Your `_import` folder will look like so:

```
_import
├── <DOC_NAME>.html
└── images
    ├── image1.png
    ├── image2.png
    └── ...
```

#### Converting the document to Markdown

The `scripts/import-google-doc.mjs` file contains a configuration for [rehype] that will clean the markup from the Google Doc export a little and turn it into Markdown.

[rehype]: https://github.com/rehypejs/rehype

You can run the conversion with:

```sh
npm run docs-to-markdown
```

This should create a new `_import/index.md` file in your `_import` folder which should now look like so:

```
_import
├── <DOCS_NAME>.html
├── images
│   ├── image1.png
│   ├── image2.png
│   └── ...
└── index.md // Have a peek, it should be the tidy markdown from your doc
```

#### Importing the markdown file into the content

The `scripts/split-into-smaller-files.mjs` script will use [remark] to process the Mardkown and split it into one file per H1 it discovers. It'll also move any image displayed in one of these new files into the folder holding that file, for easier association when looking at the content (also saves rewriting some links 😆).

[remark]: https://github.com/remarkjs/remark

You can run it with:

```sh
npm run split-by-heading
```

After which, your `content` folder should reflect the content of the document you imported.
