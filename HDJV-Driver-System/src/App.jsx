import { BrowserRouter, Routes, Route } from 'react-router'
import Layout from './layout/Layout'
import {
  Dashboard,
  Users,
  RoutesPage,
  Accounts,
  Vehicles,
  Settings,
  Reports,
  Requests,
  Notifications,
  TimeRecords,
  TimeRecordsPerDay,
  Login,
  NotFound
} from './routes/lazyPages'
import { ToastProvider } from './components/Toast/ToastProvider'
import { UserProvider } from './contexts/UserContext'
import { LanguageProvider } from './contexts/LanguageContext'
import { DateTimeFormatProvider } from './contexts/DateTimeFormatContext'
import NavigationInitializer from './components/NavigationInitializer'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './App.css'

function App() {
  return (
    <LanguageProvider>
      <DateTimeFormatProvider>
        <UserProvider>
          <ToastProvider>
            <BrowserRouter>
              <NavigationInitializer>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/routes" element={<RoutesPage />} />
                    <Route path="/vehicles" element={<Vehicles />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/requests" element={<Requests />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/time-records" element={<TimeRecords />} />
                    <Route path="/time-records/per-day" element={<TimeRecordsPerDay />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/notifications" element={<Notifications />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </NavigationInitializer>
            </BrowserRouter>
          </ToastProvider>
        </UserProvider>
      </DateTimeFormatProvider>
    </LanguageProvider>
  )
}

export default App
