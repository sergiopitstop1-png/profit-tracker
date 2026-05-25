import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'documenti'

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rimuove accenti (à→a, è→e, ecc.)
    .replace(/[^a-zA-Z0-9._\-]/g, '_') // sostituisce caratteri speciali con _
    .replace(/__+/g, '_') // evita doppi underscore
}

// GET - lista file di un cliente
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cliente = searchParams.get('cliente')

  if (!cliente) {
    return NextResponse.json({ error: 'cliente mancante' }, { status: 400 })
  }

  const folder = cliente.toLowerCase().replace(/\s+/g, '-')

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { sortBy: { column: 'created_at', order: 'desc' } })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Genera URL firmati per ogni file (validi 1 ora)
  const files = await Promise.all(
    (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').map(async f => {
      const { data: urlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(`${folder}/${f.name}`, 3600)
      return {
        name: f.name,
        size: f.metadata?.size || 0,
        created_at: f.created_at,
        url: urlData?.signedUrl || ''
      }
    })
  )

  return NextResponse.json({ files })
}

// POST - upload file
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const cliente = formData.get('cliente') as string

  if (!file || !cliente) {
    return NextResponse.json({ error: 'file o cliente mancante' }, { status: 400 })
  }

  const folder = cliente.toLowerCase().replace(/\s+/g, '-')
  const fileName = `${folder}/${sanitizeFileName(file.name)}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE - elimina file
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const cliente = searchParams.get('cliente')
  const fileName = searchParams.get('file')

  if (!cliente || !fileName) {
    return NextResponse.json({ error: 'cliente o file mancante' }, { status: 400 })
  }

  const folder = cliente.toLowerCase().replace(/\s+/g, '-')
  const filePath = `${folder}/${fileName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
