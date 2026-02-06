import React from 'react'
import UnifiedSearchModal from '@site/src/components/UnifiedSearchModal'

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <UnifiedSearchModal />
    </>
  )
}
