import { getAllAppSettings } from '@/lib/settings'
import { LoginClient } from './LoginClient'

export default async function LoginPage() {
  const settings = await getAllAppSettings()
  return <LoginClient settings={settings} />
}
