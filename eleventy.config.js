
module.exports = function() {
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
