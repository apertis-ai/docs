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

    // Account & Access
    {
      type: 'category',
      label: 'Account & Access',
      className: 'sidebar-category--account',
      collapsed: false,
      items: [
        'authentication/api-keys',
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

    // Help & Security
    {
      type: 'category',
      label: 'Help & Security',
      className: 'sidebar-category--help',
      collapsed: true,
      items: [
        'security/best-practices',
        'help/faq',
        'help/troubleshooting',
        'help/error-codes',
        'help/migration-guides',
      ],
    },

    // Resources
    {
      type: 'category',
      label: 'Resources',
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
