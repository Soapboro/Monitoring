import { useAuthStore } from '../store/authStore'
import AdminDashboard from './dashboard/AdminDashboard'
import TeacherDashboard from './dashboard/TeacherDashboard'
import StudentDashboard from './dashboard/StudentDashboard'

export default function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role)

  if (role === 'admin') return <AdminDashboard />
  if (role === 'teacher') return <TeacherDashboard />
  return <StudentDashboard />
}
