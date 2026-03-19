import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StoryDetail } from '@/lib/types'
import StoryDetailClient from '@/components/StoryDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Call get-story-detail Edge Function
  const { data, error } = await supabase.functions.invoke('get-story-detail', {
    body: { storyId: id },
  })

  if (error || !data || data.error) {
    notFound()
  }

  return <StoryDetailClient detail={data as StoryDetail} />
}
