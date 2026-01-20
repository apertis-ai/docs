/**
 * Creating a sidebar enables you to:
 * - create an ordered group of docs
 * - render a sidebar for each doc of that group
 * - provide next/previous navigation
 *
 * The sidebars can be generated from the filesystem, or explicitly defined here.
 *
 * Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    // Getting Started
    {
      type: 'category',
      label: 'Getting Started',
      className: 'sidebar-category--getting-started',
      collapsed: false,
      items: [
        'intro',
        'getting-started/quick-start',
        'installation/models',
        'principles',
        'usage',
      ],
    },

    // Web Search (independent top-level page)
    {
      type: 'doc',
      id: 'web-search',
      label: 'Web Search',
      className: 'sidebar-item--new',
    },

    // Authentication
    {
      type: 'category',
      label: 'Authentication',
      className: 'sidebar-category--auth',
      collapsed: false,
      items: [
        'authentication/api-keys',
      ],
    },

    // Billing & Quotas
    {
      type: 'category',
      label: 'Billing & Quotas',
      className: 'sidebar-category--billing',
      collapsed: false,
      items: [
        'billing/subscription-plans',
        'billing/quota-management',
        'billing/payg',
        'billing/payment-methods',
        'billing/rate-limits',
      ],
    },

    // Integrations
    {
      type: 'category',
      label: 'Integrations',
      className: 'sidebar-category--integrations',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'AI Coding Assistants',
          collapsed: true,
          items: [
            'installation/claude-code',
            'installation/opencode',
            'installation/crush',
            'installation/goose',
            'installation/cline',
            'installation/cursor',
            'installation/continue',
            'installation/roocode',
            'installation/kilo-code',
          ],
        },
        {
          type: 'category',
          label: 'Framework SDKs',
          collapsed: true,
          items: [
            {
              type: 'doc',
              id: 'installation/apertis-ai-sdk-provider',
              label: '@apertis/ai-sdk-provider',
              className: 'sidebar-item--new',
            },
            'installation/langchain',
            'installation/llamaindex',
          ],
        },
        {
          type: 'category',
          label: 'Client Applications',
          collapsed: true,
          items: [
            'installation/chatbox',
            'installation/translate',
            'installation/bolt_diy',
          ],
        },
      ],
    },

    // API Capabilities
    {
      type: 'category',
      label: 'API Capabilities',
      className: 'sidebar-category--api-capabilities',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Core Features',
          collapsed: true,
          items: [
            'installation/streaming',
            'installation/structure_output',
            'installation/prompt_cache',
          ],
        },
        {
          type: 'category',
          label: 'Multimodal',
          collapsed: true,
          items: [
            'installation/read_image',
            'installation/image_gen',
            'installation/dalle',
          ],
        },
        {
          type: 'category',
          label: 'Advanced Features',
          collapsed: true,
          items: [
            'installation/embedding',
            'installation/fallback_models',
          ],
        },
      ],
    },

    // Configuration
    {
      type: 'category',
      label: 'Configuration',
      className: 'sidebar-category--config',
      collapsed: true,
      items: [
        'installation/connection',
        'installation/scripts',
      ],
    },

    // API Reference
    {
      type: 'category',
      label: 'API Reference',
      className: 'sidebar-category--api-reference',
      collapsed: true,
      items: [
        'references/chat_completions',
        'references/responses',
        'references/messages',
        'references/embeddings',
        'references/images',
        'references/audio',
        'references/video',
        'references/rerank',
        'references/models',
      ],
    },

    // Security
    {
      type: 'category',
      label: 'Security',
      className: 'sidebar-category--security',
      collapsed: true,
      items: [
        'security/best-practices',
      ],
    },

    // Help & Support
    {
      type: 'category',
      label: 'Help & Support',
      className: 'sidebar-category--help',
      collapsed: true,
      items: [
        'help/faq',
        'help/troubleshooting',
        'help/error-codes',
        'help/migration-guides',
      ],
    },

    // Additional Resources
    {
      type: 'category',
      label: 'Additional Resources',
      className: 'sidebar-category--resources',
      collapsed: true,
      items: [
        'opensource',
        'stimachat',
      ],
    },
  ],
};

export default sidebars;
