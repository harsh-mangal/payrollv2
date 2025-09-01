// server/routes/expenses.js
import { Router } from "express";
import { createExpense, listExpenses, deleteExpense } from "../controllers/expenseController.js";
const r = Router();
r.post("/", createExpense);
r.get("/", listExpenses);
r.delete("/:expenseId", deleteExpense);
export default r;
