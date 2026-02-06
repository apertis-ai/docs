import React from 'react'
import Layout from '@theme/Layout'
import styles from './index.module.css'

const features = [
  {
    title: 'Get Started',
    description: 'Make your first API call in minutes',
    link: '/intro',
    color: 'blue',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    title: 'Models',
    description: '470+ models',
    link: '/installation/models',
    color: 'purple',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    title: 'API Reference',
    description: 'Integrate with our SDK, OpenAI-compatible and Anthropic-compatible API',
    link: '/api',
    color: 'green',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    title: 'Integrations',
    description: 'Connect with Claude Code, Cursor, and more',
    link: '/installation/claude-code',
    color: 'orange',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
      </svg>
    ),
  },
  {
    title: 'Pricing',
    description: 'Flexible plans for every scale',
    link: '/billing/subscription-plans',
    color: 'pink',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    title: 'Playground',
    description: 'Test models in your browser',
    link: 'https://playground.apertis.ai',
    color: 'cyan',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    external: true,
  },
]

function FeatureCard({title, description, link, icon, color, external}) {
  const props = external
    ? {href: link, target: '_blank', rel: 'noopener noreferrer'}
    : {href: link}

  return (
    <a className={`${styles.featureCard} ${styles[`card_${color}`]}`} {...props}>
      <div className={`${styles.featureIcon} ${styles[`icon_${color}`]}`}>{icon}</div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{description}</p>
    </a>
  )
}

export default function Home() {
  const openSearch = () => {
    if (typeof window !== 'undefined' && window.__openUnifiedSearch) {
      window.__openUnifiedSearch('search')
    }
  }

  return (
    <Layout title="Home" description="Apertis API Documentation">
      <main className={styles.landing}>
        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Build with Apertis</h1>
          <p className={styles.heroSub}>
            Learn how to get started with Apertis
          </p>
          <button className={styles.heroSearch} onClick={openSearch}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Ask Apertis about docs...</span>
            <kbd className={styles.heroKbd}>&#8984;K</kbd>
          </button>
        </section>

        {/* Feature Cards */}
        <section className={styles.features}>
          <div className={styles.featuresGrid}>
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>
      </main>
    </Layout>
  )
}
