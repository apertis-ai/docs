// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Apertis Documentation',
  tagline: '',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.apertis.ai',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'Apertis-AI', // Usually your GitHub org/user name.
  projectName: 'documentation', // Usually your repo name.

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
      type: 'text/css',
    },
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr',
        htmlLang: 'en',
      },
    },
  },

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          // Edit this page links
          editUrl: 'https://github.com/apertis-ai/docs/tree/main/',
          routeBasePath: '',
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }],
          ],
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Edit this page links
          editUrl: 'https://github.com/apertis-ai/docs/tree/main/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'api',
        path: 'docs-api',
        routeBasePath: 'api',
        sidebarPath: './sidebarsApi.js',
        editUrl: 'https://github.com/apertis-ai/docs/tree/main/',
        remarkPlugins: [
          [require('@docusaurus/remark-plugin-npm2yarn'), { sync: true }],
        ],
      },
    ],
  ],

  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        language: ["en", "zh"],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: "/",
        docsPluginIdForPreferredVersion: "default",
        indexDocs: true,
        // indexBlog: true,
        indexPages: true,
        docsDir: ["docs", "docs-api"],
        // blogDir: "blog",
        removeDefaultStopWordFilter: true,
        removeDefaultStemmer: true,
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      // image: 'img/docusaurus-social-card.jpg',
      image: 'img/logo.png',
      navbar: {
        title: 'Apertis Docs',
        logo: {
          alt: 'Logo',
          src: 'img/logo.png',
          href: 'https://docs.apertis.ai',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Docs',
          },
          {
            to: '/api',
            position: 'left',
            label: 'API Reference',
            activeBaseRegex: '/api/',
          },
          {
            href: 'https://apertis.ai/changelog',
            label: 'Release Notes',
            position: 'left',
          },
          {
            href: 'https://apertis.ai/login',
            label: 'Log in',
            position: 'right',
            className: 'navbar-login-button',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Services',
            items: [
              {
                label: 'Apertis Website',
                href: 'https://api.apertis.ai',
              },
              {
                label: 'Chat',
                href: 'https://chat.apertis.ai',
              },
              {
                label: 'Research',
                href: 'https://blog.apertis.ai',
              },
              {
                label: 'Playground',
                href: 'https://playground.apertis.ai',
              },
              {
                label: 'Status',
                href: 'https://status.stima.tech',
              }
            ],
          },
          {
            title: 'Contact Us',
            items: [
              {
                label: 'Email',
                href: 'mailto:hi@apertis.ai',
              },
              {
                label: 'Facebook',
                href: 'https://www.facebook.com/stimaai/',
              },
              {
                label: 'Instagram',
                href: 'https://www.instagram.com/stimatech',
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/company/apertis-ai',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/apertis-ai',
              },
            ],
          },
        ],
        copyright: `Apertis AI © 2024-2026 STIMA AI LLC. ALL RIGHTS RESERVED.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: require('./src/prism-theme-gemini'),
        additionalLanguages: ['bash', 'json', 'python', 'typescript'],
      },
    }),
};

export default config;
