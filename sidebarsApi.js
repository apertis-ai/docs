// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  apiSidebar: [
    // Overview
    {
      type: 'doc',
      id: 'index',
      label: 'Overview',
      className: 'sidebar-category--overview',
    },

    // Text Generation
    {
      type: 'category',
      label: 'Text Generation',
      className: 'sidebar-category--text-generation',
      collapsed: false,
      items: [
        'text-generation/chat-completions',
        'text-generation/responses',
        'text-generation/messages',
        'text-generation/streaming',
        'text-generation/structured-output',
        'text-generation/prompt-cache',
      ],
    },

    // Search
    {
      type: 'category',
      label: 'Search',
      className: 'sidebar-category--search',
      collapsed: false,
      items: [
        'search/web-search',
      ],
    },

    // Vision & Images
    {
      type: 'category',
      label: 'Vision & Images',
      className: 'sidebar-category--vision',
      collapsed: false,
      items: [
        'vision/read-image',
        'vision/image-generation',
        'vision/dalle',
        'vision/images-api',
      ],
    },

    // Audio & Video
    {
      type: 'category',
      label: 'Audio & Video',
      className: 'sidebar-category--audio-video',
      collapsed: false,
      items: [
        'audio-video/audio',
        'audio-video/video',
      ],
    },

    // Embeddings & Rerank
    {
      type: 'category',
      label: 'Embeddings & Rerank',
      className: 'sidebar-category--embeddings',
      collapsed: false,
      items: [
        'embeddings/guide',
        'embeddings/embeddings-api',
        'embeddings/rerank',
      ],
    },

    // SDKs & Libraries
    {
      type: 'category',
      label: 'SDKs & Libraries',
      className: 'sidebar-category--sdks',
      collapsed: false,
      items: [
        {
          type: 'doc',
          id: 'sdks/ai-sdk-provider',
          label: '@apertis/ai-sdk-provider',
        },
        {
          type: 'category',
          label: 'Python SDK',
          collapsed: true,
          items: [
            {
              type: 'doc',
              id: 'sdks/python-sdk/index',
              label: 'Overview',
            },
            'sdks/python-sdk/chat-completions',
            'sdks/python-sdk/streaming',
            'sdks/python-sdk/tool-calling',
            'sdks/python-sdk/embeddings',
            'sdks/python-sdk/vision',
            'sdks/python-sdk/audio',
            'sdks/python-sdk/video',
            'sdks/python-sdk/web-search',
            'sdks/python-sdk/reasoning',
            'sdks/python-sdk/messages-api',
            'sdks/python-sdk/responses-api',
            'sdks/python-sdk/rerank',
            'sdks/python-sdk/async',
          ],
        },
        'sdks/langchain',
        'sdks/llamaindex',
        'sdks/litellm',
      ],
    },

    // Utilities
    {
      type: 'category',
      label: 'Utilities',
      className: 'sidebar-category--utilities',
      collapsed: true,
      items: [
        'utilities/models',
        'utilities/fallback-models',
      ],
    },
  ],
};

export default sidebars;
