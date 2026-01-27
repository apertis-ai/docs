import React from 'react'
import styles from './styles.module.css'

export default function LoadingSkeleton() {
  return (
    <div className={styles.loadingSkeleton}>
      <div className={styles.skeletonLine} style={{ width: '80%' }} />
      <div className={styles.skeletonLine} style={{ width: '60%' }} />
      <div className={styles.skeletonLine} style={{ width: '70%' }} />
    </div>
  )
}
