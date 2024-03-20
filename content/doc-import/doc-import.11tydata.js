module.exports = {
  eleventyComputed: {
    permalink({page}) {
      return `${page.filePathStem.replace('/doc-import','')}.${page.outputFileExtension}`
    }
  }
}
