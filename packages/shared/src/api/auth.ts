import type { User } from '../types/user.js'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
}

export interface SessionResponse {
  user: User | null
}
