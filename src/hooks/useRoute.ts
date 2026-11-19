import { useEffect, useState } from 'react'
import type { Route } from '../lib/router'
import { readRoute } from '../lib/router'

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(readRoute)

  useEffect(() => {
    const update = () => setRoute(readRoute())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  return route
}
