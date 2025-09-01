import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import TopBar from "./components/TopBar";
import Toast from "./components/Toast";
import ClientsPage from "./pages/ClientsPage";
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
  const [baseUrl, setBaseUrl] = useState("https://apipayroll.dodunsoftsolutions.com//api");
  const [toast, setToast] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [ledger, setLedger] = useState(null);

  const showToast = (t) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  async function reloadClients() {
    try {
      const data = await apiGet(baseUrl, "/clients");
      setClients(data.list || []);
      if (!selectedClientId && data.list?.length)
        setSelectedClientId(data.list[0]._id);
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
    reloadClients(); /* eslint-disable-next-line */
  }, [baseUrl]);
  useEffect(() => {
    if (selectedClientId) loadLedger(); /* eslint-disable-next-line */
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
    <div className="min-h-screen max-w-7xl mx-auto p-6 space-y-6">
      {/* Hide Header/TopBar on login screen if you prefer */}
      {window.location.pathname !== "/login" && (
        <>
          <Header baseUrl={baseUrl} setBaseUrl={setBaseUrl} />
          <TopBar
            clients={clients}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            onOpenLedgerPdf={openLedgerPdf}
            onReloadLedger={loadLedger}
          />
        </>
      )}

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
          path="/clients"
          element={
            <RequireAuth>
              <ClientsPage {...commonProps} />
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
    </div>
  );
}
