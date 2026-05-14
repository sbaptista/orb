import SettingsUserDetail from '@/components/settings/SettingsUserDetail'

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> | { userId: string } }) {
  const resolvedParams = await params
  return <SettingsUserDetail userId={resolvedParams.userId} />
}
