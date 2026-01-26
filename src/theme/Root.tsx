import React from 'react'
import AskAI from '@site/src/components/AskAI'

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AskAI />
    </>
  )
}
