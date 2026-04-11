import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Student
import MyGradesPage from './pages/student/MyGradesPage'
import MyAttendancePage from './pages/student/MyAttendancePage'
import MyTestsPage from './pages/student/MyTestsPage'
import MyAdaptivePage from './pages/student/MyAdaptivePage'

// Teacher
import GradesPage from './pages/teacher/GradesPage'
import AttendancePage from './pages/teacher/AttendancePage'
import TestsPage from './pages/teacher/TestsPage'
import AnalyticsPage from './pages/teacher/AnalyticsPage'
import LessonsPage from './pages/teacher/LessonsPage'
import LessonDetailPage from './pages/teacher/LessonDetailPage'

// Admin
import StudentsPage from './pages/admin/StudentsPage'
import TeachersPage from './pages/admin/TeachersPage'
import TeacherDetailPage from './pages/admin/TeacherDetailPage'
import GroupsPage from './pages/admin/GroupsPage'
import GroupDetailPage from './pages/admin/GroupDetailPage'
import StudentDetailPage from './pages/admin/StudentDetailPage'
import AssignmentPage from './pages/admin/AssignmentPage'
import SubjectsPage from './pages/admin/SubjectsPage'
import UsersPage from './pages/admin/UsersPage'
import DepartmentsPage from './pages/admin/DepartmentsPage'
import DepartmentDetailPage from './pages/admin/DepartmentDetailPage'

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />

                  {/* Student */}
                  <Route path="/my-grades" element={<MyGradesPage />} />
                  <Route path="/my-attendance" element={<MyAttendancePage />} />
                  <Route path="/my-tests" element={<MyTestsPage />} />
                  <Route path="/my-adaptive" element={<MyAdaptivePage />} />

                  {/* Teacher */}
                  <Route path="/lessons" element={<LessonsPage />} />
                  <Route path="/lessons/:id" element={<LessonDetailPage />} />
                  <Route path="/grades" element={<GradesPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/tests" element={<TestsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />

                  {/* Admin */}
                  <Route path="/students" element={<StudentsPage />} />
                  <Route path="/students/:id" element={<StudentDetailPage />} />
                  <Route path="/teachers" element={<TeachersPage />} />
                  <Route path="/teachers/:id" element={<TeacherDetailPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/groups/:id" element={<GroupDetailPage />} />
                  <Route path="/assignments/:id" element={<AssignmentPage />} />
                  <Route path="/subjects" element={<SubjectsPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/departments" element={<DepartmentsPage />} />
                  <Route path="/departments/:id" element={<DepartmentDetailPage />} />

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
