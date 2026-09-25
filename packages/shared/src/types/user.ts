import type { UserRoles } from '../constants/roles.js'

export interface User {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Manager' | 'Staff' | 'Viewer'
  roles: UserRoles
}
