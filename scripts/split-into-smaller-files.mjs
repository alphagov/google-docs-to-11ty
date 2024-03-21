import { basename, dirname, extname, join } from 'node:path'
import { stringify } from 'yaml'
import slug from 'slug'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import rehypeParse from 'rehype-parse'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'

import { processImages } from './process-images.mjs'

const HAST_PARSER = unified().use(rehypeParse, { fragment: true })

const HAST_STRINGIFIER = unified().use(rehypeStringify)

const MDAST_PARSER = unified().use(remarkParse)

const MDAST_STRINGIFIER = unified().use(remarkStringify)

// Parse the content as a markdown file
const tree = MDAST_PARSER.parse(
  await readFile('_import/index.md', { encoding: 'utf-8' })
)

// Parse HTML nodes with rehype so we can more easily manipulate them
parseHTMLNodes(tree)

const IMPORT_FOLDER = 'content/doc-import'

for (const content of gatherHeadingContents(tree.children)) {
  const { heading, children } = content

  const headingValue = toString(heading)

  const directory = headingValue ? slug(headingValue) : ''

  const fileName = headingValue ? `${directory}/index.md` : 'index.md'

  // Create a new tree combining the heading and the content nodes
  const contentTree = {
    type: 'root',
    children: [heading, ...children].filter(Boolean)
  }

  await processImages(contentTree)

  stringifyHTMLNodes(contentTree)

  const pageMarkdown = MDAST_STRINGIFIER.stringify(contentTree)

  const fileContent = `${pageMarkdown}`
  const filePath = join(IMPORT_FOLDER, fileName)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, fileContent)
}

function parseHTMLNodes (tree) {
  visit(tree, 'html', (node) => {
    node.children = HAST_PARSER.parse(node.value).children
  })
}

function stringifyHTMLNodes (tree) {
  visit(tree, 'html', (node) => {
    if (node.children) {
      node.value = node.children
        .map((child) => HAST_STRINGIFIER.stringify(child))
        .join('')
      delete node.children
    }
  })
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
function * gatherHeadingContents (children, headingLevel = 1) {
  const result = {
    heading: null,
    children: []
  }
  for (const child of children) {
    if (child.type == 'heading' && child.depth == headingLevel) {
      // Skip empty headings
      if (!child.children?.length) continue
      // Output our current content
      yield { ...result }
      // And get ready to store stuff
      result.heading = child
      result.children = []
    } else {
      result.children.push(child)
    }
  }

  yield { ...result }
}
