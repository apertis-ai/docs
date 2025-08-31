/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: 'doc',
      id: 'intro',
    },
    {
      type: 'doc',
      id: 'installation/models'
    },
    {
      type: 'doc',
      id: 'principles',
    },
    {
      type: 'doc',
      id: 'usage',
    },
    {
      type: 'doc',
      id: 'opensource',
    },
    {
      type: 'doc',
      id: 'stimachat',
    },
    {
      type: 'category',
      label: '功能',
      collapsed: false,
      items: [
        'installation/chatbox',
        'installation/translate',
        'installation/cline',
        'installation/cursor',
        'installation/continue',
        'installation/bolt_diy',
        'installation/roocode',
        'installation/langchain',
        'installation/llamaindex',
        'installation/connection',
        'installation/scripts',
        'installation/read_image',
        'installation/streaming',
        'installation/structure_output',
        'installation/embedding',
        'installation/image_gen',
        'installation/dalle',
        'installation/fallback_models',
      ],
    },
    {
      type: 'category',
      label: 'API References',
      collapsed: false,
      items: [
        'references/chat_completions',
        'references/embeddings',
        'references/models',
      ],
    },
  ],
};

export default sidebars;
