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

export default function RegisterPage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'At least 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const res = await post<{ user: User; token: string }>('/api/auth/register', {
        name: form.name, email: form.email, password: form.password,
      })
      setUser(res.user)
      setToken(res.token)
      toast.success('Account created! Welcome to KROEX.')
      router.push('/chat')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setLoading(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value })),
    error: errors[key],
  })

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-1">Create your account</h2>
      <p className="text-muted-foreground text-sm mb-8">Start thinking deeper with KROEX</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Full name</label>
          <Input placeholder="Your name" autoComplete="name" autoFocus {...field('name')} />
          {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Email</label>
          <Input type="email" placeholder="you@example.com" autoComplete="email" {...field('email')} />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Password</label>
          <Input type="password" placeholder="Min. 8 characters" autoComplete="new-password" {...field('password')} />
          {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Confirm password</label>
          <Input type="password" placeholder="········" autoComplete="new-password" {...field('confirm')} />
          {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm}</p>}
        </div>
        <Button type="submit" className="w-full" loading={loading}>Create account</Button>
      </form>
      <p className="text-center text-xs text-muted-foreground mt-4">
        By creating an account you agree to our{' '}
        <Link href="/legal/terms" className="underline underline-offset-2">Terms</Link>{' '}and{' '}
        <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
      </p>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:text-primary/80 font-medium">Sign in</Link>
      </p>
    </div>
  )
}
