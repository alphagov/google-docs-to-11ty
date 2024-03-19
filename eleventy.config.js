
module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("content", {
    filter: "**/*.{jpg,jpeg,png,svg}",
    rename(filePath) {
      return filePath.replace('doc-import/','');
    }
  });


  return {
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    dir: {
      input: 'content',
      data: '../_data',
      includes: '../_includes',
      layouts: '../_layouts'
    }
  }
};
