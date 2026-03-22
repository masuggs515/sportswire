import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StoryDetail } from '@/lib/types'
import StoryDetailClient from '@/components/StoryDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StoryPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke('get-story-detail', {
    body: { storyId: id },
  })
  if (error || !data || data.error) notFound()

  return <StoryDetailClient detail={data as StoryDetail} />
}
