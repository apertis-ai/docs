import React from 'react'
import Layout from '@theme/Layout'
import styles from './index.module.css'

/* SVG Line Art components — circuit-style decorations per card */
const LineArtStart = () => (
  <svg viewBox="0 0 280 200" fill="none" className={styles.lineArt}>
    <defs>
      <linearGradient id="start-grad" x1="0" y1="0" x2="280" y2="200">
        <stop offset="0%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
    <path d="M280 40 H200 Q190 40 190 50 V90 Q190 100 180 100 H120 Q110 100 110 110 V160" stroke="url(#start-grad)" strokeWidth="1.5" />
    <path d="M280 100 H240 Q230 100 230 110 V150 Q230 160 220 160 H160" stroke="url(#start-grad)" strokeWidth="1.5" />
    <circle cx="110" cy="160" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
    <circle cx="160" cy="160" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
    <polygon points="230,30 250,40 230,50" fill="var(--line-art-color, #0d9488)" opacity="0.15" />
  </svg>
)

const LineArtModels = () => (
  <svg viewBox="0 0 280 200" fill="none" className={styles.lineArt}>
    <defs>
      <linearGradient id="models-grad" x1="0" y1="0" x2="280" y2="200">
        <stop offset="0%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
    <rect x="160" y="40" width="80" height="24" rx="4" stroke="url(#models-grad)" strokeWidth="1.5" />
    <rect x="180" y="76" width="80" height="24" rx="4" stroke="url(#models-grad)" strokeWidth="1.5" />
    <rect x="150" y="112" width="80" height="24" rx="4" stroke="url(#models-grad)" strokeWidth="1.5" />
    <path d="M200 64 V76" stroke="url(#models-grad)" strokeWidth="1.5" />
    <path d="M220 100 V112" stroke="url(#models-grad)" strokeWidth="1.5" />
    <circle cx="200" cy="52" r="2" fill="var(--line-art-color, #0d9488)" opacity="0.3" />
    <circle cx="220" cy="88" r="2" fill="var(--line-art-color, #0d9488)" opacity="0.3" />
    <circle cx="190" cy="124" r="2" fill="var(--line-art-color, #0d9488)" opacity="0.3" />
  </svg>
)

const LineArtAPI = () => (
  <svg viewBox="0 0 280 200" fill="none" className={styles.lineArt}>
    <defs>
      <linearGradient id="api-grad" x1="0" y1="0" x2="280" y2="200">
        <stop offset="0%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
    <path d="M180 30 L150 60 L180 90" stroke="url(#api-grad)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M220 30 L250 60 L220 90" stroke="url(#api-grad)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M280 120 H200 Q190 120 190 130 V170" stroke="url(#api-grad)" strokeWidth="1.5" />
    <path d="M280 150 H240 Q230 150 230 160 V180" stroke="url(#api-grad)" strokeWidth="1.5" />
    <circle cx="190" cy="170" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
    <circle cx="230" cy="180" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
  </svg>
)

const LineArtIntegrations = () => (
  <svg viewBox="0 0 280 200" fill="none" className={styles.lineArt}>
    <defs>
      <linearGradient id="int-grad" x1="0" y1="0" x2="280" y2="200">
        <stop offset="0%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
    <circle cx="210" cy="100" r="20" stroke="url(#int-grad)" strokeWidth="1.5" />
    <circle cx="210" cy="100" r="4" fill="var(--line-art-color, #0d9488)" opacity="0.3" />
    <path d="M210 80 V40" stroke="url(#int-grad)" strokeWidth="1.5" />
    <path d="M230 100 H270" stroke="url(#int-grad)" strokeWidth="1.5" />
    <path d="M210 120 V160" stroke="url(#int-grad)" strokeWidth="1.5" />
    <path d="M190 100 H150" stroke="url(#int-grad)" strokeWidth="1.5" />
    <path d="M226 84 L256 54" stroke="url(#int-grad)" strokeWidth="1.5" />
    <path d="M194 116 L164 146" stroke="url(#int-grad)" strokeWidth="1.5" />
    <circle cx="210" cy="40" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
    <circle cx="270" cy="100" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
    <circle cx="210" cy="160" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
    <circle cx="150" cy="100" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
  </svg>
)

