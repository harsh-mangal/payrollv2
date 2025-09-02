// components/Sidebar.jsx
import React, { useEffect, useState } from "react";
import {
  Users,
  FileText,
  CreditCard,
  BookOpen,
  Users2,
  Receipt,
  Scale,
  Menu,
  X,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const location = useLocation();

  // ✅ Detect resize for desktop vs mobile
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ✅ Close sidebar automatically on mobile route change
  useEffect(() => {
    if (!isDesktop && isOpen) {
      toggleSidebar();
    }
  }, [location]);

  const menuItems = [
    { name: "Clients", icon: <Users size={20} />, path: "/clients" },
    { name: "Invoices", icon: <FileText size={20} />, path: "/invoices" },
    { name: "Payments", icon: <CreditCard size={20} />, path: "/payments" },
    { name: "Ledger", icon: <BookOpen size={20} />, path: "/ledger" },
    { name: "Staff & Payroll", icon: <Users2 size={20} />, path: "/staff" },
    { name: "Expenses", icon: <Receipt size={20} />, path: "/expenses" },
    { name: "Net Balance", icon: <Scale size={20} />, path: "/balance" },
  ];

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 bg-gray-900 border-r shadow-xl transition-all duration-300
        ${isDesktop ? (isOpen ? "w-60" : "w-20") : isOpen ? "w-56" : "w-0"}
        overflow-hidden md:relative md:flex md:flex-col
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Logo + Toggle */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-900">
          {isOpen && (
            <span className="text-lg font-bold text-indigo-600">
              Payroll App
            </span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-indigo-100 text-indigo-600 transition"
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col space-y-2">
            {menuItems.map((item, index) => (
              <NavLink
                key={index}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200
                  ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md"
                      : "text-white hover:bg-indigo-50 hover:text-indigo-600"
                  }`
                }
              >
                {item.icon}
                {isOpen && (
                  <span className="text-sm font-medium">{item.name}</span>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {!isDesktop && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleSidebar}
        ></div>
      )}
    </>
  );
};

export default Sidebar;
