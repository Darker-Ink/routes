export type Routes = Route[]

export interface Route {
  route: string
  args: string[]
  firstSeen: number
  oldRoutes: OldRoutes[]
  key: string
}

export interface OldRoutes {
  route: string
  args: string[]
  changedAt: number
}

export interface RouteObject {
    [key: string]: Route
}