import React from 'react';
import CodeBlock from '@theme-original/CodeBlock';
import type CodeBlockType from '@theme/CodeBlock';
import type {WrapperProps} from '@docusaurus/types';
import styles from './styles.module.css';

type Props = WrapperProps<typeof CodeBlockType>;

export default function CodeBlockWrapper(props: Props): JSX.Element {
  return (
    <div className={styles.terminalWrapper}>
      <div className={styles.terminalHeader}>
        <div className={styles.terminalButtons}>
          <span className={styles.terminalButton} data-color="red" />
          <span className={styles.terminalButton} data-color="yellow" />
          <span className={styles.terminalButton} data-color="green" />
        </div>
        {props.title && <span className={styles.terminalTitle}>{props.title}</span>}
      </div>
      <CodeBlock {...props} />
    </div>
  );
}
