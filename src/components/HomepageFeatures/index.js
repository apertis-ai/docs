import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: '易於使用',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Apertis 是一個整合多種大型語言模型的統一 API 平台，提供了一系列的 AI 模型服務，可以幫助你快速構建自己的應用。
      </>
    ),
  },
  {
    title: '使用指南',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Apertis 使用指南幫助您快速上手，了解如何使用 Apertis 讓日常生活受惠於 AI 的便利。
      </>
    ),
  },
  {
    title: '開發者指南',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Apertis 幫助開發者快速在開發過程中，使用多種大型語言模型輔助開發，並且可以快速部署到自己的應用中。
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
