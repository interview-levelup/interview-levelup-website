/// <reference types="vite/client" />

declare module '*.module.scss' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.svg?react' {
  import type { FC, SVGProps } from 'react'
  const ReactComponent: FC<SVGProps<SVGSVGElement>>
  export default ReactComponent
}

declare module '*.png' {
  const src: string
  export default src
}
