import React, {useState} from 'react'
import clsx from 'clsx'
import {ThemeClassNames} from '@docusaurus/theme-common'
import {
  useAnnouncementBar,
  useScrollPosition,
} from '@docusaurus/theme-common/internal'
import {translate} from '@docusaurus/Translate'
import DocSidebarItems from '@theme/DocSidebarItems'
import type {Props} from '@theme/DocSidebar/Desktop/Content'

import styles from './styles.module.css'

function useShowAnnouncementBar() {
  const {isActive} = useAnnouncementBar()
  const [showAnnouncementBar, setShowAnnouncementBar] = useState(isActive)

  useScrollPosition(
    ({scrollY}) => {
      if (isActive) {
        setShowAnnouncementBar(scrollY === 0)
      }
    },
    [isActive],
  )
  return isActive && showAnnouncementBar
}

export default function DocSidebarDesktopContent({
  path,
  sidebar,
  className,
}: Props): JSX.Element {
  const showAnnouncementBar = useShowAnnouncementBar()

  return (
    <div className={styles.sidebarContainer}>
      <nav
        aria-label={translate({
          id: 'theme.docs.sidebar.navAriaLabel',
          message: 'Docs sidebar',
          description: 'The ARIA label for the sidebar navigation',
        })}
        className={clsx(
          'menu thin-scrollbar',
          styles.menu,
          showAnnouncementBar && styles.menuWithAnnouncementBar,
          className,
        )}>
        <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
          <DocSidebarItems items={sidebar} activePath={path} level={1} />
        </ul>
      </nav>
      <a
        href="https://apertis.ai/token"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.consoleButton}
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
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span>Console</span>
      </a>
    </div>
  )
}
