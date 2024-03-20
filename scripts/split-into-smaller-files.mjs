import { basename, dirname, extname, join } from "node:path";
import { stringify } from "yaml";
import slug from "slug";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { EXIT, visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";

const HAST_PARSER = unified().use(rehypeParse, { fragment: true });

const HAST_STRINGIFIER = unified().use(rehypeStringify);

const MDAST_PARSER = unified().use(remarkParse);

const MDAST_STRINGIFIER = unified().use(remarkStringify);

// Parse the content as a markdown file
const tree = MDAST_PARSER.parse(
  await readFile("_import/index.md", { encoding: "utf-8" })
);

// Parse HTML nodes with rehype so we can more easily manipulate them
parseHTMLNodes(tree);

const IMPORT_FOLDER = "content/doc-import";

for (const content of gatherHeadingContents(tree.children)) {
  const { heading, children } = content;

  const headingValue = toString(heading);

  const directory = headingValue ? slug(headingValue) : "";

  const fileName = headingValue ? `${directory}/index.md` : "index.md";

  // Create a new tree combining the heading and the content nodes
  const contentTree = {
    type: "root",
    children: [heading, ...children].filter(Boolean),
  };

  // Now each of these nodes may contain images, which Google exported plainly in an `images` folder
  // We can bring them 'closer' to file they relate to and improve their naming a little
  const imagesInDirectory = {};
  const results = await Promise.allSettled(
    getImagesInHTMLNodes(contentTree)
      // Compute new image names synchronously so the order is consistent
      // and not impacted by any slowness of the file system when copying
      .map((hastNode) => {
        const imageSource = hastNode.properties.src;
        const extension = extname(imageSource);

        // Compute in which directory the file will now be based on the headings that precede it
        const headings = headingsPreceding(contentTree, (node) =>
          node.value?.includes(imageSource)
        )
          // Ignore skipped levels if they happen
          .filter(Boolean)
          // Skip first heading as the images will be stored in the same folder as the `.md` file that loads them
          .splice(1);

        const headingSlugs = headings.map((heading) => slug(toString(heading)));
        const imageDirectory = headingSlugs.length
          ? join("images", ...headingSlugs)
          : "images";

        // Compute its name based on its position in the document
        if (!(imageDirectory in imagesInDirectory)) {
          imagesInDirectory[imageDirectory] = 0;
        }
        imagesInDirectory[imageDirectory]++;

        const baseName = imagesInDirectory[imageDirectory];
        const fileName = `image-${baseName}${extension}`;

        const sourcePath = join("_import", imageSource);
        // The path of the image relative from the content file
        // For referencing in the content
        const imagePath = join(imageDirectory, fileName);
        // The page of the image relative to the current working directory
        // for moving the image
        const destPath = directory
          ? join(IMPORT_FOLDER, directory, imagePath)
          : join(IMPORT_FOLDER, imagePath);

        hastNode.properties.src = imagePath;

        return {
          sourcePath,
          destPath,
        };
      })
      // Copy asynchronously for speed
      .map(async ({ sourcePath, destPath }) => {
        // Create any necessary folder
        await mkdir(dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);
      })
  );
  const errors = results.filter((result) => result.status == "rejected");
  if (errors.length) {
    throw new Error("Couldn't copy all images", { cause: results });
  }

  stringifyHTMLNodes(contentTree);

  const pageMarkdown = MDAST_STRINGIFIER.stringify(contentTree);

  const fileContent = `${pageMarkdown}`;
  const filePath = join(IMPORT_FOLDER, fileName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, fileContent);
}

function getImagesInHTMLNodes(tree) {
  const sources = [];
  visit(tree, { tagName: "img" }, (hastNode) => {
    sources.push(hastNode);
  });
  return sources;
}

function parseHTMLNodes(tree) {
  visit(tree, "html", (node) => {
    node.children = HAST_PARSER.parse(node.value).children;
  });
}

function stringifyHTMLNodes(tree) {
  visit(tree, "html", (node) => {
    if (node.children) {
      node.value = node.children
        .map((child) => HAST_STRINGIFIER.stringify(child))
        .join("");
      delete node.children;
    }
  });
}

function headingsPreceding(tree, condition) {
  const headings = [];
  visit(tree, (currentNode) => {
    if (currentNode.type == "heading") {
      // Replace node at same depth as the heading we just found
      headings[currentNode.depth - 1] = currentNode;
      // And clear any further headings
      headings.splice(currentNode.depth);
    } else if (condition(currentNode)) {
      return EXIT;
    }
  });

  return headings;
}

/**
 * Generator function to use in a `for...of` loop to iterate
 * over the `children` of an AST node, regrouping them under
 * the preceeding heading of the given `headingLevel`.
 *
 * @param {Array} children
 * @param {Number} [headingLevel=1]
 * @yields {{heading: Object, children: Array}}
 */
function* gatherHeadingContents(children, headingLevel = 1) {
  const result = {
    heading: null,
    children: [],
  };
  for (const child of children) {
    if (child.type == "heading" && child.depth == headingLevel) {
      // Skip empty headings
      if (!child.children?.length) continue;
      // Output our current content
      yield { ...result };
      // And get ready to store stuff
      result.heading = child;
      result.children = [];
    } else {
      result.children.push(child);
    }
  }

  yield { ...result };
}
