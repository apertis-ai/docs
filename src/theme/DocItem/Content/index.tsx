import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Content from '@theme-original/DocItem/Content';
import type ContentType from '@theme/DocItem/Content';
import type {WrapperProps} from '@docusaurus/types';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {useColorMode} from '@docusaurus/theme-common';
import Claude from '@lobehub/icons/es/Claude';
import Cursor from '@lobehub/icons/es/Cursor';
import OpenAI from '@lobehub/icons/es/OpenAI';
import styles from './styles.module.css';

type Props = WrapperProps<typeof ContentType>;

type CopyState = 'idle' | 'copied' | 'url-copied';

type DocMetadataLike = {
  editUrl?: string | null;
  source?: string;
  title?: string;
};

const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/apertis-ai/docs/main/';

function githubEditUrlToRaw(editUrl?: string | null): string | null {
  if (!editUrl) {
    return null;
  }

  try {
    const url = new URL(editUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const [owner, repo, action, branch, ...pathParts] = parts;

    if (
      url.hostname === 'github.com' &&
      owner &&
      repo &&
      (action === 'tree' || action === 'blob') &&
      branch &&
      pathParts.length > 0
    ) {
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathParts.join('/')}`;
    }
  } catch {
    return null;
  }

  return editUrl
    .replace('https://github.com/', 'https://raw.githubusercontent.com/')
    .replace('/tree/', '/')
    .replace('/blob/', '/')
    .replace('/edit/', '/');
}

function metadataSourceToRaw(source?: string): string | null {
  if (!source) {
    return null;
  }

  const normalizedSource = source.replace(/^@site\//, '');
  return `${GITHUB_RAW_ROOT}${normalizedSource}`;
}

function getMarkdownContentUrl(metadata: DocMetadataLike): string {
  return (
    githubEditUrlToRaw(metadata.editUrl) ??
    metadataSourceToRaw(metadata.source) ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/?$/, '/')}index.md`
      : '')
  );
}

function getArticleText(): string {
  const mainContent = document.querySelector('article');
  return mainContent?.textContent ?? '';
}

function CopyAsMarkdownDropdown(): JSX.Element {
  const {metadata, contentTitle} = useDoc();
  const {colorMode} = useColorMode();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const markdownContentUrl = useMemo(
    () => getMarkdownContentUrl(metadata as DocMetadataLike),
    [metadata],
  );

  const promptTitle = typeof contentTitle === 'string' ? contentTitle : metadata.title;
  const aiPrompt = useMemo(
    () => `Load the contents of ${markdownContentUrl} into this chat's context so we can discuss it.`,
    [markdownContentUrl],
  );

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle');
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  const copyText = useCallback(async (text: string, nextState: CopyState) => {
    await navigator.clipboard.writeText(text);
    setCopyState(nextState);
    setIsOpen(false);
  }, []);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      if (markdownContentUrl) {
        const response = await fetch(markdownContentUrl);
        if (response.ok) {
          const markdown = await response.text();
          await copyText(markdown, 'copied');
          return;
        }
      }
    } catch {
      // Fall through to copying rendered article text.
    }

    await copyText(getArticleText(), 'copied');
  }, [copyText, markdownContentUrl]);

  const handleCopyContentUrl = useCallback(async () => {
    await copyText(markdownContentUrl, 'url-copied');
  }, [copyText, markdownContentUrl]);

  const openPromptUrl = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  }, []);

  const askClaude = useCallback(() => {
    openPromptUrl(`https://claude.ai/new?q=${encodeURIComponent(aiPrompt)}`);
  }, [aiPrompt, openPromptUrl]);

  const askChatGPT = useCallback(() => {
    openPromptUrl(`https://chatgpt.com/?hints=search&prompt=${encodeURIComponent(aiPrompt)}`);
  }, [aiPrompt, openPromptUrl]);

  const openInCursor = useCallback(() => {
    openPromptUrl(`https://cursor.com/link/prompt?text=${encodeURIComponent(aiPrompt)}`);
  }, [aiPrompt, openPromptUrl]);

  const viewMarkdown = useCallback(() => {
    openPromptUrl(markdownContentUrl);
  }, [markdownContentUrl, openPromptUrl]);

  const primaryLabel =
    copyState === 'copied'
      ? 'Copied'
      : copyState === 'url-copied'
        ? 'URL Copied'
        : 'Copy as Markdown';
  const cursorIconColor = colorMode === 'dark' ? '#fff' : undefined;

  return (
    <div className={styles.copyMarkdownDropdown} ref={dropdownRef}>
      <div
        className={styles.splitButton}
        aria-label={`${promptTitle ?? 'Current page'} AI tools`}
      >
        <button
          type="button"
          className={styles.copyMarkdownButton}
          onClick={handleCopyMarkdown}
          title="Copy page content as Markdown"
        >
          <CopyIcon />
          <span>{primaryLabel}</span>
        </button>
        <button
          type="button"
          className={styles.dropdownTrigger}
          aria-label="Open AI tools"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((value) => !value)}
        >
          <ChevronIcon />
        </button>
      </div>

      {isOpen && (
        <div className={styles.dropdownMenu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.dropdownItem}
            onClick={askClaude}
          >
            <Claude.Color className={styles.brandIcon} size={16} aria-hidden="true" />
            <span>Ask Claude</span>
            <ExternalIcon />
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dropdownItem}
            onClick={askChatGPT}
          >
            <OpenAI className={styles.brandIcon} size={16} aria-hidden="true" />
            <span>Ask ChatGPT</span>
            <ExternalIcon />
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dropdownItem}
            onClick={openInCursor}
          >
            <Cursor
              className={styles.brandIcon}
              color={cursorIconColor}
              size={16}
              aria-hidden="true"
            />
            <span>Open in Cursor</span>
            <ExternalIcon />
          </button>
          <div className={styles.dropdownDivider} />
          <button
            type="button"
            role="menuitem"
            className={styles.dropdownItem}
            onClick={handleCopyMarkdown}
          >
            <CopyIcon />
            <span>Copy as Markdown</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dropdownItem}
            onClick={handleCopyContentUrl}
          >
            <LinkIcon />
            <span>Copy content URL</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.dropdownItem}
            onClick={viewMarkdown}
          >
            <FileIcon />
            <span>View as Markdown</span>
            <ExternalIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function CopyIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ChevronIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ExternalIcon(): JSX.Element {
  return (
    <svg
      className={styles.trailingIcon}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

function LinkIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </svg>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </svg>
  );
}

export default function ContentWrapper(props: Props): JSX.Element {
  return (
    <>
      <div className={styles.copyMarkdownWrapper}>
        <CopyAsMarkdownDropdown />
      </div>
      <Content {...props} />
    </>
  );
}
