import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, I18nProvider, TicketProvider } from './lib/state';
import { PublicLayout } from './components/Common';
import Home from './pages/Home';
import Stories from './pages/Stories';
import StoryDetail from './pages/StoryDetail';
import MapPage from './pages/MapPage';
import EnterCode from './pages/EnterCode';
import AdminLayout from './pages/admin/AdminLayout';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import StoriesAdmin from './pages/admin/Stories';
import StoryForm from './pages/admin/StoryForm';
import Zones from './pages/admin/Zones';
import Tickets from './pages/admin/Tickets';
import Users from './pages/admin/Users';
import Settings from './pages/admin/Settings';
import Audit from './pages/admin/Audit';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <TicketProvider>
          <AuthProvider>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="stories" element={<Stories />} />
                <Route path="stories/:id" element={<StoryDetail />} />
                <Route path="map" element={<MapPage />} />
                <Route path="code" element={<EnterCode />} />
              </Route>
              <Route path="admin/login" element={<Login />} />
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="stories" element={<StoriesAdmin />} />
                <Route path="stories/:id" element={<StoryForm />} />
                <Route path="zones" element={<Zones />} />
                <Route path="tickets" element={<Tickets />} />
                <Route path="users" element={<Users />} />
                <Route path="settings" element={<Settings />} />
                <Route path="audit" element={<Audit />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </TicketProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