const LineArtPricing = () => (
  <svg viewBox="0 0 280 200" fill="none" className={styles.lineArt}>
    <defs>
      <linearGradient id="price-grad" x1="0" y1="0" x2="280" y2="200">
        <stop offset="0%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
    <rect x="150" y="50" width="100" height="60" rx="6" stroke="url(#price-grad)" strokeWidth="1.5" />
    <line x1="150" y1="72" x2="250" y2="72" stroke="url(#price-grad)" strokeWidth="1.5" />
    <path d="M170 140 H280" stroke="url(#price-grad)" strokeWidth="1.5" />
    <path d="M190 155 H260" stroke="url(#price-grad)" strokeWidth="1.5" />
    <path d="M200 170 H240" stroke="url(#price-grad)" strokeWidth="1.5" />
    <circle cx="200" cy="88" r="2.5" fill="var(--line-art-color, #0d9488)" opacity="0.3" />
  </svg>
)

const LineArtPlayground = () => (
  <svg viewBox="0 0 280 200" fill="none" className={styles.lineArt}>
    <defs>
      <linearGradient id="play-grad" x1="0" y1="0" x2="280" y2="200">
        <stop offset="0%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="var(--line-art-color, #0d9488)" stopOpacity="0.03" />
      </linearGradient>
    </defs>
    <rect x="140" y="30" width="130" height="90" rx="6" stroke="url(#play-grad)" strokeWidth="1.5" />
    <line x1="140" y1="50" x2="270" y2="50" stroke="url(#play-grad)" strokeWidth="1.5" />
    <circle cx="155" cy="40" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.25" />
    <circle cx="165" cy="40" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.25" />
    <circle cx="175" cy="40" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.25" />
    <path d="M160 68 L172 76 L160 84" stroke="url(#play-grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="182" y1="100" x2="220" y2="100" stroke="url(#play-grad)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M180 140 H260 Q270 140 270 150 V180" stroke="url(#play-grad)" strokeWidth="1.5" />
    <circle cx="270" cy="180" r="3" fill="var(--line-art-color, #0d9488)" opacity="0.4" />
  </svg>
)

const features = [
  {
    title: 'Get Started',
    badge: 'Quickstart',
    description: 'Make your first API call in minutes with our OpenAI-compatible endpoint.',
    cta: 'Start building',
    link: '/intro',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
    lineArt: <LineArtStart />,
  },
  {
    title: 'Every Model, One API',
    badge: '470+ models',
    description: 'Access OpenAI, Anthropic, Google, Meta, and more through a single API key.',
    cta: 'Browse models',
    link: '/installation/models',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
    lineArt: <LineArtModels />,
  },
  {
    title: 'API Reference',
    badge: 'OpenAI-compatible',
    description: 'Integrate with our SDK. Compatible with OpenAI and Anthropic client libraries.',
    cta: 'View API docs',
    link: '/api',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    lineArt: <LineArtAPI />,
  },
  {
    title: 'Built for Coding Agents',
    badge: 'Integrations',
    description: 'Purpose-built for Claude Code, Cursor, Cline, and other coding tools.',
    cta: 'Connect now',
    link: '/installation/claude-code',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24" />
      </svg>
    ),
    lineArt: <LineArtIntegrations />,
  },
  {
    title: 'Flexible Pricing',
    badge: 'Save up to 50%',
    description: 'Subscription plans with fixed quota per request, or pay-as-you-go per token.',
    cta: 'View plans',
    link: '/billing/subscription-plans',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    lineArt: <LineArtPricing />,
  },
  {
    title: 'Playground',
    badge: 'Try it live',
    description: 'Test any model in your browser. No setup required.',
    cta: 'Open playground',
    link: 'https://playground.apertis.ai',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    lineArt: <LineArtPlayground />,
    external: true,
  },
]

function FeatureCard({title, badge, description, cta, link, icon, lineArt, external}) {
  const props = external
    ? {href: link, target: '_blank', rel: 'noopener noreferrer'}
    : {href: link}

  return (
    <a className={styles.featureCard} {...props}>
      {/* Badge */}
      <div className={styles.cardBadge}>
        <span className={styles.badgeIcon}>{icon}</span>
        <span>{badge}</span>
      </div>

      {/* Content */}
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDesc}>{description}</p>

      {/* CTA Link */}
      <div className={styles.ctaLink}>
        <span>{cta}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>

      {/* SVG Line Art */}
      {lineArt}
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
            One API key for 470+ models across 30+ providers.
            Smart routing, auto-failover, and free prompt caching built in.
          </p>
          <button className={styles.heroSearch} onClick={openSearch}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search docs or ask AI...</span>
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
