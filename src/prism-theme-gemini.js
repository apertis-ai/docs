// Gemini-inspired syntax highlighting theme
module.exports = {
  plain: {
    color: '#E1DFDF',
    backgroundColor: '#151515',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: '#8E8E8E' },
    },
    {
      types: ['punctuation'],
      style: { color: '#E1DFDF' },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'],
      style: { color: '#FD8DA3' },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: '#77D5A3' },
    },
    {
      types: ['operator', 'entity', 'url'],
      style: { color: '#FFD395' },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: { color: '#BD9CFE' },
    },
    {
      types: ['function', 'class-name'],
      style: { color: '#8DA8FF' },
    },
    {
      types: ['regex', 'important', 'variable'],
      style: { color: '#BD9CFE' },
    },
  ],
};
