import SettingsProjectTodos from '@/components/settings/SettingsProjectTodos'

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> | { projectId: string } }) {
  const resolvedParams = await params
  return <SettingsProjectTodos projectId={resolvedParams.projectId} />
}
