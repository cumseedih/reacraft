'use client'
import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileText, Upload, Trash2, AlertCircle, Loader2, FolderOpen, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { getKroexClient, uploadFile } from '@/lib/kroex-client'
import { getApiError } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import type { FileOut } from '@kroex/api'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // No GET /api/projects/{id} exists (spec §1.3) — resolve from the list.
  const projectQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => getKroexClient().projects.list(),
  })
  const project = projectQuery.data?.find((p) => p.id === id)

  const filesQuery = useQuery({
    queryKey: ['project-files', id],
    queryFn: () => getKroexClient().projects.listFiles(id),
    // Poll while any file is still processing (chunk_count 0) so status updates.
    refetchInterval: (q) =>
      (q.state.data as FileOut[] | undefined)?.some((f) => f.chunk_count === 0) ? 4000 : false,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return uploadFile(id, form)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-files', id] })
      toast.success('File uploaded — processing started')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => getKroexClient().projects.deleteFile(id, fileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-files', id] }),
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: () => getKroexClient().projects.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      router.push('/projects')
    },
    onError: (e) => { toast.error(getApiError(e)); setConfirmDelete(false) },
  })

  if (projectQuery.isLoading) {
    return <AppShell><div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppShell>
  }
  if (projectQuery.isError) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center text-center p-8">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="font-semibold">Couldn&apos;t load project</p>
          <p className="text-sm text-muted-foreground mt-1">{getApiError(projectQuery.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => projectQuery.refetch()}>Retry</Button>
        </div>
      </AppShell>
    )
  }
  if (!project) {
    return (
      <AppShell>
        <div className="flex h-full flex-col items-center justify-center text-center p-8">
          <p className="font-semibold">Project not found</p>
          <p className="text-sm text-muted-foreground mt-1">It may have been deleted.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/projects')}>Back to projects</Button>
        </div>
      </AppShell>
    )
  }

  const files = filesQuery.data ?? []

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="px-8 py-6 border-b border-border">
          <button onClick={() => router.push('/projects')} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Projects
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: project.color ? `${project.color}22` : 'hsl(var(--secondary))' }}>
                <FolderOpen className="h-5 w-5" style={{ color: project.color ?? 'hsl(var(--primary))' }} />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold truncate">{project.name}</h1>
                {project.description && <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>}
              </div>
            </div>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-2 shrink-0" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 max-w-3xl w-full mx-auto space-y-8">
          {project.system_prompt && (
            <section>
              <h2 className="text-sm font-semibold mb-2">Instructions</h2>
              <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm whitespace-pre-wrap">{project.system_prompt}</div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">Files</h2>
              <input ref={fileInputRef} type="file" className="hidden"
                accept=".txt,.md,.pdf,.docx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); e.target.value = '' }} />
              <Button size="sm" variant="outline" className="gap-2" loading={uploadMutation.isPending} onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Supported: .txt, .md, .pdf, .docx (max 50MB). Files are processed in the background.</p>

            {filesQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}</div>
            ) : files.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center">
                <FileText className="h-7 w-7 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No files yet</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {files.map((f) => <FileRow key={f.id} file={f} onDelete={() => deleteFileMutation.mutate(f.id)} deleting={deleteFileMutation.isPending} />)}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-secondary/30 p-4 flex gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              The current API exposes project files and instructions. It does not provide a rename
              endpoint or a per-project conversation list, so those are not shown here.
            </p>
          </section>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              &ldquo;{project.name}&rdquo; and its file list will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" loading={deleteProjectMutation.isPending} onClick={() => deleteProjectMutation.mutate()}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}

function FileRow({ file, onDelete, deleting }: { file: FileOut; onDelete: () => void; deleting: boolean }) {
  const processing = file.chunk_count === 0
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
      </div>
      {processing ? (
        <Badge variant="warning" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>
      ) : (
        <Badge variant="success">{file.chunk_count} chunks</Badge>
      )}
      <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={deleting} onClick={onDelete} aria-label="Delete file">
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  )
}
