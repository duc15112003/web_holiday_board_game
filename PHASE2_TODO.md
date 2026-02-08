# Phase 2: Real Backend Integration TODOs

This document outlines the steps to replace the Mock Backend with a real Spring Boot application.

## 1. Backend Development (Spring Boot)
- [ ] **Database Design**:
  - `User` table (id, username, balance, last_spin_date, daily_spin_count).
  - `SpinHistory` table (id, user_id, reward_amount, created_at).
- [ ] **API Implementation**:
  - `POST /api/auth/login`: Return JWT token.
  - `GET /api/user/profile`: Return user details (protected).
  - `POST /api/game/spin`: Execute spin logic, update DB transactionally, return result.
  - `GET /api/game/history`: Return list of history records.

## 2. Frontend Integration
- [ ] **Environment Variables**:
  - Add `.env`: `VITE_API_URL=http://localhost:8080/api`
- [ ] **Service Refactoring**:
  - Replace `src/mock-api/client.js` with `src/services/api.js`.
  - Use `fetch` or `axios` to call real endpoints.
- [ ] **Authentication**:
  - Store JWT in `localStorage`.
  - Add Authorization header to requests.

## 3. Security & Validation
- [ ] **Server-Side Validation**: Ensure spin limits are enforced on server (critical).
- [ ] **Probability Check**: Move RNG logic entirely to server.

## 4. Cleanup
- [ ] Delete `src/mock-api`.
