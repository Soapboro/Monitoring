import client from './client'

export interface UserMe {
  id: number
  email: string
  role: 'admin' | 'teacher' | 'student'
  is_active: boolean
}

export async function login(email: string, password: string): Promise<string> {
  const params = new URLSearchParams()
  params.append('username', email)
  params.append('password', password)

  const { data } = await client.post<{ access_token: string }>('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return data.access_token
}

export async function getMe(): Promise<UserMe> {
  const { data } = await client.get<UserMe>('/auth/me')
  return data
}
