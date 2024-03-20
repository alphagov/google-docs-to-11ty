import { dirname, extname, join } from "node:path";
import { EXIT, visit } from "unist-util-visit";
import slug from "slug";
import { copyFile, mkdir } from "node:fs/promises";
import { toString } from "mdast-util-to-string";

const IMPORT_FOLDER = "content/doc-import";

const imagesInDirectory = {};

export async function processImages(tree) {
  const results = await Promise.allSettled(
    getImagesInHTMLNodes(tree)
      .map((hastNode) => processImageNode(hastNode, tree))
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
}

function processImageNode(hastNode, tree) {
  const imageSource = hastNode.properties.src;
  const extension = extname(imageSource);

  // Compute in which directory the file will now be based on the headings that precede it
  const headings = headingsPreceding(tree, (node) =>
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
  const destPath = join(IMPORT_FOLDER, imageDirectory, fileName);

  hastNode.properties.src = imagePath;

  return {
    sourcePath,
    destPath,
  };
}

function getImagesInHTMLNodes(tree) {
  const sources = [];
  visit(tree, { tagName: "img" }, (hastNode) => {
    sources.push(hastNode);
  });
  return sources;
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
