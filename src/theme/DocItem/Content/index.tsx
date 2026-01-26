import React from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type {WrapperProps} from '@docusaurus/types';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

type Props = WrapperProps<typeof ContentType>;

function CopyAsMarkdownButton(): JSX.Element {
  const {metadata, contentTitle} = useDoc();

  const handleCopy = async () => {
    try {
      // Get the markdown content from the page URL
      const markdownUrl = metadata.editUrl?.replace('/tree/', '/raw/').replace('/edit/', '/raw/');

      if (markdownUrl) {
        const response = await fetch(markdownUrl);
        if (response.ok) {
          const markdown = await response.text();
          await navigator.clipboard.writeText(markdown);
          // Show feedback
          const button = document.querySelector(`.${styles.copyMarkdownButton}`) as HTMLButtonElement;
          if (button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
              button.textContent = originalText;
            }, 2000);
          }
        }
      }
    } catch (error) {
      // Fallback: copy the page content as text
      const mainContent = document.querySelector('article');
      if (mainContent) {
        const text = mainContent.innerText;
        await navigator.clipboard.writeText(text);
      }
    }
  };

  return (
    <button
      className={styles.copyMarkdownButton}
      onClick={handleCopy}
      title="Copy page content as Markdown"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      Copy as Markdown
    </button>
  );
}

export default function ContentWrapper(props: Props): JSX.Element {
  return (
    <>
      <div className={styles.copyMarkdownWrapper}>
        <CopyAsMarkdownButton />
      </div>
      <Content {...props} />
    </>
  );
}
