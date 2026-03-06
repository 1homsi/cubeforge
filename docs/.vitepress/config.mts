import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Cubeforge',
  description: 'React-first 2D browser game engine',
  appearance: true,
  base: '/cubeforge/',
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/game' },
      { text: 'Examples', link: 'https://1homsi.github.io/cubeforge-examples/' },
      { text: 'Playground', link: 'https://1homsi.github.io/cubeforge-playground/' },
      { text: 'GitHub', link: 'https://github.com/1homsi/cubeforge' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Cubeforge?', link: '/guide/what-is-cubeforge' },
            { text: 'Getting Started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'ECS', link: '/guide/ecs' },
            { text: 'Physics', link: '/guide/physics' },
            { text: 'Rendering', link: '/guide/rendering' },
            { text: 'Input', link: '/guide/input' },
            { text: 'Tilemaps', link: '/guide/tilemaps' },
          ],
        },
        {
          text: 'Embedding',
          items: [
            { text: 'Embedding in React Apps', link: '/guide/embedding' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Components',
          items: [
            { text: 'Game', link: '/api/game' },
            { text: 'World', link: '/api/world' },
            { text: 'Entity', link: '/api/entity' },
            { text: 'Transform', link: '/api/transform' },
            { text: 'Sprite', link: '/api/sprite' },
            { text: 'RigidBody', link: '/api/rigidbody' },
            { text: 'BoxCollider', link: '/api/boxcollider' },
            { text: 'Script', link: '/api/script' },
            { text: 'Camera2D', link: '/api/camera2d' },
            { text: 'Animation', link: '/api/animation' },
            { text: 'ParticleEmitter', link: '/api/particle-emitter' },
            { text: 'SquashStretch', link: '/api/squash-stretch' },
            { text: 'ParallaxLayer', link: '/api/parallax-layer' },
            { text: 'MovingPlatform', link: '/api/moving-platform' },
            { text: 'Checkpoint', link: '/api/checkpoint' },
            { text: 'Tilemap', link: '/api/tilemap' },
          ],
        },
        {
          text: 'Hooks',
          items: [
            { text: 'usePlatformerController', link: '/api/use-platformer-controller' },
            { text: 'useTopDownMovement', link: '/api/use-top-down-movement' },
            { text: 'useGame', link: '/api/use-game' },
            { text: 'useEntity', link: '/api/use-entity' },
            { text: 'useInput', link: '/api/use-input' },
            { text: 'useEvent', link: '/api/use-event' },
          ],
        },
        {
          text: 'Utilities',
          items: [
            { text: 'tween', link: '/api/tween' },
            { text: 'createAtlas', link: '/api/create-atlas' },
            { text: 'definePlugin', link: '/api/define-plugin' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/1homsi/cubeforge' },
    ],
    search: { provider: 'local' },
    footer: {
      message: 'MIT License',
      copyright: 'Copyright © 2025 1homsi',
    },
  },
})
