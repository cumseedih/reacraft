'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth'
import { post, getApiError } from '@/lib/api'
import type { User } from '@/types'

export default function LoginPage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const validate = () => {
    const e: typeof errors = {}
    if (!email) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await post<{ user: User; token: string }>('/api/auth/login', { email, password })
      setUser(res.user)
      setToken(res.token)
      router.push('/chat')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Welcome back</h2>
      <p className="text-muted-foreground text-sm mb-8">Sign in to your KROEX account</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Email</label>
          <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} error={errors.email} autoComplete="email" autoFocus />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs text-primary hover:text-primary/80">Forgot password?</Link>
          </div>
          <Input type="password" placeholder="········" value={password} onChange={e => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
        </div>
        <Button type="submit" className="w-full" loading={loading}>Sign in</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary hover:text-primary/80 font-medium">Sign up</Link>
      </p>
    </div>
  )
}
