# Tet Lucky Spin (Phase 1) - Mock Backend

This project is the Phase 1 implementation of the Lucky Spin game, featuring a complete frontend with a mock backend simulation.

## Features
- **Mock Backend**: Simulates network latency (300-800ms) and authenticates users via `localStorage`.
- **Game Logic**: 
  - 3 Rewards: 10k (50%), 20k (30%), 30k (20%).
  - Daily Limit: 3 spins per user per day.
  - History tracking.
- **Tech Stack**: React + Tailwind CSS.

## Setup & Run

1. **Install Dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```

3. **Open Browser**:
   通常 running at `http://localhost:5173`

## How to Test
1. **Login**: Enter any username (e.g., "testuser"). It will auto-register if new.
2. **Spin**: Click "QUAY NGAY!".
3. **Verify Limits**: Spin 3 times. The button will disable.
4. **Verify Persistence**: Refresh the page. Balance and history should remain.
5. **Reset**: Clear Application > Local Storage to reset all data.

## Project Structure
- `src/mock-api`: Mock backend logic & data models.
- `src/pages`: UI Pages (Login, LuckySpin).
- `src/context`: Auth state management.
