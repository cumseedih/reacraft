'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus, FolderPlus, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { getKroexClient } from '@/lib/kroex-client'
import { getApiError } from '@/lib/api'
import type { ProjectOut } from '@kroex/api'

export default function ProjectsPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: projects, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getKroexClient().projects.list(),
  })

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex items-center justify-between px-8 py-6 border-b border-border">
          <div>
            <h1 className="text-xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Group conversations and files, with shared instructions and context.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New project
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {isLoading ? (
            <ProjectsSkeleton />
          ) : isError ? (
            <ErrorState message={getApiError(error)} onRetry={() => refetch()} retrying={isRefetching} />
          ) : (projects && projects.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onOpen={() => router.push(`/projects/${p.id}`)} />
              ))}
            </div>
          ) : (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          )}
        </div>
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(project) => {
          qc.invalidateQueries({ queryKey: ['projects'] })
          setCreateOpen(false)
          router.push(`/projects/${project.id}`)
        }}
      />
    </AppShell>
  )
}

function ProjectCard({ project, onOpen }: { project: ProjectOut; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: project.color ? `${project.color}22` : 'hsl(var(--secondary))' }}
        >
          <FolderOpen className="h-5 w-5" style={{ color: project.color ?? 'hsl(var(--primary))' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate group-hover:text-primary transition-colors">{project.name}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
            {project.description || 'No description'}
          </p>
        </div>
      </div>
    </button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <FolderPlus className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">No projects yet</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Create a project to group related conversations and give KROEX shared instructions and files.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-2">
        <Plus className="h-4 w-4" /> Create your first project
      </Button>
    </div>
  )
}

function ErrorState({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      <AlertCircle className="h-10 w-10 text-destructive mb-3" />
      <h2 className="text-lg font-semibold">Couldn&apos;t load projects</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      <Button variant="outline" onClick={onRetry} loading={retrying} className="mt-5">Retry</Button>
    </div>
  )
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border p-5">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-xl skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 skeleton" />
              <div className="h-3 w-full skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CreateProjectDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (project: ProjectOut) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      getKroexClient().projects.create({
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim() || null,
      }),
    onSuccess: (project) => {
      setName(''); setDescription(''); setSystemPrompt('')
      onCreated(project)
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) mutation.mutate() }}
          className="space-y-4 mt-2"
        >
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Launch planning" autoFocus required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="System prompt applied to conversations in this project" rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending} disabled={!name.trim()}>Create project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
