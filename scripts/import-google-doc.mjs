import {toHtml} from 'hast-util-to-html';
import {matches, select, selectAll} from 'hast-util-select';
import {visit} from 'unist-util-visit';
import {remove} from 'unist-util-remove';
import {toText} from 'hast-util-to-text';
import slug from 'slug';

export default {
  plugins: [
    // Unwrap the images within the tables from an unnecessary span
    () => (tree) => {
      visit(tree, {tagName: 'span'}, (element, index, parent) => {
        if (matches(':has(> img)', element)) {
          parent.children.splice(index, 1, ...element.children)
        }
      })
    },
    // Unwrap `mailto` links to avoid the email addresses of people tagged in the document
    // appearing in the output
    () => (tree) => {
      visit(tree, {tagName: 'a'}, (element, index, parent) => {
        if (element.properties.href?.startsWith('mailto:')) {
          parent.children.splice(index, 1, ...element.children)
        }
      })
    },
    // Remove comments links
    () => (tree) => {
      let reachedFirstComment = false;
      remove(tree, (node) => {
        // We want to remove links in the content sending to the comments content
        const isLinkToComment = node.tagName == 'a' && (node.properties.href?.startsWith('#cmnt'))

        // But we also want to remove the comments themselves. Those are packed
        // at the end of the doc, each starting with a link back to a reference `cmnt_ref`
        // inside the content to send the user back. Once we reach the first comment,
        // we know any further node can be deleted.
        if (node.tagName == 'a' && node.properties.href?.startsWith('#cmnt_ref')) {
          reachedFirstComment = true;
        }
        return reachedFirstComment || isLinkToComment
      })
    },
    // Bit of a blunt tidy up of empty links and content tags
    // We don't want to cascade so we don't remove `<td>` tags that may be wrapping empty table cells
    () => (tree) => {
      remove(tree, {cascade: false}, (node) => {
        const text = toText(node)
        return !text && ['a', 'h1','h2', 'h3', 'h4','h5','h6','p','span'].includes(node.tagName) && !select('img', node)
      })
    },
    // Clean up URLs sent to https://www.google.com/url 🤢
    () => (tree) => {
      visit(tree, {tagName: 'a'}, (element) => {
        if (element.properties.href) {
          element.properties.href = element.properties.href
            .replace('https://www.google.com/url?q=', '')
            .replace(/&.*$/,'')
        }
      })
    },
    // Update heading IDs to use the slug of their text and update any `a` pointing to them
    // Doing this after removing the comments, otherwise their text would be polluted by the content
    // of the comment links that Google inserts as [<LETTER>].
    () => (tree) => {
      const replacements = {}
      const slugIndices = {}
      visit(tree, (element, index,parent) => {
        if (['h1','h2','h3','h4','h5','h6'].includes(element.tagName)) {
          const currentId = element.properties.id;
          const slugFromText = slug(toText(element));
          // Multiple headings in the document may end up with the same slug
          // So we'll keep the IDs unique
          let updatedId;
          if (slugFromText in slugIndices) {
            updatedId = `${slugFromText}-${slugIndices[slugFromText]}`
            slugIndices[slugFromText]++
          } else {
            // 
            slugIndices[slugFromText] = 0
            updatedId = slugFromText
          }
          
          element.properties.id = updatedId;
          // Store the replacement for processing the links
          replacements[`#${currentId}`] = updatedId;
          
          }
      })
      visit(tree, {tagName: 'a'}, (element) => {
        if (replacements[element.properties?.href]) {
          element.properties.href = `#${replacements[element.properties?.href]}`
        }
      })
    },
    // Probably a bit blunt here, but ensure we clean up most of the extra cruft
    // from Google, especially `class` and `style` attributes
    ['rehype-sanitize', {
      attributes: {
        '*': ['href','src', 'id','alt']
      },
      strip: ['style','script']
    }],
    // Convert the HTML into markdown, but keep the table as HTML
    ['rehype-remark', {
      handlers: {
        table(state, node) {
          /** @type {Html} */
          const result = {type: 'html', value: toHtml(node)}
          state.patch(node, result)
          return result
        }
      }
    }],
    // Convert to string
    'remark-stringify'
  ]
}
