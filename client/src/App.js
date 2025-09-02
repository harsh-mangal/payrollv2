// App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Toast from "./components/Toast";
import QuotationsPage from "./pages/QuotationsPage";
// NEW: split pages
import ClientsListPage from "./pages/ClientsListPage";
import ClientDetailPage from "./pages/ClientDetailPage";

import InvoicesPage from "./pages/InvoicesPage";
import PaymentsPage from "./pages/PaymentsPage";
import LedgerPage from "./pages/LedgerPage";
import StaffPage from "./pages/StaffPage";
import ExpensesPage from "./pages/ExpensesPage";
import BalancePage from "./pages/BalancePage";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./components/RequireAuth";
import { apiGet } from "./lib/api";

export default function App() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:3018/api");
  const [toast, setToast] = useState(null);

  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [ledger, setLedger] = useState(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  const showToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  const toggleSidebar = () => setIsSidebarOpen((s) => !s);

  async function reloadClients() {
    try {
      const data = await apiGet(baseUrl, "/clients");
      setClients(data.list || []);
      if (!selectedClientId && data.list?.length) {
        setSelectedClientId(data.list[0]._id);
      }
    } catch (e) {
      showToast({ type: "error", text: e.message });
    }
  }

  async function loadLedger() {
    if (!selectedClientId) return;
    try {
      const data = await apiGet(baseUrl, `/clients/${selectedClientId}/ledger`);
      setLedger({ client: data.client, entries: data.entries });
    } catch (e) {
      showToast({ type: "error", text: e.message });
    }
  }

  async function openLedgerPdf() {
    if (!selectedClientId) return;
    try {
      const data = await apiGet(
        baseUrl,
        `/clients/${selectedClientId}/ledger/pdf`
      );
      window.open(data.url, "_blank");
    } catch (e) {
      showToast({ type: "error", text: e.message });
    }
  }

  useEffect(() => {
    reloadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  useEffect(() => {
    if (selectedClientId) loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const commonProps = {
    baseUrl,
    clients,
    selectedClientId,
    setSelectedClientId,
    showToast,
    reloadClients,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {!isLoginPage && (
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      )}

      <div className="flex flex-col flex-1">
        {!isLoginPage && <Navbar toggleSidebar={toggleSidebar} />}

        <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
          <Routes>
            <Route
              path="/login"
              element={
                <LoginPage
                  baseUrl={baseUrl}
                  onLogin={() => (window.location.href = "/")}
                  showToast={showToast}
                />
              }
            />

            <Route
              path="/"
              element={
                <RequireAuth>
                  <Navigate to="/clients" replace />
                </RequireAuth>
              }
            />
            <Route
              path="/quotations"
              element={
                <RequireAuth>
                  <QuotationsPage
                    baseUrl={baseUrl}
                    clients={clients}
                    showToast={showToast}
                  />
                </RequireAuth>
              }
            />
            {/* Clients list page */}
            <Route
              path="/clients"
              element={
                <RequireAuth>
                  <ClientsListPage
                    baseUrl={baseUrl}
                    clients={clients}
                    reloadClients={reloadClients}
                    showToast={showToast}
                  />
                </RequireAuth>
              }
            />

            {/* Client detail page (includes create service / credentials / meetings) */}
            <Route
              path="/clients/:id"
              element={
                <RequireAuth>
                  <ClientDetailPage baseUrl={baseUrl} showToast={showToast} />
                </RequireAuth>
              }
            />

            <Route
              path="/invoices"
              element={
                <RequireAuth>
                  <InvoicesPage {...commonProps} onAnyChange={loadLedger} />
                </RequireAuth>
              }
            />
            <Route
              path="/payments"
              element={
                <RequireAuth>
                  <PaymentsPage {...commonProps} onAnyChange={loadLedger} />
                </RequireAuth>
              }
            />
            <Route
              path="/ledger"
              element={
                <RequireAuth>
                  <LedgerPage
                    ledger={ledger}
                    onExport={openLedgerPdf}
                    onRefresh={loadLedger}
                  />
                </RequireAuth>
              }
            />
            <Route
              path="/staff"
              element={
                <RequireAuth>
                  <StaffPage baseUrl={baseUrl} showToast={showToast} />
                </RequireAuth>
              }
            />
            <Route
              path="/expenses"
              element={
                <RequireAuth>
                  <ExpensesPage baseUrl={baseUrl} showToast={showToast} />
                </RequireAuth>
              }
            />
            <Route
              path="/balance"
              element={
                <RequireAuth>
                  <BalancePage baseUrl={baseUrl} showToast={showToast} />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Toast toast={toast} />
        </main>

        {!isLoginPage && <Footer />}
      </div>
    </div>
  );
}
