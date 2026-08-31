import { weblinkVueTsConfig } from '@weblink/eslint-config'
import { weblinkReactTsConfig } from '@weblink/eslint-config/react'

export default [
  ...weblinkReactTsConfig({
    files: 'src/**/*.{ts,tsx}',
  }),
  ...weblinkVueTsConfig({
    vueFiles: 'src/**/*.vue',
  }),
]
